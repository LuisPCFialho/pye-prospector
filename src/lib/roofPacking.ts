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

  const poly: GeoJSON.Polygon =
    b.geometryGeoJSON.type === "Polygon"
      ? (b.geometryGeoJSON as GeoJSON.Polygon)
      : // largest ring of a MultiPolygon
        { type: "Polygon", coordinates: (b.geometryGeoJSON as GeoJSON.MultiPolygon).coordinates[0] };

  const roof = inferRoof(b);
  const derate = OBSTACLE_DERATE[b.inferredUse ?? "other"] ?? 0.88;
  const result = packRoof(poly, {
    module,
    mount: roof.mount,
    tiltDeg: roof.tiltDeg,
    lat: b.centroidLat,
    setbackM: 1.0,
    obstacles,
    obstacleDerate: derate,
  });

  const out = { result, roof };
  if (!obstacles) cache.set(b.id, out);
  return out;
}

export function clearPackingCache(id?: string): void {
  if (id) cache.delete(id);
  else cache.clear();
}
