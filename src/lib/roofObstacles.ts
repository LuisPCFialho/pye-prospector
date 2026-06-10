/**
 * Automatic rooftop obstacle detection (skylights, HVAC/UTA, vents, chimneys,
 * tanks, existing PV) from satellite imagery using Gemini Vision.
 *
 * Pipeline: stitch XYZ satellite tiles around the roof onto a canvas → send
 * the JPEG to Gemini asking for detection boxes (normalized 0-1000) → map the
 * boxes back to lon/lat via exact Web-Mercator math, buffer +0.3 m and clip
 * to the roof polygon.
 *
 * Best-effort: detectRoofObstacles never throws — any failure returns [].
 */
import * as turf from "@turf/turf";
import type { BuildingFeature } from "../types/building";
import { config } from "../config";
import { geminiKey, geminiLimiter } from "./gemini";

export interface DetectedObstacle {
  polygon: GeoJSON.Polygon;
  label: string;
  confidence: number;
}

/** Gemini detection box; box_2d = [ymin, xmin, ymax, xmax] normalized 0-1000. */
export interface DetectionBox {
  box_2d: [number, number, number, number];
  label: string;
  confidence: number;
}

export interface WorldPx {
  x: number;
  y: number;
}

// ── Web-Mercator tile math (exported pure functions, unit-tested) ─────────────

const TILE_SIZE = 256;

/** lon/lat → world pixel coordinates at zoom z (standard XYZ Web-Mercator). */
export function lonLatToWorldPx(lon: number, lat: number, z: number): WorldPx {
  const scale = TILE_SIZE * Math.pow(2, z);
  const sinLat = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

/** World pixel at zoom z → lon/lat (inverse of lonLatToWorldPx). */
export function worldPxToLonLat(px: number, py: number, z: number): { lon: number; lat: number } {
  const scale = TILE_SIZE * Math.pow(2, z);
  const n = Math.PI - (2 * Math.PI * py) / scale;
  return {
    lon: (px / scale) * 360 - 180,
    lat: (180 / Math.PI) * Math.atan(Math.sinh(n)),
  };
}

// ── Satellite image stitching (browser/Tauri webview only — never in tests) ───

const MIN_ZOOM = 17;
const MAX_ZOOM = 20;
const ESRI_MAX_ZOOM = 19; // Esri World Imagery has no z20 tiles
const TARGET_SPAN_PX = 512;
const MAX_IMAGE_PX = 1280;
const BBOX_PAD_FRACTION = 0.15;
const MAX_TILES = 100;

type TileProvider = "maptiler" | "esri";

interface RoofImage {
  /** JPEG, base64 without the data: prefix. */
  base64: string;
  /** Geographic extent of the image in world px at zoom `z` (pre-downscale). */
  widthWorldPx: number;
  heightWorldPx: number;
  /** World px of the image's top-left corner at zoom `z`. */
  originWorldPx: WorldPx;
  z: number;
  /** Roof outer ring(s) in final-image pixel coordinates (for the prompt). */
  roofOutlinesPx: [number, number][][];
}

function tileUrl(provider: TileProvider, z: number, x: number, y: number): string {
  if (provider === "maptiler") {
    return `https://api.maptiler.com/tiles/satellite-v2/${z}/${x}/${y}.jpg?key=${config.maptilerApiKey}`;
  }
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}

function paddedBbox(roof: GeoJSON.Polygon | GeoJSON.MultiPolygon): [number, number, number, number] {
  const [minLon, minLat, maxLon, maxLat] = turf.bbox(roof);
  const padLon = (maxLon - minLon) * BBOX_PAD_FRACTION;
  const padLat = (maxLat - minLat) * BBOX_PAD_FRACTION;
  return [minLon - padLon, minLat - padLat, maxLon + padLon, maxLat + padLat];
}

/** Smallest zoom in [MIN_ZOOM, maxZoom] where the bbox's larger span >= ~512 px. */
function pickZoom(bbox: [number, number, number, number], maxZoom: number): number {
  for (let z = MIN_ZOOM; z <= maxZoom; z++) {
    const tl = lonLatToWorldPx(bbox[0], bbox[3], z);
    const br = lonLatToWorldPx(bbox[2], bbox[1], z);
    if (Math.max(br.x - tl.x, br.y - tl.y) >= TARGET_SPAN_PX) return z;
  }
  return maxZoom;
}

const TILE_FETCH_TIMEOUT_MS = 15_000;

async function drawTile(
  ctx: CanvasRenderingContext2D,
  provider: TileProvider,
  z: number,
  tx: number,
  ty: number,
  origin: WorldPx,
): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TILE_FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(tileUrl(provider, z, tx, ty), { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`tile ${z}/${tx}/${ty} → HTTP ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob());
  ctx.drawImage(bitmap, tx * TILE_SIZE - origin.x, ty * TILE_SIZE - origin.y);
}

/** Stitch tiles covering the padded roof bbox. Throws on tile failure. */
async function buildRoofImage(
  roof: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  provider: TileProvider,
): Promise<RoofImage | null> {
  const bbox = paddedBbox(roof);
  const z = pickZoom(bbox, provider === "esri" ? ESRI_MAX_ZOOM : MAX_ZOOM);
  const tl = lonLatToWorldPx(bbox[0], bbox[3], z);
  const br = lonLatToWorldPx(bbox[2], bbox[1], z);
  const widthWorldPx = br.x - tl.x;
  const heightWorldPx = br.y - tl.y;
  if (widthWorldPx < 1 || heightWorldPx < 1) return null;

  // The JPEG may be uniformly downscaled to <=1280 px; box_2d coordinates are
  // normalized over the image, so the world-px mapping is unaffected.
  const scale = Math.min(1, MAX_IMAGE_PX / Math.max(widthWorldPx, heightWorldPx));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(widthWorldPx * scale));
  canvas.height = Math.max(1, Math.round(heightWorldPx * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);

  const maxTile = Math.pow(2, z) - 1;
  const txMin = Math.max(0, Math.floor(tl.x / TILE_SIZE));
  const txMax = Math.min(maxTile, Math.floor(br.x / TILE_SIZE));
  const tyMin = Math.max(0, Math.floor(tl.y / TILE_SIZE));
  const tyMax = Math.min(maxTile, Math.floor(br.y / TILE_SIZE));
  if ((txMax - txMin + 1) * (tyMax - tyMin + 1) > MAX_TILES) return null;

  const tiles: Promise<void>[] = [];
  for (let tx = txMin; tx <= txMax; tx++) {
    for (let ty = tyMin; ty <= tyMax; ty++) {
      tiles.push(drawTile(ctx, provider, z, tx, ty, tl));
    }
  }
  await Promise.all(tiles);

  const base64 = canvas.toDataURL("image/jpeg", 0.9).split(",")[1] ?? "";
  if (!base64) return null;

  const rings: number[][][] =
    roof.type === "MultiPolygon" ? roof.coordinates.map((p) => p[0]) : [roof.coordinates[0]];
  const roofOutlinesPx = rings.map((ring) =>
    ring.map((pos): [number, number] => {
      const wp = lonLatToWorldPx(pos[0], pos[1], z);
      return [Math.round((wp.x - tl.x) * scale), Math.round((wp.y - tl.y) * scale)];
    }),
  );

  return { base64, widthWorldPx, heightWorldPx, originWorldPx: tl, z, roofOutlinesPx };
}

// ── Gemini Vision detection ───────────────────────────────────────────────────

const VISION_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];

function buildDetectionPrompt(roofOutlinesPx: [number, number][][]): string {
  const outlines = roofOutlinesPx
    .map((ring) => ring.map(([x, y]) => `[${x},${y}]`).join(","))
    .join(" | ");
  return `This is a satellite photo of a building rooftop.
The target roof outline in image PIXEL coordinates [x,y] is: ${outlines}
Detect ALL rooftop obstructions on this roof that would prevent installing solar panels: skylights (claraboias), HVAC/AC units, vents, chimneys, roof hatches, water tanks, existing solar panels, and other raised structures.
Only include objects on this building's roof — ignore the ground and neighbouring buildings.
Respond with ONLY a JSON array, no markdown, no prose:
[{"box_2d":[ymin,xmin,ymax,xmax],"label":"skylight|hvac|vent|chimney|hatch|tank|existing_pv|structure|other","confidence":0.0-1.0}]
box_2d values are normalized to 0-1000 over the full image.
If there are no obstructions, respond with [].`;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

function extractText(data: unknown): string {
  const parts = (data as GeminiResponse)?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p) => p.text)
    .filter((t): t is string => typeof t === "string")
    .join("");
}

function parseBoxes(text: string): DetectionBox[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const boxes: DetectionBox[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const box = e.box_2d;
    if (
      !Array.isArray(box) || box.length !== 4 ||
      !box.every((v): v is number => typeof v === "number" && Number.isFinite(v))
    ) continue;
    boxes.push({
      box_2d: [box[0], box[1], box[2], box[3]],
      label: typeof e.label === "string" && e.label ? e.label : "other",
      confidence: typeof e.confidence === "number" ? e.confidence : 0,
    });
  }
  return boxes;
}

async function detectBoxesWithGemini(img: RoofImage): Promise<DetectionBox[] | null> {
  const key = geminiKey();
  if (!key) return null;
  const prompt = buildDetectionPrompt(img.roofOutlinesPx);
  for (const model of VISION_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20_000);
      let res: Response;
      try {
        res = await geminiLimiter(() => fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inline_data: { mime_type: "image/jpeg", data: img.base64 } },
                { text: prompt },
              ],
            }],
            generationConfig: { temperature: 0, maxOutputTokens: 2000 },
          }),
          signal: ctrl.signal,
        }));
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) continue;
      const boxes = parseBoxes(extractText(await res.json()));
      if (boxes) return boxes;
    } catch {
      // try next model
    }
  }
  return null;
}

// ── Post-processing (exported pure function, unit-tested) ─────────────────────

const MIN_CONFIDENCE = 0.4;
const MIN_OBSTACLE_AREA_SQM = 0.5;
const MAX_ROOF_FRACTION = 0.4;
const OBSTACLE_BUFFER_M = 0.3;
const BOX_NORM = 1000;

function boxToLonLatRect(
  box2d: [number, number, number, number],
  imgW: number,
  imgH: number,
  origin: WorldPx,
  z: number,
): GeoJSON.Polygon | null {
  const [ymin, xmin, ymax, xmax] = box2d;
  if (!(ymax > ymin) || !(xmax > xmin)) return null;
  const tl = worldPxToLonLat(origin.x + (xmin / BOX_NORM) * imgW, origin.y + (ymin / BOX_NORM) * imgH, z);
  const br = worldPxToLonLat(origin.x + (xmax / BOX_NORM) * imgW, origin.y + (ymax / BOX_NORM) * imgH, z);
  // World y grows southward → tl.lat is the northern edge.
  return {
    type: "Polygon",
    coordinates: [[
      [tl.lon, tl.lat], [br.lon, tl.lat], [br.lon, br.lat], [tl.lon, br.lat], [tl.lon, tl.lat],
    ]],
  };
}

function largestPolygon(geom: GeoJSON.Polygon | GeoJSON.MultiPolygon): GeoJSON.Polygon {
  if (geom.type === "Polygon") return geom;
  if (geom.coordinates.length === 0) return { type: "Polygon", coordinates: [] };
  let best: GeoJSON.Polygon = { type: "Polygon", coordinates: geom.coordinates[0] };
  let bestArea = turf.area(best);
  for (const coords of geom.coordinates.slice(1)) {
    const poly: GeoJSON.Polygon = { type: "Polygon", coordinates: coords };
    const a = turf.area(poly);
    if (a > bestArea) { bestArea = a; best = poly; }
  }
  return best;
}

/** Buffer the rectangle +0.3 m and clip it to the first roof part it overlaps. */
function bufferAndClip(rect: GeoJSON.Polygon, roofParts: GeoJSON.Polygon[]): GeoJSON.Polygon | null {
  let zone: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> = turf.feature(rect);
  try {
    const buffered = turf.buffer(zone, OBSTACLE_BUFFER_M, { units: "meters" });
    if (buffered) zone = buffered;
  } catch { /* keep the unbuffered rectangle */ }
  for (const part of roofParts) {
    try {
      const hit = turf.intersect(turf.featureCollection([zone, turf.feature(part)]));
      if (hit && turf.area(hit) > 0) return largestPolygon(hit.geometry);
    } catch { /* try the next roof part */ }
  }
  return null;
}

/**
 * Convert Gemini detection boxes into roof-clipped obstacle polygons.
 *
 * imgW/imgH are the image's geographic extent in world px at zoom `z`
 * (1 image px = 1 world px before any JPEG downscale — box_2d is normalized
 * 0-1000 over the image, so a uniform downscale does not affect the mapping).
 */
export function boxesToObstacles(
  boxes: DetectionBox[],
  imgW: number,
  imgH: number,
  originWorldPx: WorldPx,
  z: number,
  roofPolygon: GeoJSON.Polygon | GeoJSON.MultiPolygon,
): DetectedObstacle[] {
  const roofAreaSqm = turf.area(roofPolygon);
  if (!(roofAreaSqm > 0)) return [];
  const roofParts: GeoJSON.Polygon[] =
    roofPolygon.type === "MultiPolygon"
      ? roofPolygon.coordinates.map((coords) => ({ type: "Polygon", coordinates: coords }))
      : [roofPolygon];

  const obstacles: DetectedObstacle[] = [];
  for (const box of boxes) {
    if (box.confidence < MIN_CONFIDENCE) continue;
    const rect = boxToLonLatRect(box.box_2d, imgW, imgH, originWorldPx, z);
    if (!rect) continue;
    const clipped = bufferAndClip(rect, roofParts);
    if (!clipped) continue;
    const areaSqm = turf.area(clipped);
    if (areaSqm < MIN_OBSTACLE_AREA_SQM || areaSqm > roofAreaSqm * MAX_ROOF_FRACTION) continue;
    obstacles.push({ polygon: clipped, label: box.label, confidence: box.confidence });
  }
  return obstacles;
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Detect rooftop obstacles for a building from satellite imagery.
 * Best-effort: returns [] on any failure (no key, tile fetch, Gemini, parse).
 */
export async function detectRoofObstacles(building: BuildingFeature): Promise<DetectedObstacle[]> {
  try {
    if (!geminiKey()) return [];
    const roof = building.geometryGeoJSON;
    const providers: TileProvider[] = config.maptilerApiKey ? ["maptiler", "esri"] : ["esri"];
    let img: RoofImage | null = null;
    for (const provider of providers) {
      try {
        img = await buildRoofImage(roof, provider);
        if (img) break;
      } catch { /* fall back to the next tile provider */ }
    }
    if (!img) return [];
    const boxes = await detectBoxesWithGemini(img);
    if (!boxes) return [];
    return boxesToObstacles(boxes, img.widthWorldPx, img.heightWorldPx, img.originWorldPx, img.z, roof);
  } catch {
    return [];
  }
}
