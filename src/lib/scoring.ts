import type { BuildingFeature, Lead } from "../types/building";

export interface ScoringRules {
  areaWeight: number;            // 30
  powerWeight: number;           // 20
  noExistingPvWeight: number;    // 20
  verifiedCompanyWeight: number; // 15
  industryWeight: number;        // 15
}

export const DEFAULT_RULES: ScoringRules = {
  areaWeight: 30,
  powerWeight: 20,
  noExistingPvWeight: 20,
  verifiedCompanyWeight: 15,
  industryWeight: 15,
};

export interface ScoreResult {
  score: number;             // 0–100
  explanations: string[];    // PT-language reasons
}

/**
 * Calculate a 0–100 lead score with PT-language explanations.
 * Adapted from PYE-Prospect-Studio (LuisPCFialho/PYE-Prospect-Studio).
 */
export function scoreLead(
  building: BuildingFeature,
  lead: Partial<Lead> | undefined,
  rules: ScoringRules = DEFAULT_RULES,
): ScoreResult {
  let score = 0;
  const explanations: string[] = [];

  // 1. Usable area (0–100 scaled, capped at 10 000 m²)
  const usableSqm = building.areaSqm * 0.65;
  const areaMax = 10_000;
  const areaScore = Math.min((usableSqm / areaMax) * 100, 100);
  score += (areaScore * rules.areaWeight) / 100;
  if (usableSqm > 3000) explanations.push("Área útil excepcional (>3000 m²)");
  else if (usableSqm > 1000) explanations.push("Boa área útil (>1000 m²)");
  else explanations.push("Área útil moderada");

  // 2. Power potential
  const kwp = lead?.estimatedKwp ?? (usableSqm * 0.18);
  const powerMax = 1000;
  const powerScore = Math.min((kwp / powerMax) * 100, 100);
  score += (powerScore * rules.powerWeight) / 100;
  if (kwp > 400) explanations.push("Excelente potência preliminar (>400 kWp)");
  else if (kwp > 100) explanations.push("Potência interessante (>100 kWp)");

  // 3. Absence of existing PV
  if (lead?.hasExistingPv === "no" || lead?.solarStatus === "no_panels") {
    score += rules.noExistingPvWeight;
    explanations.push("Sem painéis FV existentes — oportunidade aberta");
  } else if (
    lead?.hasExistingPv === "unknown" ||
    lead?.solarStatus === "unknown" ||
    lead?.solarStatus === "inconclusive" ||
    !lead?.hasExistingPv
  ) {
    score += rules.noExistingPvWeight / 2;
    explanations.push("Estado FV desconhecido — verificar in loco");
  } else if (lead?.solarStatus === "partial") {
    score += rules.noExistingPvWeight * 0.7;
    explanations.push("Cobertura parcial — possível expansão");
  } else {
    explanations.push("Já tem painéis instalados");
  }

  // 4. Verified/identified company
  if (lead?.company && lead.company.trim().length > 0) {
    score += rules.verifiedCompanyWeight;
    explanations.push("Empresa identificada");
  } else {
    explanations.push("Sem empresa associada — necessita pesquisa");
  }

  // 5. Industry/consumption profile
  if (lead?.cae && lead.cae.trim().length > 0) {
    score += rules.industryWeight;
    explanations.push("CAE definido — perfil de consumo C&I");
  } else if (lead?.buildingUse && lead.buildingUse !== "other") {
    score += rules.industryWeight * 0.7;
    explanations.push("Setor identificado — provável consumo diurno");
  }

  return {
    score: Math.round(Math.max(0, Math.min(score, 100))),
    explanations,
  };
}

export function scoreColor(score: number): string {
  if (score >= 75) return "#22c55e"; // green
  if (score >= 50) return "#facc15"; // yellow
  if (score >= 25) return "#f97316"; // orange
  return "#ef4444";                  // red
}

export function scoreLabel(score: number): string {
  if (score >= 75) return "Excelente";
  if (score >= 50) return "Bom";
  if (score >= 25) return "Moderado";
  return "Fraco";
}
