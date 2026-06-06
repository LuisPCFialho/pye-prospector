/**
 * Unified company resolver. Orchestrates the full lookup pipeline:
 *   1. Reverse-geocode the centroid (Nominatim) → address anchors everything.
 *   2. Run Overpass POI search + Gemini (grounded) in parallel, both fed the address.
 *   3. Merge all sources into one confidence-scored, deduped candidate list.
 * Results are cached in-memory per building id for the session.
 */
import type { BuildingFeature, CompanyCandidate } from "../types/building";
import { reverseGeocode, looksLikeBusiness, type ReverseGeocodeResult } from "./nominatim";
import { findNearbyBusinesses, normalizeName } from "./companyLookup";
import { lookupCompanyWithGemini } from "./gemini";

export interface ResolveResult {
  candidates: CompanyCandidate[];
  address?: string;
  geo?: ReverseGeocodeResult;
}

const cache = new Map<string, ResolveResult>();

export function getCachedResolve(buildingId: string): ResolveResult | undefined {
  return cache.get(buildingId);
}

export async function resolveCompany(building: BuildingFeature): Promise<ResolveResult> {
  const cached = cache.get(building.id);
  if (cached) return cached;

  // 1. Reverse-geocode first
  const geo = await reverseGeocode(building.centroidLat, building.centroidLon).catch(() => null);
  const address = geo?.displayName;

  // 2. Overpass + Gemini in parallel, both anchored by the address
  const [osmCandidates, gemini] = await Promise.all([
    findNearbyBusinesses(building.centroidLat, building.centroidLon, building.geometryGeoJSON).catch(() => []),
    lookupCompanyWithGemini(building.centroidLat, building.centroidLon, {
      address,
      nominatimName: geo?.name,
      osmHint: building.operator ?? building.name,
    }).catch(() => null),
  ]);

  const candidates: CompanyCandidate[] = [...osmCandidates];

  // Nominatim named feature → candidate (free signal already fetched)
  if (geo?.name && looksLikeBusiness(geo)) {
    candidates.push({
      name: geo.operator || geo.brand || geo.name,
      website: geo.website,
      phone: geo.phone,
      address,
      source: "nominatim",
      score: 2.5,
    });
  }

  // Gemini grounded result → candidate
  if (gemini?.name) {
    const confScore = gemini.confidence === "high" ? 3.5 : gemini.confidence === "medium" ? 2.5 : 1;
    candidates.push({
      name: gemini.name,
      nif: gemini.nif,
      website: gemini.website,
      phone: gemini.phone,
      email: gemini.email,
      address,
      source: "gemini",
      score: confScore + (gemini.sourceUrl ? 0.5 : 0),
      sourceUrl: gemini.sourceUrl,
    });
  }

  // Building's own OSM operator/name tag → candidate
  const ownName = building.operator || building.name;
  if (ownName) {
    candidates.push({
      name: ownName,
      address,
      source: "osm",
      score: 3, // on the building itself = strong
      distanceM: 0,
    });
  }

  // Merge: sort by score desc, dedupe by normalized name (merge fields)
  candidates.sort((a, b) => b.score - a.score);
  const merged: CompanyCandidate[] = [];
  const seen = new Map<string, CompanyCandidate>();
  for (const c of candidates) {
    const key = c.nif || normalizeName(c.name);
    if (!key) continue;
    const existing = seen.get(key);
    if (existing) {
      // Enrich existing with any missing fields from lower-ranked duplicate
      existing.website ??= c.website;
      existing.phone ??= c.phone;
      existing.email ??= c.email;
      existing.nif ??= c.nif;
      existing.sourceUrl ??= c.sourceUrl;
    } else {
      seen.set(key, c);
      merged.push(c);
    }
  }

  const result: ResolveResult = { candidates: merged, address, geo: geo ?? undefined };
  cache.set(building.id, result);
  return result;
}
