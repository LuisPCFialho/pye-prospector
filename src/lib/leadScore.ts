/**
 * Transparent, explainable lead scoring (0-100) for solar C&I prospecting.
 * Higher = better prospect. Every sub-score is shown so the salesperson
 * understands WHY a lead ranks where it does.
 */
import type { BuildingFeature, Lead, BuildingUse } from "../types/building";
import { estimatePeakPower } from "./pvgis";

/** Daytime-load fit per sector (0-1): how well consumption matches solar production. */
const SECTOR_FIT: Record<BuildingUse, number> = {
  food_beverage: 1.0,
  metalwork: 0.95,
  logistics: 0.85,
  agriculture: 0.8,
  retail: 0.7,
  hotels: 0.6,
  office: 0.55,
  other: 0.5,
};

export interface ScoreBreakdown {
  score: number;
  parts: { label: string; pts: number; max: number }[];
}

export function scoreLead(building: BuildingFeature, lead?: Lead): ScoreBreakdown {
  const parts: { label: string; pts: number; max: number }[] = [];

  // 1) System size from roof area (35 pts) — bigger roof = bigger deal
  const kwp = lead?.estimatedKwp ?? estimatePeakPower(building.areaSqm);
  const sizePts = Math.min(35, Math.round((kwp / 500) * 35));
  parts.push({ label: "Dimensão (kWp)", pts: sizePts, max: 35 });

  // 2) Sector self-consumption fit (25 pts)
  const use = lead?.buildingUse ?? building.inferredUse ?? "other";
  const fitPts = Math.round(SECTOR_FIT[use] * 25);
  parts.push({ label: "Setor / autoconsumo", pts: fitPts, max: 25 });

  // 3) No existing PV (20 pts) — already-equipped roofs are dead leads
  const hasPv = lead?.solarStatus === "has_panels" || lead?.hasExistingPv === "yes";
  parts.push({ label: "Sem PV existente", pts: hasPv ? 0 : 20, max: 20 });

  // 4) C&I confidence (10 pts) — is this really a commercial/industrial roof
  const ciPts = Math.round((building.ciScore ?? 0.2) * 10);
  parts.push({ label: "Perfil C&I", pts: ciPts, max: 10 });

  // 5) Contactability (10 pts) — do we know who to call
  let contactPts = 0;
  if (lead?.company) contactPts += 4;
  if (lead?.telephone || lead?.email) contactPts += 4;
  if (lead?.website) contactPts += 2;
  parts.push({ label: "Contactabilidade", pts: contactPts, max: 10 });

  const score = Math.max(0, Math.min(100, parts.reduce((a, p) => a + p.pts, 0)));
  return { score, parts };
}

/** Tailwind-friendly color for a score badge. */
export function scoreColor(score: number): string {
  if (score >= 70) return "#22c55e"; // green — hot
  if (score >= 45) return "#eab308"; // amber — warm
  return "#94a3b8";                  // grey — cold
}
