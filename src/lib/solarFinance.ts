/**
 * Solar financial modelling for C&I rooftop prospecting in Portugal.
 * All figures are estimates for prospecting purposes, not formal quotes.
 */

export interface SolarFinance {
  systemKwp: number;
  annualKwh: number;
  /** Estimated turnkey CAPEX in € (installed). */
  investmentEur: number;
  /** Annual electricity-bill savings in €. */
  annualSavingsEur: number;
  /** Simple payback period in years. */
  paybackYears: number;
  /** Net present value over the system lifetime. */
  lifetimeSavingsEur: number;
  /** Annual CO2 avoided in tonnes. */
  co2TonnesPerYear: number;
}

// Portugal C&I assumptions (2026 ballpark)
const ELECTRICITY_PRICE_EUR_KWH = 0.16; // industrial tariff
const SELF_CONSUMPTION_RATE = 0.75;     // share of generation used on-site
const CO2_KG_PER_KWH = 0.19;            // PT grid emission factor
const SYSTEM_LIFETIME_YEARS = 25;
const ANNUAL_DEGRADATION = 0.005;       // 0.5%/year panel degradation

/** Tiered installed cost per kWp — larger systems are cheaper per kWp. */
function costPerKwp(kwp: number): number {
  if (kwp >= 500) return 650;
  if (kwp >= 250) return 720;
  if (kwp >= 100) return 800;
  if (kwp >= 50)  return 900;
  return 1050;
}

export function computeSolarFinance(
  systemKwp: number,
  annualKwh: number,
  electricityPrice = ELECTRICITY_PRICE_EUR_KWH,
): SolarFinance {
  const investmentEur = Math.round(systemKwp * costPerKwp(systemKwp));
  const usableKwh = annualKwh * SELF_CONSUMPTION_RATE;
  const annualSavingsEur = Math.round(usableKwh * electricityPrice);

  // Infinity when there are no savings (e.g. annualKwh=0) — never report 0 (which
  // would falsely read as "pays back immediately").
  const paybackYears = annualSavingsEur > 0
    ? Math.round((investmentEur / annualSavingsEur) * 10) / 10
    : Infinity;

  // Lifetime savings accounting for degradation, minus investment
  let lifetime = 0;
  for (let y = 0; y < SYSTEM_LIFETIME_YEARS; y++) {
    lifetime += annualSavingsEur * Math.pow(1 - ANNUAL_DEGRADATION, y);
  }
  const lifetimeSavingsEur = Math.round(lifetime - investmentEur);

  const co2TonnesPerYear = Math.round((annualKwh * CO2_KG_PER_KWH) / 100) / 10;

  return {
    systemKwp,
    annualKwh,
    investmentEur,
    annualSavingsEur,
    paybackYears,
    lifetimeSavingsEur,
    co2TonnesPerYear,
  };
}

/** Format euros compactly (e.g. €1.2k, €450k). */
export function formatEur(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v / 1_000).toFixed(v >= 100_000 ? 0 : 1)}k`;
  return `€${Math.round(v)}`;
}
