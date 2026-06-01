export type SolarStatus =
  | "unknown"
  | "no_panels"
  | "has_panels"
  | "partial"
  | "inconclusive";

export type PipelineStage =
  | "to_contact"
  | "contacted"
  | "meeting"
  | "proposal"
  | "won"
  | "lost";

export interface BuildingFeature {
  id: string;
  osmId?: number;
  source: "osm" | "ms_footprints" | "manual";
  geometryGeoJSON: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  centroidLon: number;
  centroidLat: number;
  areaSqm: number;
  buildingTag?: string;
  name?: string;
  operator?: string;
}

export interface Lead {
  id: string;
  buildingId: string;
  address?: string;
  solarStatus: SolarStatus;
  pipelineStage: PipelineStage;
  estimatedKwhPerYear?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
