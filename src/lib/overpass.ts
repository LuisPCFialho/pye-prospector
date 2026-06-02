import * as turf from "@turf/turf";
import type { BuildingFeature, Lead } from "../types/building";
import { buildingFillColor } from "../types/building";

export interface BBox {
  minLon: number; minLat: number; maxLon: number; maxLat: number;
}

interface OverpassElement {
  type: "way" | "relation";
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

const CI_FILTER = `["building"]`;

function buildQuery(bbox: BBox): string {
  const { minLat, minLon, maxLat, maxLon } = bbox;
  return `[out:json][timeout:25][maxsize:32000000];
(
  way${CI_FILTER}(${minLat},${minLon},${maxLat},${maxLon});
);
out geom tags;`;
}

async function tryMirror(url: string, query: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

function elementToBuilding(el: OverpassElement): BuildingFeature | null {
  if (!el.geometry || el.geometry.length < 3) return null;

  let coords = el.geometry.map((p) => [p.lon, p.lat] as [number, number]);
  if (
    coords[0][0] !== coords[coords.length - 1][0] ||
    coords[0][1] !== coords[coords.length - 1][1]
  ) {
    coords = [...coords, coords[0]];
  }

  const poly = turf.polygon([coords]);
  const areaSqm = Math.round(turf.area(poly));
  if (areaSqm < 200) return null;

  const c = turf.centroid(poly).geometry.coordinates;

  return {
    id: `osm_way_${el.id}`,
    osmId: el.id,
    source: "osm",
    geometryGeoJSON: poly.geometry,
    centroidLon: c[0],
    centroidLat: c[1],
    areaSqm,
    buildingTag: el.tags?.building,
    name: el.tags?.name ?? el.tags?.["name:en"],
    operator: el.tags?.operator,
    rawTags: el.tags,
  };
}

export async function fetchBuildingsInBBox(bbox: BBox): Promise<BuildingFeature[]> {
  const query = buildQuery(bbox);
  const errors: string[] = [];

  for (const mirror of MIRRORS) {
    try {
      const res = await tryMirror(mirror, query);

      if (!res.ok) {
        errors.push(`${mirror}: HTTP ${res.status}`);
        continue;
      }

      const text = await res.text();

      if (text.trimStart().startsWith("<")) {
        const msg = text.match(/<p[^>]*>.*?Error.*?<\/p>/s)?.[0]
          ?.replace(/<[^>]+>/g, "").trim()
          ?? "Overpass server error";
        errors.push(`${mirror}: ${msg.slice(0, 120)}`);
        continue;
      }

      const data = JSON.parse(text) as { elements: OverpassElement[] };
      return data.elements
        .map(elementToBuilding)
        .filter((b): b is BuildingFeature => b !== null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${mirror}: ${msg.slice(0, 80)}`);
    }
  }

  throw new Error(
    `Todos os servidores Overpass falharam:\n${errors.join("\n")}`
  );
}

/** Build GeoJSON, enriching each feature with lead status for map coloring. */
export function buildingsToGeoJSON(
  buildings: BuildingFeature[],
  leads?: Record<string, Lead>,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: buildings.map((b) => {
      const lead = leads?.[b.id];
      const color = buildingFillColor(lead?.solarStatus, lead?.pipelineStage, lead?.flagged);
      return {
        type: "Feature" as const,
        id: b.osmId,
        properties: {
          ...b,
          geometryGeoJSON: undefined,
          fillColor: color,
          solarStatus: lead?.solarStatus ?? "unknown",
          pipelineStage: lead?.pipelineStage ?? "to_contact",
          flagged: lead?.flagged ? 1 : 0,
        },
        geometry: b.geometryGeoJSON,
      };
    }),
  };
}
