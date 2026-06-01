import { config } from "../config";

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

  const res = await fetch(`${config.nominatimUrl}/reverse?${params.toString()}`, {
    headers: { "User-Agent": config.userAgent, "Accept-Language": "pt-PT,pt;q=0.9" },
  });
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
