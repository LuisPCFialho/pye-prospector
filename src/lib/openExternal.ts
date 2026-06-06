import { invoke } from "@tauri-apps/api/core";

/**
 * Open a URL in the OS default browser.
 * Uses a direct Rust command (open_url) which calls `cmd /c start` on Windows —
 * bypasses all Tauri CSP and plugin-permission complexity.
 * Falls back to window.open() in the browser dev environment.
 */
export async function openExternal(url: string): Promise<void> {
  if (!url) return;
  try {
    await invoke("open_url", { url });
  } catch {
    // Browser context (dev server) — invoke doesn't exist, use window.open
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// ── Official Google Maps URLs API (api=1) — no API key, documented & stable ──
// https://developers.google.com/maps/documentation/urls/get-started

/** URL-encoded "lat,lon" pair (comma must be %2C). */
function coord(lat: number, lon: number): string {
  return `${lat}%2C${lon}`;
}

/** Satellite map view centered at coordinates. */
export function googleMapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=map&center=${coord(lat, lon)}&zoom=18&basemap=satellite`;
}

/** Street View panorama at coordinates (reliable pano open). */
export function streetViewUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coord(lat, lon)}`;
}

/** Search for businesses near a coordinate. */
export function googleNearbySearchUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${coord(lat, lon)}`;
}

/**
 * "Verify on Google" — drops a pin at the exact centroid and surfaces Google's
 * own business label/place card if one is registered there. The best free way
 * to confirm which company occupies a footprint. If a company name is known,
 * it name-matches near the coordinate in one shot.
 */
export function googleVerifyUrl(lat: number, lon: number, company?: string): string {
  if (company && company.trim() && company !== "(sem nome — verificar)") {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.trim())}%20${coord(lat, lon)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${coord(lat, lon)}`;
}

/** Driving directions to a coordinate. */
export function directionsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${coord(lat, lon)}&travelmode=driving`;
}
