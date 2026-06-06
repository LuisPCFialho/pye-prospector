import { config } from "../config";

/**
 * Find the nearest Mapillary image to a coordinate.
 * Returns image key or null if not found / no token.
 */
export async function findNearestImage(lat: number, lon: number): Promise<string | null> {
  if (!config.mapillaryClientToken) return null;
  const delta = 0.001;
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
  const url =
    `https://graph.mapillary.com/images?access_token=${config.mapillaryClientToken}` +
    `&bbox=${bbox}&fields=id,geometry&limit=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** Embed URL for a Mapillary image key (encoded to prevent URL injection). */
export function mapillaryEmbedUrl(imageKey: string): string {
  return `https://www.mapillary.com/embed?image_key=${encodeURIComponent(imageKey)}&is_map=false`;
}

/** Google Maps Street View deep-link (no API key needed). */
export function googleStreetViewUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps?q=&layer=c&cbll=${lat},${lon}&cbp=12,90,0,0,5`;
}
