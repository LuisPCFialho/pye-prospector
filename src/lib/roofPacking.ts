/**
 * Cached bridge between a BuildingFeature and its packed PV layout.
 * Combines roof inference (mount/tilt) with the geometric packing engine,
 * memoizing per building id so the map and the side panel share one result.
 */
import type { BuildingFeature } from "../types/building";
import { inferRoof, type RoofInfo } from "./roofGeometry";
import { packRoof, type PackResult, type ModuleSpec } from "./panelLayout";

const cache = new Map<string, { result: PackResult; roof: RoofInfo }>();

/** Obstacle derate by inferred use (no obstacle geometry available). */
const OBSTACLE_DERATE: Record<string, number> = {
  metalwork: 0.85,   // factories: lots of HVAC/UTAs, vents
  logistics: 0.92,   // clean large warehouse roofs
  retail: 0.88,
  office: 0.85,
  agriculture: 0.95,
  food_beverage: 0.82, // heavy process equipment on roof
  other: 0.88,
};

export function getRoofPacking(
  b: BuildingFeature,
  module?: ModuleSpec,
  obstacles?: GeoJSON.Polygon[],
): { result: PackResult; roof: RoofInfo } {
  // Bypass cache when caller supplies obstacles (user-drawn exclusions)
  if (!obstacles && cache.has(b.id)) return cache.get(b.id)!;

  const roof = inferRoof(b);
  // When the user has drawn explicit obstacles they are subtracted geometrically
  // (turf.difference), so the panel count already reflects the real usable area.
  // Only apply the use-based flat derate when no drawn obstacles exist (inferred clutter).
  const derate = obstacles?.length ? 1 : (OBSTACLE_DERATE[b.inferredUse ?? "other"] ?? 0.88);
  const packOpts = { module, mount: roof.mount, tiltDeg: roof.tiltDeg, lat: b.centroidLat, setbackM: 1.0, obstacles, obstacleDerate: derate };

  // Pack every sub-polygon in a MultiPolygon and sum — disjoint roof sections
  // (e.g. two warehouse wings) are no longer silently ignored.
  let result: PackResult;
  if (b.geometryGeoJSON.type === "MultiPolygon") {
    const parts = (b.geometryGeoJSON as GeoJSON.MultiPolygon).coordinates.map(
      (rings) => packRoof({ type: "Polygon", coordinates: rings }, packOpts),
    );
    // Merge all parts: sum modules/kwp, keep panels/meta from all parts combined
    result = parts.reduce<PackResult>((acc, p) => ({
      modules: acc.modules + p.modules,
      kwp: Math.round((acc.kwp + p.kwp) * 10) / 10,
      kwpDerated: Math.round((acc.kwpDerated + p.kwpDerated) * 10) / 10,
      gcr: (acc.gcr + p.gcr) / 2, // average GCR across sections
      bearingDeg: acc.bearingDeg, // use first section's orientation
      panels: [...acc.panels, ...p.panels],
      mount: acc.mount,
      tiltDeg: acc.tiltDeg,
    }), { modules: 0, kwp: 0, kwpDerated: 0, gcr: 0, bearingDeg: parts[0]?.bearingDeg ?? 0, panels: [], mount: roof.mount, tiltDeg: roof.tiltDeg });
  } else {
    result = packRoof(b.geometryGeoJSON as GeoJSON.Polygon, packOpts);
  }

  const out = { result, roof };
  if (!obstacles) cache.set(b.id, out);
  return out;
}

export function clearPackingCache(id?: string): void {
  if (id) cache.delete(id);
  else cache.clear();
}

/**
 * Single source of truth for the kWp figure shown everywhere in the app
 * (map labels, hover tooltip, table column, filters, side panel).
 * Always uses obstacle-aware packing so every view is consistent.
 */
export function getRealKwp(
  b: BuildingFeature,
  obstacles?: GeoJSON.Polygon[],
): number {
  try {
    return getRoofPacking(b, undefined, obstacles?.length ? obstacles : undefined)
      .result.kwpDerated;
  } catch {
    return 0;
  }
}
