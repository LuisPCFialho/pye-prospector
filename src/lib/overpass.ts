import { config } from "../config";

export interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface OverpassElement {
  type: "way" | "relation" | "node";
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  members?: { type: string; ref: number; role: string; geometry?: { lat: number; lon: number }[] }[];
}

const COMMERCIAL_INDUSTRIAL_FILTER = `
  ["building"~"^(industrial|warehouse|commercial|retail|factory|manufacture|supermarket|hangar|hospital|office|public|school|university)$"]
`;

/**
 * Fetch commercial/industrial building footprints within a bounding box.
 * Uses Overpass QL with `out geom` to get polygon geometry inline.
 */
export async function fetchBuildingsInBBox(bbox: BBox, minAreaSqm = 300): Promise<OverpassElement[]> {
  const { minLat, minLon, maxLat, maxLon } = bbox;
  const query = `
    [out:json][timeout:60];
    (
      way${COMMERCIAL_INDUSTRIAL_FILTER}(${minLat},${minLon},${maxLat},${maxLon});
      relation${COMMERCIAL_INDUSTRIAL_FILTER}(${minLat},${minLon},${maxLat},${maxLon});
    );
    out geom tags;
  `;

  const res = await fetch(config.overpassUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass error ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as { elements: OverpassElement[] };
  return data.elements.filter((el) => estimateArea(el) >= minAreaSqm);
}

/**
 * Rough area estimate from inline geometry (planar approximation, good enough for filter).
 * For precise areas use Turf.js with the converted GeoJSON polygon.
 */
function estimateArea(el: OverpassElement): number {
  const coords = el.geometry;
  if (!coords || coords.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    area += (b.lon - a.lon) * (b.lat + a.lat);
  }
  const meanLat = (coords[0].lat * Math.PI) / 180;
  const mPerDegLat = 111_320;
  const mPerDegLon = 111_320 * Math.cos(meanLat);
  return Math.abs((area / 2) * mPerDegLat * mPerDegLon);
}
