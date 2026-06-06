/**
 * Look up the company/business at a building location using OSM POIs.
 * Uses a targeted nwr query for business tags, ranks candidates by whether the
 * POI falls INSIDE the building polygon, tag strength, contact info, and distance.
 */
import * as turf from "@turf/turf";
import type { CompanyCandidate } from "../types/building";

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

interface OSMElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  lat?: number; lon?: number;
  center?: { lat: number; lon: number };
}

/** Targeted query: only business-bearing tags, within radius. */
function buildPOIQuery(lat: number, lon: number, radiusM: number): string {
  const a = `(around:${radiusM},${lat},${lon})`;
  return `[out:json][timeout:15];
(
  nwr["office"]["name"]${a};
  nwr["shop"]["name"]${a};
  nwr["craft"]["name"]${a};
  nwr["industrial"]${a};
  nwr["man_made"="works"]["name"]${a};
  nwr["amenity"]["name"]${a};
  nwr["name"]["operator"]${a};
  nwr["name"]["brand"]${a};
  nwr["name"]["website"]${a};
);
out center tags;`;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cleanNif(raw?: string): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/^PT/i, "").replace(/\D/g, "");
  return digits.length === 9 ? digits : undefined;
}

function elementToCandidate(
  el: OSMElement,
  refLat: number,
  refLon: number,
  polygon?: GeoJSON.Polygon | GeoJSON.MultiPolygon,
): CompanyCandidate | null {
  const tags = el.tags ?? {};
  const name = tags.name;
  if (!name) return null;
  // Reject generic infrastructure
  if (tags.highway || tags.waterway || tags.railway || tags.natural || tags.place) return null;
  if (tags.landuse === "residential") return null;

  const lat = el.center?.lat ?? el.lat;
  const lon = el.center?.lon ?? el.lon;
  const distanceM = lat != null && lon != null ? Math.round(haversine(refLat, refLon, lat, lon)) : 999;

  // Scoring
  let score = 0;
  let inside = false;
  if (polygon && lat != null && lon != null) {
    try {
      inside = turf.booleanPointInPolygon(turf.point([lon, lat]), polygon);
    } catch { /* ignore */ }
  }
  if (inside) score += 4;
  if (tags.office || tags.industrial || tags.man_made === "works") score += 2;
  else if (tags.shop || tags.craft) score += 1.5;
  else if (tags.amenity) score += 1;
  if (tags.operator || tags.brand) score += 1;
  if (tags["contact:website"] || tags.website) score += 0.5;
  score -= distanceM / 40; // closer is better

  return {
    name: tags.operator || name,
    nif: cleanNif(tags["ref:vatin"] || tags["ref:vatin:PT"]),
    website: tags["contact:website"] || tags.website || undefined,
    phone: tags["contact:phone"] || tags.phone || tags["contact:mobile"] || undefined,
    email: tags["contact:email"] || tags.email || undefined,
    source: "osm",
    score,
    distanceM,
    sourceUrl: el.type && el.id ? `https://www.openstreetmap.org/${el.type}/${el.id}` : undefined,
  };
}

async function queryOverpass(query: string): Promise<OSMElement[]> {
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12_000);
      const res = await fetch(mirror, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));
      if (!res.ok) continue;
      let data: { elements: OSMElement[] };
      try { data = await res.json(); } catch { continue; }
      return data.elements ?? [];
    } catch { /* next mirror */ }
  }
  return [];
}

/**
 * Find business candidates near a building. Starts with a tight radius (30m),
 * expands to 80m only if nothing found. Candidates inside the polygon rank highest.
 */
export async function findNearbyBusinesses(
  lat: number,
  lon: number,
  polygon?: GeoJSON.Polygon | GeoJSON.MultiPolygon,
): Promise<CompanyCandidate[]> {
  let elements = await queryOverpass(buildPOIQuery(lat, lon, 30));
  if (elements.length === 0) {
    elements = await queryOverpass(buildPOIQuery(lat, lon, 80));
  }

  const candidates = elements
    .map((el) => elementToCandidate(el, lat, lon, polygon))
    .filter((c): c is CompanyCandidate => c !== null);

  // Sort by score desc, dedupe by normalized name
  candidates.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = normalizeName(c.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Normalize a company name for dedup (strip legal suffixes, lowercase). */
export function normalizeName(n: string | undefined | null): string {
  if (!n) return "";
  return n
    .toLowerCase()
    // strip Portuguese legal forms (longest/most specific first)
    .replace(/\b(unipessoal\s+lda|sociedade\s+an[oó]nima|s\.a\.|lda\.?|s\.a|sa)\b/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
