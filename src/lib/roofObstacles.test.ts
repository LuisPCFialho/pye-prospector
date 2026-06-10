import { describe, expect, it } from "vitest";
import * as turf from "@turf/turf";
import {
  boxesToObstacles,
  lonLatToWorldPx,
  worldPxToLonLat,
  type DetectionBox,
} from "./roofObstacles";

// ── Web-Mercator helpers ──────────────────────────────────────────────────────

describe("lonLatToWorldPx / worldPxToLonLat", () => {
  it("maps (0,0) to the center of the world at every zoom", () => {
    for (const z of [0, 1, 17, 20]) {
      const scale = 256 * Math.pow(2, z);
      const { x, y } = lonLatToWorldPx(0, 0, z);
      expect(x).toBeCloseTo(scale / 2, 6);
      expect(y).toBeCloseTo(scale / 2, 6);
    }
  });

  it("round-trips lon/lat with <1e-6 degree error", () => {
    const points: [number, number][] = [
      [-9.1393, 38.7223], // Lisbon
      [-8.6109, 41.1496], // Porto
      [0, 0],
      [179.9, -85],
      [-179.9, 85],
    ];
    for (const [lon, lat] of points) {
      for (const z of [17, 18, 19, 20]) {
        const wp = lonLatToWorldPx(lon, lat, z);
        const back = worldPxToLonLat(wp.x, wp.y, z);
        expect(Math.abs(back.lon - lon)).toBeLessThan(1e-6);
        expect(Math.abs(back.lat - lat)).toBeLessThan(1e-6);
      }
    }
  });

  it("world y grows southward", () => {
    const north = lonLatToWorldPx(-9.14, 38.73, 19);
    const south = lonLatToWorldPx(-9.14, 38.72, 19);
    expect(south.y).toBeGreaterThan(north.y);
  });
});

// ── boxesToObstacles ──────────────────────────────────────────────────────────

// Synthetic 1000×1000 world-px image at z=19 near Lisbon. With imgW = 1000 =
// the box_2d normalization base, normalized units == world-px offsets, so the
// expected geometry is computed from the same mercator formulas.
const Z = 19;
const ORIGIN = lonLatToWorldPx(-9.1405, 38.7235, Z);
const IMG_W = 1000;
const IMG_H = 1000;
// Ground meters per world px at the test latitude.
const MPP = (156543.03392 * Math.cos((38.7235 * Math.PI) / 180)) / Math.pow(2, Z);

function imgPxToLonLat(ix: number, iy: number): [number, number] {
  const { lon, lat } = worldPxToLonLat(ORIGIN.x + ix, ORIGIN.y + iy, Z);
  return [lon, lat];
}

// Roof: square from image px (200,200) to (800,800) ≈ 140 m × 140 m.
const ROOF: GeoJSON.Polygon = {
  type: "Polygon",
  coordinates: [[
    imgPxToLonLat(200, 200),
    imgPxToLonLat(800, 200),
    imgPxToLonLat(800, 800),
    imgPxToLonLat(200, 800),
    imgPxToLonLat(200, 200),
  ]],
};

function box(
  b: [number, number, number, number],
  confidence = 0.9,
  label = "hvac",
): DetectionBox {
  return { box_2d: b, label, confidence };
}

function run(boxes: DetectionBox[], roof: GeoJSON.Polygon | GeoJSON.MultiPolygon = ROOF) {
  return boxesToObstacles(boxes, IMG_W, IMG_H, ORIGIN, Z, roof);
}

describe("boxesToObstacles", () => {
  it("keeps a centered box, clipped inside the roof, with label and confidence", () => {
    // box_2d is [ymin, xmin, ymax, xmax]: 100 world px square at image center.
    const result = run([box([450, 450, 550, 550])]);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("hvac");
    expect(result[0].confidence).toBe(0.9);
    expect(turf.booleanWithin(result[0].polygon, ROOF)).toBe(true);
    // Expected: 100 px × MPP per side, +0.3 m buffer on each side.
    const side = 100 * MPP + 0.6;
    const area = turf.area(result[0].polygon);
    expect(area).toBeGreaterThan(side * side * 0.9);
    expect(area).toBeLessThan(side * side * 1.1);
  });

  it("drops a box entirely outside the roof", () => {
    expect(run([box([0, 0, 100, 100])])).toHaveLength(0);
  });

  it("drops a low-confidence box", () => {
    expect(run([box([450, 450, 550, 550], 0.2)])).toHaveLength(0);
  });

  it("drops an oversized box (clipped area > 40% of the roof)", () => {
    expect(run([box([150, 150, 850, 850], 0.95)])).toHaveLength(0);
  });

  it("clips a box straddling the roof edge to the roof", () => {
    // Box spans image y 150..250; the roof starts at y=200 (its northern edge).
    const result = run([box([150, 400, 250, 600])]);
    expect(result).toHaveLength(1);
    const roofNorthLat = imgPxToLonLat(200, 200)[1];
    for (const [, lat] of result[0].polygon.coordinates[0]) {
      expect(lat).toBeLessThanOrEqual(roofNorthLat + 1e-9);
    }
    // Expected clip: 200 px wide (+0.6 m buffer), 50 px tall (+0.3 m south buffer).
    const expected = (200 * MPP + 0.6) * (50 * MPP + 0.3);
    const area = turf.area(result[0].polygon);
    expect(area).toBeGreaterThan(expected * 0.9);
    expect(area).toBeLessThan(expected * 1.1);
  });

  it("drops a degenerate zero-size box", () => {
    expect(run([box([300, 300, 300, 300])])).toHaveLength(0);
  });

  it("returns [] for an empty box list", () => {
    expect(run([])).toHaveLength(0);
  });

  it("clips against each sub-polygon of a MultiPolygon roof", () => {
    // Two roof parts: left (200..450) and right (550..800) in image x.
    const multi: GeoJSON.MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [
        [[
          imgPxToLonLat(200, 200), imgPxToLonLat(450, 200),
          imgPxToLonLat(450, 800), imgPxToLonLat(200, 800),
          imgPxToLonLat(200, 200),
        ]],
        [[
          imgPxToLonLat(550, 200), imgPxToLonLat(800, 200),
          imgPxToLonLat(800, 800), imgPxToLonLat(550, 800),
          imgPxToLonLat(550, 200),
        ]],
      ],
    };
    // Box centered on the second (right) part only.
    const result = run([box([450, 600, 550, 700], 0.8, "skylight")], multi);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("skylight");
    const rightPart: GeoJSON.Polygon = { type: "Polygon", coordinates: multi.coordinates[1] };
    expect(turf.booleanWithin(result[0].polygon, rightPart)).toBe(true);
  });
});
