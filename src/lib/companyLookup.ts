/**
 * Look up nearby named OSM elements (POIs, ways, nodes) for a coordinate.
 * This finds businesses that are tagged separately from the building polygon —
 * common in Portugal where the company name is on a node inside the building.
 */

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export interface NearbyBusiness {
  name: string;
  operator?: string;
  brand?: string;
  phone?: string;
  website?: string;
  email?: string;
  nif?: string;
  amenity?: string;
  shop?: string;
  office?: string;
  industrial?: string;
  distance: number;
}

function buildPOIQuery(lat: number, lon: number, radiusM = 80): string {
  return `[out:json][timeout:10];
(
  node[name](around:${radiusM},${lat},${lon});
  way[name](around:${radiusM},${lat},${lon});
);
out center tags;`;
}

function elementToBusinesses(elements: Record<string, unknown>[], refLat: number, refLon: number): NearbyBusiness[] {
  const results: NearbyBusiness[] = [];
  for (const el of elements) {
    const tags = (el.tags ?? {}) as Record<string, string>;
    const name = tags.name;
    if (!name) continue;
    // Skip generic infrastructure (roads, rivers, etc.)
    if (tags.highway || tags.waterway || tags.railway || tags.natural || tags.landuse === "residential") continue;

    const center = (el.center ?? el) as { lat?: number; lon?: number };
    results.push({
      name,
      operator: tags.operator,
      brand: tags.brand,
      phone: tags["contact:phone"] || tags.phone,
      website: tags["contact:website"] || tags.website,
      email: tags["contact:email"] || tags.email,
      nif: tags["ref:vatin"]?.replace(/^PT/i, "").replace(/\D/g, "") || undefined,
      amenity: tags.amenity,
      shop: tags.shop,
      office: tags.office,
      industrial: tags.industrial,
      distance: center.lat
        ? Math.round(haversine(refLat, refLon, center.lat, center.lon ?? refLon))
        : 0,
    });
  }
  // Sort by distance, deduplicate by name
  results.sort((a, b) => a.distance - b.distance);
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.name.toLowerCase())) return false;
    seen.add(r.name.toLowerCase());
    return true;
  });
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function findNearbyBusinesses(
  lat: number,
  lon: number,
  radiusM = 80,
): Promise<NearbyBusiness[]> {
  const query = buildPOIQuery(lat, lon, radiusM);
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetch(mirror, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json() as { elements: Record<string, unknown>[] };
      return elementToBusinesses(data.elements ?? [], lat, lon);
    } catch {
      // try next mirror
    }
  }
  return [];
}
