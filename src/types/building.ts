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

export type BuildingUse =
  | "food_beverage"
  | "metalwork"
  | "logistics"
  | "retail"
  | "hotels"
  | "agriculture"
  | "office"
  | "other";

export interface BuildingFeature {
  id: string;
  osmId?: number;
  source: "osm" | "ms_footprints" | "manual" | "preset";
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
  score?: number;                    // 0-100 lead score
  scoreExplanations?: string[];      // PT-language explanations
  nif?: string;                      // Portuguese VAT
  cae?: string;                      // Activity code
  estimatedValueEur?: number;        // Deal value
  probability?: number;              // 0-100 win probability
  industrialPark?: string;           // Source park slug
  buildingUse?: BuildingUse;
  hasExistingPv?: "yes" | "no" | "unknown";
  createdAt: string;
  updatedAt: string;
}

export interface LeadNote {
  id: string;
  leadId: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface LeadTask {
  id: string;
  leadId: string;
  title: string;
  done: boolean;
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
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

export const BUILDING_USE_LABELS: Record<BuildingUse, string> = {
  food_beverage: "Alimentar/Bebidas",
  metalwork: "Metalúrgica",
  logistics: "Logística",
  retail: "Retalho",
  hotels: "Hotelaria",
  agriculture: "Agricultura",
  office: "Escritórios",
  other: "Outro",
};

/** Kanban macro-stages for the pipeline board */
export const KANBAN_COLUMNS: { id: PipelineStage[]; label: string; color: string }[] = [
  { id: ["to_contact"], label: "Prospeção", color: "#94a3b8" },
  { id: ["contacted", "meeting"], label: "Contacto", color: "#60a5fa" },
  { id: ["proposal"], label: "Proposta", color: "#a78bfa" },
  { id: ["won", "lost"], label: "Fecho", color: "#22c55e" },
];
