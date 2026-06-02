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

/** Google Street View deep-link (no API key needed). */
export function streetViewUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps?q=&layer=c&cbll=${lat},${lon}&cbp=12,90,0,0,5`;
}

/** Google Maps satellite view. */
export function googleMapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/@${lat},${lon},18z/data=!3m1!1e3`;
}
