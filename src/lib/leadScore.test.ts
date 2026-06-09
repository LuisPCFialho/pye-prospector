import { describe, it, expect } from "vitest";
import { scoreLead, scoreColor } from "./leadScore";
import type { BuildingFeature } from "../types/building";

function makeBuilding(overrides: Partial<BuildingFeature> = {}): BuildingFeature {
  return {
    id: "test-1",
    source: "osm",
    geometryGeoJSON: { type: "Polygon", coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] },
    centroidLon: 0,
    centroidLat: 38.7,
    areaSqm: 5000,
    ciScore: 0.8,
    inferredUse: "logistics",
    ...overrides,
  };
}

describe("scoreLead", () => {
  it("returns a score between 0 and 100", () => {
    const { score } = scoreLead(makeBuilding());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("penalizes buildings that already have solar (hasPv=true → 0 pts on that dimension)", () => {
    const withPv = scoreLead(makeBuilding(), { solarStatus: "has_panels" } as never);
    const noPv = scoreLead(makeBuilding());
    expect(noPv.score).toBeGreaterThan(withPv.score);
    const pvPart = withPv.parts.find((p) => p.label === "Sem PV existente");
    expect(pvPart?.pts).toBe(0);
  });

  it("food_beverage sector scores higher than office (better daytime self-consumption fit)", () => {
    const foodScore = scoreLead(makeBuilding({ inferredUse: "food_beverage" })).score;
    const officeScore = scoreLead(makeBuilding({ inferredUse: "office" })).score;
    expect(foodScore).toBeGreaterThan(officeScore);
  });

  it("contact details boost the contactability score", () => {
    const noContact = scoreLead(makeBuilding()).score;
    const withContact = scoreLead(makeBuilding(), {
      company: "Acme Lda", telephone: "+351912345678", website: "https://acme.pt",
    } as never).score;
    expect(withContact).toBeGreaterThan(noContact);
  });

  it("parts always sum to the total score", () => {
    const { score, parts } = scoreLead(makeBuilding());
    expect(parts.reduce((a, p) => a + p.pts, 0)).toBe(score);
  });

  it("returns the 5 expected scoring dimensions", () => {
    const { parts } = scoreLead(makeBuilding());
    expect(parts).toHaveLength(5);
    const labels = parts.map((p) => p.label);
    expect(labels).toContain("Dimensão (kWp)");
    expect(labels).toContain("Sem PV existente");
    expect(labels).toContain("Contactabilidade");
  });
});

describe("scoreColor", () => {
  it("green >=70, amber >=45, grey below", () => {
    expect(scoreColor(75)).toBe("#22c55e");
    expect(scoreColor(50)).toBe("#eab308");
    expect(scoreColor(20)).toBe("#94a3b8");
  });
});
