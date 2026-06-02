/**
 * Open a URL in the user's default browser.
 * In Tauri, window.open() is blocked — we use the opener plugin instead.
 * In the browser (dev server), falls back to window.open().
 */
export async function openExternal(url: string): Promise<void> {
  try {
    // Dynamic import so the browser build doesn't break if the plugin isn't present
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    // Browser context or plugin not available — use native window.open
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Open Google Maps Street View for a coordinate. */
export function streetViewUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps?q=&layer=c&cbll=${lat},${lon}&cbp=12,90,0,0,5`;
}

/** Open Google Maps satellite view centered on a coordinate. */
export function googleMapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/@${lat},${lon},18z/data=!3m1!1e3`;
}
