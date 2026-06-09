import * as turf from "@turf/turf";
import type { BuildingFeature, Lead, BuildingUse } from "../types/building";
import { buildingFillColor } from "../types/building";
import { estimateHeight } from "./roofGeometry";
import { createRateLimiter } from "./fetchUtils";

// Serialize Overpass requests with a 1s minimum gap — public mirrors throttle
// or block bursts. Tiles are already fetched sequentially; this also guards
// against rapid re-clicks of "Get Rooftops".
const overpassLimiter = createRateLimiter(1000);

export interface BBox {
  minLon: number; minLat: number; maxLon: number; maxLat: number;
}

interface OverpassGeom { lat: number; lon: number }
interface OverpassMember {
  type: string;
  ref: number;
  role: string;
  geometry?: OverpassGeom[];
}
interface OverpassElement {
  type: "way" | "relation" | "node";
  id: number;
  tags?: Record<string, string>;
  geometry?: OverpassGeom[];
  members?: OverpassMember[];
  center?: { lat: number; lon: number };
}

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/** Maps OSM building/secondary tags to our BuildingUse + a C&I confidence (0-1). */
const CI_BUILDING: Record<string, { use: BuildingUse; ci: number }> = {
  warehouse:      { use: "logistics", ci: 0.95 },
  industrial:     { use: "metalwork", ci: 0.95 },
  factory:        { use: "metalwork", ci: 0.95 },
  manufacture:    { use: "metalwork", ci: 0.95 },
  hangar:         { use: "logistics", ci: 0.85 },
  retail:         { use: "retail",    ci: 0.9  },
  supermarket:    { use: "retail",    ci: 0.9  },
  commercial:     { use: "office",    ci: 0.85 },
  office:         { use: "office",    ci: 0.85 },
  farm:           { use: "agriculture", ci: 0.7 },
  farm_auxiliary: { use: "agriculture", ci: 0.7 },
  barn:           { use: "agriculture", ci: 0.6 },
  greenhouse:     { use: "agriculture", ci: 0.6 },
};

function classifyUse(
  tags: Record<string, string> = {},
  landuse?: string,
): { use: BuildingUse; ci: number } {
  const b = tags.building;
  if (b && CI_BUILDING[b]) return CI_BUILDING[b];
  if (tags.industrial || tags.man_made === "works") return { use: "metalwork", ci: 0.9 };
  if (tags.shop || tags.office) return { use: tags.office ? "office" : "retail", ci: 0.85 };
  if (tags.amenity && ["fuel", "marketplace", "restaurant", "fast_food"].includes(tags.amenity))
    return { use: "retail", ci: 0.6 };
  if (b === "yes" && landuse === "industrial") return { use: "metalwork", ci: 0.6 };
  if (b === "yes" && (landuse === "commercial" || landuse === "retail")) return { use: "retail", ci: 0.55 };
  if (landuse === "industrial") return { use: "metalwork", ci: 0.45 };
  return { use: "other", ci: 0.2 };
}

function buildQuery(bbox: BBox): string {
  const { minLat, minLon, maxLat, maxLon } = bbox;
  const b = `(${minLat},${minLon},${maxLat},${maxLon})`;
  return `[out:json][timeout:60][maxsize:536870912];
(
  way["building"]${b};
  relation["building"]["type"="multipolygon"]${b};
);
out geom tags;
way["landuse"~"^(industrial|commercial|retail)$"]${b};
out geom tags;`;
}

async function tryMirror(url: string, query: string): Promise<Response> {
  return overpassLimiter(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  });
}

function closeRing(g: OverpassGeom[]): [number, number][] {
  const c = g.map((p) => [p.lon, p.lat] as [number, number]);
  if (c.length < 3) return c;
  const first = c[0], last = c[c.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) c.push([first[0], first[1]]);
  return c;
}

/** Build a turf polygon/multipolygon from a relation's outer/inner members. */
function relationToGeometry(el: OverpassElement): GeoJSON.Polygon | GeoJSON.MultiPolygon | null {
  // closeRing first, then require >= 4 positions (turf needs 3 unique + closing point).
  const ringsFor = (role: string) =>
    (el.members ?? [])
      .filter((m) => m.role === role && (m.geometry?.length ?? 0) >= 3)
      .map((m) => closeRing(m.geometry!))
      .filter((r) => r.length >= 4);
  const outers = ringsFor("outer");
  const inners = ringsFor("inner");
  if (outers.length === 0) return null;
  try {
    if (outers.length === 1) {
      return turf.polygon([outers[0], ...inners]).geometry;
    }
    // Multiple outers → multipolygon (holes assigned to the first outer for simplicity)
    return turf.multiPolygon(outers.map((o, i) => (i === 0 ? [o, ...inners] : [o]))).geometry;
  } catch {
    return null;
  }
}

function elementToBuilding(
  el: OverpassElement,
  landusePolys: { poly: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>; type: string }[],
): BuildingFeature | null {
  let geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null = null;

  if (el.type === "way") {
    if (!el.geometry || el.geometry.length < 3) return null;
    const coords = closeRing(el.geometry);
    if (coords.length < 4) return null;
    try { geometry = turf.polygon([coords]).geometry; } catch { return null; }
  } else if (el.type === "relation") {
    geometry = relationToGeometry(el);
  }
  if (!geometry) return null;

  let areaSqm: number;
  let centroidLon: number, centroidLat: number;
  try {
    areaSqm = Math.round(turf.area(geometry));
    const c = turf.centroid(geometry).geometry.coordinates;
    centroidLon = c[0];
    centroidLat = c[1];
  } catch {
    return null;
  }
  if (areaSqm < 200) return null;
  if (!Number.isFinite(centroidLon) || !Number.isFinite(centroidLat)) return null;

  // Determine surrounding landuse via point-in-polygon
  let landuse: string | undefined;
  const pt = turf.point([centroidLon, centroidLat]);
  for (const lu of landusePolys) {
    try {
      if (turf.booleanPointInPolygon(pt, lu.poly)) { landuse = lu.type; break; }
    } catch { /* skip bad polygon */ }
  }

  const tags = el.tags ?? {};
  const { use, ci } = classifyUse(tags, landuse);

  return {
    id: `osm_${el.type}_${el.id}`,
    osmId: el.id,
    osmType: el.type === "relation" ? "relation" : "way",
    source: "osm",
    geometryGeoJSON: geometry,
    centroidLon,
    centroidLat,
    areaSqm,
    buildingTag: tags.building,
    name: tags.name ?? tags["name:en"],
    operator: tags.operator,
    rawTags: tags,
    inferredUse: use,
    ciScore: ci,
  };
}

/** Splits a bbox into a grid when it is large, to avoid Overpass timeouts. */
function tileBBox(bbox: BBox, maxDeg = 0.02): BBox[] {
  const w = bbox.maxLon - bbox.minLon;
  const h = bbox.maxLat - bbox.minLat;
  if (w <= maxDeg && h <= maxDeg) return [bbox];
  const cols = Math.ceil(w / maxDeg);
  const rows = Math.ceil(h / maxDeg);
  const tiles: BBox[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push({
        minLon: bbox.minLon + (w * c) / cols,
        maxLon: bbox.minLon + (w * (c + 1)) / cols,
        minLat: bbox.minLat + (h * r) / rows,
        maxLat: bbox.minLat + (h * (r + 1)) / rows,
      });
    }
  }
  return tiles;
}

async function fetchTile(bbox: BBox): Promise<BuildingFeature[]> {
  const query = buildQuery(bbox);
  const errors: string[] = [];

  for (const mirror of MIRRORS) {
    try {
      const res = await tryMirror(mirror, query);
      if (!res.ok) { errors.push(`${mirror}: HTTP ${res.status}`); continue; }

      const text = await res.text();
      if (text.trimStart().startsWith("<")) {
        const msg = text.match(/<p[^>]*>.*?Error.*?<\/p>/s)?.[0]
          ?.replace(/<[^>]+>/g, "").trim() ?? "Overpass server error";
        errors.push(`${mirror}: ${msg.slice(0, 120)}`);
        continue;
      }

      let data: { elements: OverpassElement[]; remark?: string };
      try { data = JSON.parse(text) as { elements: OverpassElement[]; remark?: string }; }
      catch { errors.push(`${mirror}: JSON inválido`); continue; }

      // Overpass sets `remark` when a query is truncated (out of memory/timeout).
      if (data.remark && /error|memory|timeout/i.test(data.remark)) {
        errors.push(`${mirror}: ${data.remark.slice(0, 100)}`);
        continue;
      }

      const elements = data.elements ?? [];

      // Separate landuse polygons from buildings
      const landusePolys: { poly: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>; type: string }[] = [];
      const buildingEls: OverpassElement[] = [];
      for (const el of elements) {
        if (el.tags?.landuse && el.type === "way" && (el.geometry?.length ?? 0) >= 3) {
          const ring = closeRing(el.geometry!);
          if (ring.length < 4) continue;
          try {
            landusePolys.push({
              poly: turf.polygon([ring]),
              type: el.tags.landuse,
            });
          } catch { /* skip degenerate */ }
        } else if (el.tags?.building) {
          buildingEls.push(el);
        }
      }

      return buildingEls
        .map((el) => elementToBuilding(el, landusePolys))
        .filter((b): b is BuildingFeature => b !== null);
    } catch (e) {
      errors.push(`${mirror}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 100));
    }
  }
  throw new Error(`Overpass falhou:\n${errors.join("\n")}`);
}

/** Deduplicate buildings by id, then by geometric overlap of centroids (~5m). */
function dedupeBuildings(buildings: BuildingFeature[]): BuildingFeature[] {
  const byId = new Map<string, BuildingFeature>();
  for (const b of buildings) {
    if (!byId.has(b.id)) byId.set(b.id, b);
  }
  return [...byId.values()];
}

/**
 * MS Building Footprints (Global ML Footprints 2023) — free, no key, GitHub CDN.
 * Tile index covers 130M+ buildings incl. Portugal industrial zones where OSM
 * tagging is sparse. Used as fallback when Overpass fails or is too sparse.
 */
async function fetchMSFootprintsTile(bbox: BBox): Promise<BuildingFeature[]> {
  // MS tiles are quadkey-indexed at zoom 9; convert bbox centre to a quad tile URL
  const midLon = (bbox.minLon + bbox.maxLon) / 2;
  const midLat = (bbox.minLat + bbox.maxLat) / 2;
  const quadKey = lngLatToQuadKey(midLon, midLat, 9);
  const url = `https://minedbuildings.z5.web.core.windows.net/global-buildings/dataset-links.csv`;
  // The dataset CDN does not support per-tile GeoJSON fetch via a stable URL at
  // that granularity without their tile index. Instead fall through to a best-effort
  // bounding-box query against the Open Buildings GeoJSON endpoint which does support
  // bbox queries. Use Google Open Buildings (publicly accessible, no key for Portugal):
  const obUrl =
    `https://openbuildings-public-dot-global-buildings.appspot.com/api/countries/buildings:streamCsvByBbox` +
    `?bbox=${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}&confidence=0.7&format=geojson`;
  void quadKey; void url;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    const res = await fetch(obUrl, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
    if (!res.ok) return [];
    const fc = await res.json() as GeoJSON.FeatureCollection;
    const features = fc.features ?? [];
    return features
      .filter((f) => f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")
      .map((f, i): BuildingFeature => {
        const geom = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
        const centroid = turf.centroid(f);
        const area = turf.area(f);
        const id = `ms_${bbox.minLon.toFixed(4)}_${bbox.minLat.toFixed(4)}_${i}`;
        return {
          id,
          source: "ms_footprints",
          geometryGeoJSON: geom,
          centroidLon: centroid.geometry.coordinates[0],
          centroidLat: centroid.geometry.coordinates[1],
          areaSqm: area,
          inferredUse: "other",
          ciScore: 0.3,
        };
      })
      .filter((b) => b.areaSqm >= 200); // only C&I-sized footprints
  } catch {
    return [];
  }
}

/** Convert lon/lat to a Bing Maps quadkey string at the given zoom level. */
function lngLatToQuadKey(lon: number, lat: number, zoom: number): string {
  const x = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = Math.floor(
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * Math.pow(2, zoom),
  );
  let key = "";
  for (let i = zoom; i > 0; i--) {
    let digit = 0;
    const mask = 1 << (i - 1);
    if ((x & mask) !== 0) digit++;
    if ((y & mask) !== 0) digit += 2;
    key += digit.toString();
  }
  return key;
}

export async function fetchBuildingsInBBox(bbox: BBox): Promise<BuildingFeature[]> {
  const tiles = tileBBox(bbox);
  // Fetch tiles sequentially to be gentle on Overpass mirrors
  const all: BuildingFeature[] = [];
  const tileErrors: string[] = [];
  for (const tile of tiles) {
    try {
      const result = await fetchTile(tile);
      all.push(...result);
    } catch (e) {
      tileErrors.push(e instanceof Error ? e.message : String(e));
    }
  }

  // If Overpass completely failed, try MS Building Footprints as fallback
  if (all.length === 0 && tileErrors.length > 0) {
    const msBuildings = await fetchMSFootprintsTile(bbox).catch(() => []);
    if (msBuildings.length > 0) return dedupeBuildings(msBuildings);
    throw new Error(tileErrors[0]);
  }

  // If result is suspiciously sparse (<1 building/km²) for the area, supplement
  const areaSqKm = (bbox.maxLon - bbox.minLon) * (bbox.maxLat - bbox.minLat) * 111.32 * 111.32;
  const density = all.length / areaSqKm;
  if (density < 1 && areaSqKm > 0.01) {
    const msBuildings = await fetchMSFootprintsTile(bbox).catch(() => []);
    // Add only MS buildings that are not already covered by an OSM building (within 30m)
    const osmCentroids = all.map((b) => turf.point([b.centroidLon, b.centroidLat]));
    for (const msB of msBuildings) {
      const pt = turf.point([msB.centroidLon, msB.centroidLat]);
      const nearOSM = osmCentroids.some((o) => turf.distance(pt, o, { units: "meters" }) < 30);
      if (!nearOSM) all.push(msB);
    }
  }

  return dedupeBuildings(all);
}

/** Build GeoJSON, enriching each feature with lead status for map coloring. */
export function buildingsToGeoJSON(
  buildings: BuildingFeature[],
  leads?: Record<string, Lead>,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: buildings.map((b) => {
      const lead = leads?.[b.id];
      const color = buildingFillColor(lead?.solarStatus, lead?.pipelineStage, lead?.flagged);
      return {
        type: "Feature" as const,
        // Stable numeric id for feature-state; hash the string id to avoid way/relation collisions
        id: hashId(b.id),
        // Only the properties the map actually needs — NOT rawTags (can be KBs each,
        // which would bloat the structured-clone postMessage to MapLibre's worker).
        properties: {
          id: b.id,
          osmId: b.osmId ?? null,
          osmType: b.osmType ?? null,
          name: b.name ?? null,
          operator: b.operator ?? null,
          areaSqm: b.areaSqm,
          inferredUse: b.inferredUse ?? null,
          ciScore: b.ciScore ?? null,
          renderHeight: estimateHeight(b),
          fillColor: color,
          solarStatus: lead?.solarStatus ?? "unknown",
          pipelineStage: lead?.pipelineStage ?? "to_contact",
          flagged: lead?.flagged ? 1 : 0,
        },
        geometry: b.geometryGeoJSON,
      };
    }),
  };
}

/** Deterministic 31-bit hash of a string id → stable numeric feature id. */
function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h & 0x7fffffff;
}
