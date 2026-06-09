/**
 * Geometric PV module-packing engine.
 *
 * Places REAL solar module rectangles inside a roof polygon and counts them —
 * replacing the crude `area * fraction * W/m²` guess with an actual layout.
 * Accounts for perimeter setbacks, inter-row spacing (anti-shading) on flat
 * roofs, the roof's dominant orientation, and obstacle exclusion zones.
 *
 * Default module: Trina Vertex N TSM-NEG20C.20-630 (630 Wp, 2.172 × 1.303 m).
 */
import * as turf from "@turf/turf";

export interface ModuleSpec {
  /** Marketing name. */
  name: string;
  /** Rated power, watts. */
  wp: number;
  /** Long edge, metres. */
  length: number;
  /** Short edge, metres. */
  width: number;
}

/** Default module — Trina Vertex N TSM-NEG20C.20-630 (confirmed datasheet dims). */
export const TRINA_630: ModuleSpec = {
  name: "Trina Vertex N 630W",
  wp: 630,
  length: 2.172,
  width: 1.303,
};

export type RoofMountType = "flat" | "pitched";

export interface PackOptions {
  module?: ModuleSpec;
  /** Perimeter/fire setback in metres (default 1.0 for C&I flat). */
  setbackM?: number;
  /** "flat" = tilted racks with row gaps; "pitched" = coplanar, dense. */
  mount?: RoofMountType;
  /** Array tilt in degrees (flat roofs). Default 10 (low-tilt C&I). */
  tiltDeg?: number;
  /** Latitude (for winter-solstice row-spacing). */
  lat: number;
  /** Gap between modules within a row (metres). Default 0.02. */
  colGapM?: number;
  /** Exclusion polygons (HVAC/UTA, skylights, walls) in lon/lat. */
  obstacles?: GeoJSON.Polygon[];
  /** Obstacle derate when geometry unknown (0-1). Default 1 (no derate). */
  obstacleDerate?: number;
}

export interface PackResult {
  /** Number of modules physically placed. */
  modules: number;
  /** Installed DC power, kWp (modules * Wp / 1000). */
  kwp: number;
  /** Headline kWp after obstacle derate (what to show the user). */
  kwpDerated: number;
  /** Ground coverage ratio used. */
  gcr: number;
  /** Roof orientation (bearing of rows, degrees). */
  bearingDeg: number;
  /** Panel rectangles in lon/lat for drawing on the map. */
  panels: GeoJSON.Feature<GeoJSON.Polygon>[];
  mount: RoofMountType;
  tiltDeg: number;
}

// ── local ENU projection (metres relative to a pivot) ─────────────────────────
function projector(lat0: number, lon0: number) {
  const mPerDegLat = 111_320;
  const mPerDegLon = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  return {
    to: ([lon, lat]: number[]): [number, number] => [
      (lon - lon0) * mPerDegLon,
      (lat - lat0) * mPerDegLat,
    ],
    from: ([x, y]: [number, number]): [number, number] => [
      lon0 + x / mPerDegLon,
      lat0 + y / mPerDegLat,
    ],
  };
}

function rot(x: number, y: number, a: number): [number, number] {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}

/** Dominant orientation: bearing of the longest convex-hull edge (radians, math frame). */
function dominantAngle(ringM: [number, number][]): number {
  let best = 0, bestLen = -1;
  for (let i = 0; i < ringM.length - 1; i++) {
    const [x1, y1] = ringM[i];
    const [x2, y2] = ringM[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len > bestLen) { bestLen = len; best = Math.atan2(y2 - y1, x2 - x1); }
  }
  return best;
}

function ringToMeters(coords: number[][], proj: ReturnType<typeof projector>): [number, number][] {
  return coords.map((c) => proj.to(c));
}

/** Winter-solstice no-shade row gap for a flat-roof tilted array. */
export function rowGapMeters(panelSlopeLen: number, tiltDeg: number, lat: number): number {
  const tilt = (tiltDeg * Math.PI) / 180;
  // Solar elevation at winter-solstice solar noon: 90 - lat - 23.45
  const alpha = ((90 - lat - 23.45) * Math.PI) / 180;
  if (alpha <= 0) return panelSlopeLen; // polar safety
  return (panelSlopeLen * Math.sin(tilt)) / Math.tan(alpha);
}

/**
 * Pack modules into a roof polygon. Returns the placed panel rectangles + kWp.
 * Tries portrait and landscape and keeps whichever fits more modules.
 */
export function packRoof(roof: GeoJSON.Polygon, opts: PackOptions): PackResult {
  const module = opts.module ?? TRINA_630;
  const mount = opts.mount ?? "flat";
  const tiltDeg = mount === "flat" ? (opts.tiltDeg ?? 10) : 0;
  const setbackM = opts.setbackM ?? 1.0;
  const colGap = opts.colGapM ?? 0.02;
  const derate = opts.obstacleDerate ?? 1;

  // 1) Inset by setback, then subtract obstacles (all in lon/lat via turf)
  let work: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null = turf.feature(roof);
  try {
    const inset = turf.buffer(roof, -setbackM, { units: "meters" });
    if (!inset || turf.area(inset) < 4) {
      return emptyResult(mount, tiltDeg);
    }
    work = inset as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  } catch {
    return emptyResult(mount, tiltDeg);
  }
  if (opts.obstacles) {
    for (const obs of opts.obstacles) {
      try {
        const diff = turf.difference(turf.featureCollection([work, turf.feature(obs)]));
        if (diff) work = diff as typeof work;
      } catch { /* keep work */ }
    }
  }

  // Pivot = centroid; build projector
  const ctr = turf.centroid(work).geometry.coordinates;
  const proj = projector(ctr[1], ctr[0]);

  // Work polygon outer ring(s) in metres (handle MultiPolygon from difference)
  const polys: number[][][] =
    work.geometry.type === "MultiPolygon"
      ? (work.geometry.coordinates as number[][][][]).map((p) => p[0])
      : [(work.geometry as GeoJSON.Polygon).coordinates[0]];

  // Orientation from the largest sub-polygon's hull
  const allM = polys.map((r) => ringToMeters(r, proj));
  const largest = allM.reduce((a, b) => (Math.abs(signedArea(b)) > Math.abs(signedArea(a)) ? b : a));
  let hull: [number, number][];
  try {
    const hf = turf.convex(turf.featureCollection(largest.map((p) => turf.point(proj.from(p)))));
    hull = hf ? ringToMeters(hf.geometry.coordinates[0], proj) : largest;
  } catch {
    hull = largest;
  }
  const theta = dominantAngle(hull);

  // Module footprint variants (horizontal projection)
  const variants: { w: number; depth: number; slope: number }[] = [];
  // portrait: long edge runs up the slope (row-depth), short edge across-row
  variants.push({
    w: module.width + colGap,
    depth: module.length * Math.cos((tiltDeg * Math.PI) / 180),
    slope: module.length,
  });
  // landscape: short edge up the slope
  variants.push({
    w: module.length + colGap,
    depth: module.width * Math.cos((tiltDeg * Math.PI) / 180),
    slope: module.width,
  });

  let best: PackResult | null = null;
  for (const v of variants) {
    const rowGap = mount === "flat" ? rowGapMeters(v.slope, tiltDeg, opts.lat) : 0;
    const stepY = v.depth + rowGap;
    const stepX = v.w;
    const panels = fillGrid(work, proj, theta, stepX, stepY, v.w - colGap, v.depth);
    const count = panels.length;
    if (!best || count > best.modules) {
      const gcr = stepY > 0 ? v.depth / stepY : 1;
      best = {
        modules: count,
        kwp: Math.round((count * module.wp) / 100) / 10,
        kwpDerated: Math.round((count * module.wp * derate) / 100) / 10,
        gcr: Math.round(gcr * 100) / 100,
        bearingDeg: Math.round(((90 - (theta * 180) / Math.PI) % 360 + 360) % 360),
        panels,
        mount,
        tiltDeg,
      };
    }
  }
  return best ?? emptyResult(mount, tiltDeg);
}

function emptyResult(mount: RoofMountType, tiltDeg: number): PackResult {
  return { modules: 0, kwp: 0, kwpDerated: 0, gcr: 0, bearingDeg: 0, panels: [], mount, tiltDeg };
}

function signedArea(ring: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return a / 2;
}

/** Grid-fill module rectangles aligned to `theta`, keeping those inside `work`. */
function fillGrid(
  work: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  proj: ReturnType<typeof projector>,
  theta: number,
  stepX: number,
  stepY: number,
  moduleW: number,
  moduleDepth: number,
): GeoJSON.Feature<GeoJSON.Polygon>[] {
  // Rotate the work polygon into the module frame to get an axis-aligned bbox
  const ctrM: [number, number] = [0, 0]; // projector pivot is the centroid
  // Include ALL rings (outer + holes). turf.difference cuts obstacles as interior
  // hole rings; the even-odd test below then correctly excludes points inside them.
  // (Using only the outer ring would silently ignore interior obstacles.)
  const ringList: number[][][] =
    work.geometry.type === "MultiPolygon"
      ? (work.geometry.coordinates as number[][][][]).flatMap((p) => p)
      : (work.geometry as GeoJSON.Polygon).coordinates;
  const ringsM: [number, number][][] = ringList.map((r) => r.map((c) => proj.to(c)));

  const rotRings = ringsM.map((r) => r.map(([x, y]) => rot(x - ctrM[0], y - ctrM[1], -theta)));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rotRings) for (const [x, y] of r) {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) return [];

  // Point-in-(rotated)polygon test, even-odd over all rings
  const inside = (px: number, py: number): boolean => {
    let c = false;
    for (const r of rotRings) {
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i], [xj, yj] = r[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
      }
    }
    return c;
  };

  const panels: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  const MAX_PANELS = 6000; // safety cap for huge roofs
  for (let cy = minY + (stepY - moduleDepth) / 2; cy + moduleDepth <= maxY; cy += stepY) {
    for (let cx = minX; cx + moduleW <= maxX; cx += stepX) {
      // rectangle corners + centre in rotated frame
      const x0 = cx, x1 = cx + moduleW, y0 = cy, y1 = cy + moduleDepth;
      if (
        inside(x0, y0) && inside(x1, y0) && inside(x1, y1) && inside(x0, y1) &&
        inside((x0 + x1) / 2, (y0 + y1) / 2)
      ) {
        // rotate corners back + unproject
        const corners: [number, number][] = [
          [x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0],
        ].map(([x, y]) => {
          const [rx, ry] = rot(x, y, theta);
          return proj.from([rx + ctrM[0], ry + ctrM[1]]);
        });
        panels.push(turf.polygon([corners]));
        if (panels.length >= MAX_PANELS) return panels;
      }
    }
  }
  return panels;
}
