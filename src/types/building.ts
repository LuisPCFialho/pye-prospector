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
  rawTags?: Record<string, string>;
}

export interface Lead {
  id: string;
  buildingId: string;
  address?: string;
  solarStatus: SolarStatus;
  pipelineStage: PipelineStage;
  estimatedKwhPerYear?: number;
  estimatedKwp?: number;
  monthlyKwh?: number[];
  company?: string;
  telephone?: string;
  website?: string;
  notes?: string;
  tags?: string;
  owner?: string;
  createdAt: string;
  updatedAt: string;
}

export const SOLAR_STATUS_LABELS: Record<SolarStatus, string> = {
  unknown: "Desconhecido",
  no_panels: "Sem painéis",
  has_panels: "Com painéis",
  partial: "Parcial",
  inconclusive: "Inconclusivo",
};

export const PIPELINE_LABELS: Record<PipelineStage, string> = {
  to_contact: "Por contactar",
  contacted: "Contactado",
  meeting: "Reunião",
  proposal: "Proposta",
  won: "Ganho",
  lost: "Perdido",
};

export const SOLAR_STATUS_COLORS: Record<SolarStatus, string> = {
  unknown: "#94a3b8",
  no_panels: "#ef4444",
  has_panels: "#22c55e",
  partial: "#f97316",
  inconclusive: "#a78bfa",
};

export const PIPELINE_COLORS: Record<PipelineStage, string> = {
  to_contact: "#94a3b8",
  contacted: "#60a5fa",
  meeting: "#f97316",
  proposal: "#a78bfa",
  won: "#22c55e",
  lost: "#ef4444",
};
