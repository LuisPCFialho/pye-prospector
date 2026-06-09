/**
 * Roof intelligence: infer mount type (flat vs pitched), orientation, tilt,
 * and building height from OSM tags + footprint geometry. Feeds the panel-
 * packing engine, PVGIS angles, and 3D extrusion.
 */
import type { BuildingFeature } from "../types/building";
import type { RoofMountType } from "./panelLayout";

export interface RoofInfo {
  mount: RoofMountType;
  /** Suggested array tilt (degrees). */
  tiltDeg: number;
  /** Azimuth for PVGIS (0=S, -90=E, 90=W). Flat roofs face south. */
  azimuthDeg: number;
  /** Estimated building height (metres) for extrusion + shading. */
  heightM: number;
  /** Confidence in the inference (0-1). */
  confidence: number;
}

/** Building tags that indicate a large flat industrial/commercial roof. */
const FLAT_BUILDINGS = new Set([
  "warehouse", "industrial", "factory", "commercial", "retail", "supermarket",
  "hangar", "manufacture", "hospital", "office",
]);
const PITCHED_ROOF_SHAPES = new Set(["gabled", "hipped", "pyramidal", "half-hipped", "gambrel", "round"]);

/** Parse a numeric OSM tag value (handles "12 m", "12.5"). */
function num(v?: string): number {
  if (!v) return NaN;
  const m = parseFloat(v.replace(",", "."));
  return Number.isFinite(m) ? m : NaN;
}

export function estimateHeight(b: BuildingFeature): number {
  const t = b.rawTags ?? {};
  const h = num(t.height) || num(t["building:height"]);
  if (Number.isFinite(h) && h > 0) return Math.min(120, h);
  const lvl = num(t["building:levels"]) || num(t.levels);
  if (Number.isFinite(lvl) && lvl > 0) return Math.min(120, lvl * 3.2);
  // Fallbacks by use: warehouses/logistics are tall single-storey
  const use = b.inferredUse;
  if (use === "logistics" || use === "metalwork") return 9;
  if (use === "retail") return 6;
  return 7;
}

export function inferRoof(b: BuildingFeature): RoofInfo {
  const t = b.rawTags ?? {};
  const shape = t["roof:shape"];
  const building = t.building;

  let mount: RoofMountType = "flat";
  let confidence = 0.5;

  if (shape) {
    mount = PITCHED_ROOF_SHAPES.has(shape) ? "pitched" : "flat";
    confidence = 0.85; // explicit tag
  } else if (building && FLAT_BUILDINGS.has(building)) {
    mount = "flat";
    confidence = 0.7; // C&I buildings are overwhelmingly flat
  } else if (building === "house" || building === "detached" || building === "residential") {
    mount = "pitched";
    confidence = 0.6;
  } else {
    // Large footprints are almost always flat industrial roofs
    mount = b.areaSqm > 800 ? "flat" : "pitched";
    confidence = 0.45;
  }

  // Tilt: flat roofs get low-tilt racking (10°); pitched ~ roof pitch (assume 20°)
  const tiltDeg = mount === "flat" ? 10 : (num(t["roof:angle"]) || 20);

  // Azimuth: flat → south (0); pitched → from roof:direction if present, else south
  let azimuthDeg = 0;
  const dir = num(t["roof:direction"]);
  if (mount === "pitched" && Number.isFinite(dir)) {
    // roof:direction is the downslope compass bearing; convert to PVGIS aspect (0=S)
    azimuthDeg = ((dir - 180 + 540) % 360) - 180;
  }

  return { mount, tiltDeg, azimuthDeg, heightM: estimateHeight(b), confidence };
}
