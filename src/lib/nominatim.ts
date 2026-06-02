import { config } from "../config";
import { timedFetch } from "./fetchUtils";

export interface ReverseGeocodeResult {
  displayName: string;
  road?: string;
  houseNumber?: string;
  postcode?: string;
  city?: string;
  country?: string;
}

/**
 * Reverse geocode lat/lon to address via OSM Nominatim.
 * Public instance is rate-limited to 1 req/sec — caller is responsible for throttling.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult | null> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    format: "json",
    addressdetails: "1",
    zoom: "18",
  });

  let res: Response;
  try {
    res = await timedFetch(`${config.nominatimUrl}/reverse?${params.toString()}`, {
      headers: { "Accept-Language": "pt-PT,pt;q=0.9" },
      timeoutMs: 8_000,
      retries: 1,
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const data = await res.json();
  if (!data?.display_name) return null;

  const addr = data.address ?? {};
  return {
    displayName: data.display_name,
    road: addr.road,
    houseNumber: addr.house_number,
    postcode: addr.postcode,
    city: addr.city ?? addr.town ?? addr.village ?? addr.municipality,
    country: addr.country,
  };
}
