import { describe, it, expect } from "vitest";
import { packRoof, rowGapMeters, TRINA_630 } from "./panelLayout";

/** Build a rectangle of exact metric dimensions at a location, optionally rotated. */
function rectRoof(
  lon0: number,
  lat0: number,
  widthM: number,
  heightM: number,
  rotDeg = 0,
): GeoJSON.Polygon {
  const mLat = 111_320;
  const mLon = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const a = (rotDeg * Math.PI) / 180;
  const corners: [number, number][] = [
    [-widthM / 2, -heightM / 2],
    [widthM / 2, -heightM / 2],
    [widthM / 2, heightM / 2],
    [-widthM / 2, heightM / 2],
  ];
  const ring = corners.map(([x, y]) => {
    const rx = x * Math.cos(a) - y * Math.sin(a);
    const ry = x * Math.sin(a) + y * Math.cos(a);
    return [lon0 + rx / mLon, lat0 + ry / mLat];
  });
  ring.push(ring[0]);
  return { type: "Polygon", coordinates: [ring] };
}

const LON = -9.0;
const LAT = 38.72;

describe("rowGapMeters (winter-solstice no-shade spacing)", () => {
  it("computes the documented gap for a 10° tilt at Lisbon latitude", () => {
    // alpha = 90 - 38.72 - 23.45 = 27.83°; gap = L*sin(tilt)/tan(alpha)
    const gap = rowGapMeters(TRINA_630.length, 10, LAT);
    expect(gap).toBeCloseTo(0.714, 1);
  });

  it("is zero at zero tilt (flat-mounted, no inter-row shading)", () => {
    expect(rowGapMeters(2.172, 0, LAT)).toBe(0);
  });

  it("grows with tilt", () => {
    expect(rowGapMeters(2.172, 25, LAT)).toBeGreaterThan(rowGapMeters(2.172, 10, LAT));
  });
});

describe("packRoof", () => {
  it("places a sensible number of modules on a large flat roof", () => {
    const roof = rectRoof(LON, LAT, 100, 50); // 5000 m²
    const r = packRoof(roof, { lat: LAT, mount: "flat", tiltDeg: 10 });
    expect(r.modules).toBeGreaterThan(300);
    // kWp must equal modules * 630W / 1000 (rounded to 0.1)
    expect(r.kwp).toBeCloseTo(Math.round((r.modules * TRINA_630.wp) / 100) / 10, 1);
    // every placed panel is a closed polygon
    expect(r.panels.length).toBe(r.modules);
    expect(r.panels[0].geometry.coordinates[0].length).toBe(5);
  });

  it("is orientation-invariant: a rotated roof packs ~the same count", () => {
    const counts = [0, 37, 90].map(
      (deg) => packRoof(rectRoof(LON, LAT, 100, 50, deg), { lat: LAT, mount: "flat", tiltDeg: 10 }).modules,
    );
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    expect(min).toBeGreaterThan(0);
    // tolerate small edge/setback effects from rotation
    expect((max - min) / max).toBeLessThan(0.06);
  });

  it("subtracting an obstacle reduces the module count", () => {
    const roof = rectRoof(LON, LAT, 100, 50);
    const obstacle = rectRoof(LON, LAT, 30, 30); // central UTA block
    const base = packRoof(roof, { lat: LAT, mount: "flat", tiltDeg: 10 });
    const withObs = packRoof(roof, { lat: LAT, mount: "flat", tiltDeg: 10, obstacles: [obstacle] });
    expect(withObs.modules).toBeLessThan(base.modules);
    expect(withObs.modules).toBeGreaterThan(0);
  });

  it("returns empty for a roof smaller than the setback inset", () => {
    const tiny = rectRoof(LON, LAT, 1.5, 1.5);
    const r = packRoof(tiny, { lat: LAT, setbackM: 1.0 });
    expect(r.modules).toBe(0);
    expect(r.kwp).toBe(0);
    expect(r.panels).toHaveLength(0);
  });

  it("applies the obstacle derate to the headline kWp", () => {
    const roof = rectRoof(LON, LAT, 80, 40);
    const r = packRoof(roof, { lat: LAT, mount: "flat", tiltDeg: 10, obstacleDerate: 0.85 });
    expect(r.kwpDerated).toBeCloseTo(Math.round((r.modules * TRINA_630.wp * 0.85) / 100) / 10, 1);
    expect(r.kwpDerated).toBeLessThan(r.kwp);
  });

  it("packs a pitched roof more densely than a flat one (no row gaps)", () => {
    const roof = rectRoof(LON, LAT, 60, 40);
    const flat = packRoof(roof, { lat: LAT, mount: "flat", tiltDeg: 10 });
    const pitched = packRoof(roof, { lat: LAT, mount: "pitched" });
    expect(pitched.modules).toBeGreaterThan(flat.modules);
  });
});
