import * as turf from "@turf/turf";
import { config } from "../config";
import type { BuildingFeature } from "../types/building";

export interface BBox {
  minLon: number; minLat: number; maxLon: number; maxLat: number;
}

interface OverpassElement {
  type: "way" | "relation";
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

const CI_FILTER = `["building"~"^(industrial|warehouse|commercial|retail|factory|manufacture|supermarket|hangar|office|public|hospital|school|university|shop|service|storage)$"]`;

function buildQuery(bbox: BBox): string {
  const { minLat, minLon, maxLat, maxLon } = bbox;
  return `[out:json][timeout:60];
(
  way${CI_FILTER}(${minLat},${minLon},${maxLat},${maxLon});
);
out geom tags;`;
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
  const res = await fetch(config.overpassUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(buildQuery(bbox))}`,
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${await res.text()}`);

  const data = await res.json() as { elements: OverpassElement[] };
  return data.elements
    .map(elementToBuilding)
    .filter((b): b is BuildingFeature => b !== null);
}

export function buildingsToGeoJSON(
  buildings: BuildingFeature[],
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: buildings.map((b) => ({
      type: "Feature" as const,
      id: b.osmId,
      properties: { ...b, geometryGeoJSON: undefined },
      geometry: b.geometryGeoJSON,
    })),
  };
}
