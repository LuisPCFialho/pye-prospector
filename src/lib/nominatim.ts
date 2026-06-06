import { config } from "../config";
import { timedFetch, createRateLimiter } from "./fetchUtils";

// Nominatim public instance allows ~1 req/sec — serialize all calls.
const nominatimLimiter = createRateLimiter(1100);

export interface ReverseGeocodeResult {
  displayName: string;
  /** Name of the nearest named OSM feature — often the business name itself. */
  name?: string;
  /** OSM class (shop, office, amenity, craft, industrial, building…). */
  osmClass?: string;
  osmType?: string;
  road?: string;
  houseNumber?: string;
  postcode?: string;
  city?: string;
  country?: string;
  /** From extratags — business contact info when available. */
  website?: string;
  phone?: string;
  operator?: string;
  brand?: string;
}

/** OSM classes that strongly indicate a business occupies the location. */
const BUSINESS_CLASSES = new Set([
  "shop", "office", "craft", "industrial", "commercial",
  "amenity", "tourism", "leisure", "man_made",
]);

/** True if the reverse-geocode result's named feature looks like a business. */
export function looksLikeBusiness(r: ReverseGeocodeResult): boolean {
  return !!r.name && !!r.osmClass && BUSINESS_CLASSES.has(r.osmClass);
}

/**
 * Reverse geocode lat/lon to address via OSM Nominatim.
 * Public instance is rate-limited to 1 req/sec — caller is responsible for throttling.
 * Returns the nearest NAMED feature (often the business) plus full address + extratags.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult | null> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    format: "jsonv2",
    addressdetails: "1",
    namedetails: "1",
    extratags: "1",
    zoom: "18",
  });

  let res: Response;
  try {
    res = await nominatimLimiter(() =>
      timedFetch(`${config.nominatimUrl}/reverse?${params.toString()}`, {
        headers: { "Accept-Language": "pt-PT,pt;q=0.9" },
        timeoutMs: 8_000,
        retries: 1,
      }),
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let data: Record<string, unknown>;
  try { data = await res.json(); }
  catch { return null; }
  if (!data?.display_name) return null;

  const addr = (data.address ?? {}) as Record<string, string>;
  const names = (data.namedetails ?? {}) as Record<string, string>;
  const extra = (data.extratags ?? {}) as Record<string, string>;

  return {
    displayName: String(data.display_name),
    name: (data.name as string) || names.name || undefined,
    osmClass: data.class as string | undefined,
    osmType: data.type as string | undefined,
    road: addr.road,
    houseNumber: addr.house_number,
    postcode: addr.postcode,
    city: addr.city ?? addr.town ?? addr.village ?? addr.municipality,
    country: addr.country,
    website: extra["contact:website"] || extra.website,
    phone: extra["contact:phone"] || extra.phone,
    operator: extra.operator,
    brand: extra.brand,
  };
}
