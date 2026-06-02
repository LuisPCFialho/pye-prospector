import { invoke } from "@tauri-apps/api/core";

/**
 * Open a URL in the OS default browser.
 * Uses a direct Rust command (open_url) which calls `cmd /c start` on Windows —
 * bypasses all Tauri CSP and plugin-permission complexity.
 * Falls back to window.open() in the browser dev environment.
 */
export async function openExternal(url: string): Promise<void> {
  try {
    await invoke("open_url", { url });
  } catch {
    // Browser context (dev server) — invoke doesn't exist, use window.open
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Opens directly in Google Street View at the given coordinates. */
export function streetViewUrl(lat: number, lon: number): string {
  // @lat,lon,3a = street view mode; 75y = FOV; 90t = tilt; data=!3m6!1e1 = street view layer
  return `https://www.google.com/maps/@${lat},${lon},3a,75y,90t/data=!3m6!1e1`;
}

/** Google Maps satellite view centered on coordinates. */
export function googleMapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/@${lat},${lon},18z/data=!3m1!1e3`;
}

/** Google Maps search for businesses near a coordinate. */
export function googleNearbySearchUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/empresas/@${lat},${lon},17z`;
}
