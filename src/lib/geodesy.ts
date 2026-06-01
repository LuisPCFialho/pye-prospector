/**
 * High-precision geodetic area calculation for Portuguese latitudes.
 * Uses Shoelace formula with WGS84 correction (meters per degree varies with latitude).
 * Returns area in square meters.
 */
export function calculateGeodeticArea(coords: [number, number][]): number {
  if (coords.length < 3) return 0;
  const numPoints = coords.length;
  const isClosed =
    coords[0][0] === coords[numPoints - 1][0] &&
    coords[0][1] === coords[numPoints - 1][1];
  const len = isClosed ? numPoints - 1 : numPoints;

  let totalArea = 0;
  for (let i = 0; i < len; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[(i + 1) % len];
    const meanLatRad = ((lat1 + lat2) / 2) * (Math.PI / 180);

    // WGS84-corrected meters per degree
    const mPerDegLat =
      111132.954 -
      559.822 * Math.cos(2 * meanLatRad) +
      1.175 * Math.cos(4 * meanLatRad);
    const mPerDegLng =
      111412.84 * Math.cos(meanLatRad) - 93.5 * Math.cos(3 * meanLatRad);

    const x1 = lng1 * mPerDegLng;
    const y1 = lat1 * mPerDegLat;
    const x2 = lng2 * mPerDegLng;
    const y2 = lat2 * mPerDegLat;

    totalArea += x1 * y2 - x2 * y1;
  }
  return Math.abs(totalArea / 2);
}

/** Centroid of a closed polygon ring */
export function calculateCentroid(coords: [number, number][]): [number, number] {
  let lon = 0;
  let lat = 0;
  const n = coords.length - (coords[0][0] === coords[coords.length - 1][0] ? 1 : 0);
  for (let i = 0; i < n; i++) {
    lon += coords[i][0];
    lat += coords[i][1];
  }
  return [lon / n, lat / n];
}

/** Convert area in m² to kWp using rooftop usable area heuristic */
export function areaToKwp(
  areaSqm: number,
  options: {
    usableFraction?: number;   // 0–1, default 0.65 (rooftops with obstacles)
    modulePowerWp?: number;    // typical bifacial 550Wp
    moduleAreaSqm?: number;    // typical 2.58 m² per module
  } = {},
): { kwp: number; modules: number; usableSqm: number } {
  const usableFraction = options.usableFraction ?? 0.65;
  const modulePowerWp = options.modulePowerWp ?? 550;
  const moduleAreaSqm = options.moduleAreaSqm ?? 2.58;

  const usableSqm = areaSqm * usableFraction;
  const modules = Math.floor(usableSqm / moduleAreaSqm);
  const kwp = Math.round((modules * modulePowerWp) / 100) / 10;
  return { kwp, modules, usableSqm };
}
