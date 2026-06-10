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

/**
 * Check if any nearby Mapillary image is tagged with solar panel detections.
 * Uses the Mapillary object detection API — returns "possible" (low confidence
 * visual hint, not authoritative) or null (no signal / no token).
 */
export async function detectSolarFromMapillary(
  lat: number,
  lon: number,
): Promise<"possible" | null> {
  if (!config.mapillaryClientToken) return null;
  const imageKey = await findNearestImage(lat, lon);
  if (!imageKey) return null;
  const url =
    `https://graph.mapillary.com/${encodeURIComponent(imageKey)}/detections` +
    `?access_token=${config.mapillaryClientToken}&fields=value&limit=50`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as { data?: { value: string }[] };
    const hasSolar = (data.data ?? []).some(
      (d) => /solar|panel|photovolt/i.test(d.value),
    );
    return hasSolar ? "possible" : null;
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
