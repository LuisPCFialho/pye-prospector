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

export type DropReason =
  | "rooftop_shading"
  | "low_energy_consumption"
  | "incompatible_client_profile"
  | "insufficient_roof_space"
  | "poor_financial_viability"
  | "insufficient_structural_stability"
  | "client_not_interested"
  | "legal_zoning_restrictions"
  | "access_challenges"
  | "low_energy_yield"
  | "high_installation_costs"
  | "technical_constraints"
  | "inactive_client"
  | "outside_target_market"
  | "vacant_property"
  | "other"
  | "solar_installed_already";

export const DROP_REASON_LABELS: Record<DropReason, string> = {
  rooftop_shading: "Rooftop Shading Issues",
  low_energy_consumption: "Low Energy Consumption",
  incompatible_client_profile: "Incompatible Client Profile",
  insufficient_roof_space: "Insufficient Roof Space",
  poor_financial_viability: "Poor Financial Viability",
  insufficient_structural_stability: "Insufficient Structural Stability",
  client_not_interested: "Client Not Interested",
  legal_zoning_restrictions: "Legal or Zoning Restrictions",
  access_challenges: "Access Challenges for Installation",
  low_energy_yield: "Low Energy Yield Potential",
  high_installation_costs: "High Installation Costs",
  technical_constraints: "Technical Constraints",
  inactive_client: "Inactive or Unresponsive Client",
  outside_target_market: "Project Outside Target Market/Scope",
  vacant_property: "Vacant Property",
  other: "Other",
  solar_installed_already: "Solar Installed Already",
};

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
  email?: string;
  notes?: string;
  tags?: string;
  owner?: string;
  nif?: string;
  buildingUse?: BuildingUse;
  hasExistingPv?: "yes" | "no" | "unknown";
  dropReason?: DropReason;
  flagged?: boolean;
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

/** Returns the MapLibre fill color for a building polygon */
export function buildingFillColor(
  solarStatus: SolarStatus | undefined,
  pipelineStage: PipelineStage | undefined,
  flagged?: boolean,
): string {
  if (flagged) return "#eab308";
  if (solarStatus === "has_panels") return "#22c55e";
  if (solarStatus === "partial") return "#f97316";
  if (pipelineStage === "contacted" || pipelineStage === "meeting") return "#eab308";
  if (pipelineStage === "proposal") return "#a78bfa";
  if (pipelineStage === "won") return "#22c55e";
  if (pipelineStage === "lost") return "#475569";
  return "#ef4444";
}
