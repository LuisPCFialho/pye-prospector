import { describe, it, expect } from "vitest";
import { inferRoof, estimateHeight } from "./roofGeometry";
import type { BuildingFeature } from "../types/building";

function makeBuilding(overrides: Partial<BuildingFeature> = {}): BuildingFeature {
  return {
    id: "b1",
    source: "osm",
    geometryGeoJSON: { type: "Polygon", coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] },
    centroidLon: -9.1,
    centroidLat: 38.7,
    areaSqm: 2000,
    ...overrides,
  };
}

describe("inferRoof — mount type detection", () => {
  it("large warehouse footprint → flat roof", () => {
    const { mount } = inferRoof(makeBuilding({ areaSqm: 5000, rawTags: { building: "warehouse" } }));
    expect(mount).toBe("flat");
  });

  it("explicit gabled shape → pitched roof", () => {
    const { mount, confidence } = inferRoof(makeBuilding({ rawTags: { "roof:shape": "gabled" } }));
    expect(mount).toBe("pitched");
    expect(confidence).toBeGreaterThan(0.8);
  });

  it("residential building → pitched roof", () => {
    const { mount } = inferRoof(makeBuilding({ rawTags: { building: "house" } }));
    expect(mount).toBe("pitched");
  });

  it("flat roof gets 10° tilt (low-tilt C&I racking default)", () => {
    const { tiltDeg } = inferRoof(makeBuilding({ rawTags: { building: "industrial" } }));
    expect(tiltDeg).toBe(10);
  });

  it("pitched roof uses roof:angle when present", () => {
    const { tiltDeg } = inferRoof(makeBuilding({ rawTags: { building: "house", "roof:angle": "28" } }));
    expect(tiltDeg).toBe(28);
  });

  it("flat roof defaults to south azimuth (0°)", () => {
    const { azimuthDeg } = inferRoof(makeBuilding({ rawTags: { building: "warehouse" } }));
    expect(azimuthDeg).toBe(0);
  });

  it("confidence >=0.85 when roof:shape tag present", () => {
    const { confidence } = inferRoof(makeBuilding({ rawTags: { "roof:shape": "hipped" } }));
    expect(confidence).toBeGreaterThanOrEqual(0.85);
  });
});

describe("estimateHeight", () => {
  it("uses explicit height tag", () => {
    expect(estimateHeight(makeBuilding({ rawTags: { height: "12" } }))).toBe(12);
  });

  it("derives from building:levels * 3.2", () => {
    expect(estimateHeight(makeBuilding({ rawTags: { "building:levels": "3" } }))).toBeCloseTo(9.6, 1);
  });

  it("logistics/metalwork default to 9m (tall single-storey)", () => {
    expect(estimateHeight(makeBuilding({ inferredUse: "logistics" }))).toBe(9);
    expect(estimateHeight(makeBuilding({ inferredUse: "metalwork" }))).toBe(9);
  });

  it("caps at 120m to prevent extrusion runaway", () => {
    expect(estimateHeight(makeBuilding({ rawTags: { height: "150" } }))).toBe(120);
  });
});
