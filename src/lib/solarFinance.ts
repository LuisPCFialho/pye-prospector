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
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v / 1_000).toFixed(v >= 100_000 ? 0 : 1)}k`;
  return `€${Math.round(v)}`;
}

// ── Advanced financial engine ────────────────────────────────────────────────

/** Net Present Value of a cash-flow array (index 0 = year 0). */
export function npv(rate: number, cashflows: number[]): number {
  return cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
}

/** Internal Rate of Return via bisection. Returns NaN if no sign change. */
export function irr(cashflows: number[]): number {
  if (cashflows[0] >= 0) return NaN;
  let lo = -0.9, hi = 1.0;
  const f = (r: number) => npv(r, cashflows);
  if (f(lo) * f(hi) > 0) return NaN;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export type FinancingModel = "capex" | "opex_ppa" | "leasing";

export interface FinanceParams {
  systemKwp: number;
  annualKwh: number;
  selfConsumptionRate?: number;  // 0-1, default 0.75
  retailPrice?: number;          // €/kWh self-consumed, default 0.16
  injectionPrice?: number;       // €/kWh injected to grid, default 0.045
  discountRate?: number;         // default 0.06
  inflation?: number;            // electricity price inflation, default 0.03
  degradation?: number;          // panel degradation/yr, default 0.005
  lifetimeYears?: number;        // default 25
  omRatePerKwpYear?: number;     // O&M €/kWp/yr, default 12
  ppaPrice?: number;             // PPA €/kWh, default 0.11
  leaseMonthly?: number;         // lease €/month; default derived
}

export interface FinanceResult {
  model: FinancingModel;
  capexEur: number;
  year1SavingsEur: number;
  paybackYears: number;
  npvEur: number;
  irrPct: number;
  lcoeEurKwh: number;
  lifetimeSavingsEur: number;
  co2TonnesPerYear: number;
  /** Per-year net cash flow to the client (year 0..N). */
  cashflows: number[];
}

const DEF = {
  selfConsumptionRate: 0.75,
  retailPrice: 0.16,
  injectionPrice: 0.045,
  discountRate: 0.06,
  inflation: 0.03,
  degradation: 0.005,
  lifetimeYears: 25,
  omRatePerKwpYear: 12,
  ppaPrice: 0.11,
};

/** Compute full financials for a chosen financing model. */
export function computeFinance(model: FinancingModel, p: FinanceParams): FinanceResult {
  const o = { ...DEF, ...p };
  const capex = Math.round(p.systemKwp * costPerKwp(p.systemKwp));
  const selfKwh = o.annualKwh * o.selfConsumptionRate;
  const injKwh = o.annualKwh * (1 - o.selfConsumptionRate);
  const co2TonnesPerYear = Math.round((o.annualKwh * CO2_KG_PER_KWH) / 100) / 10;

  // Gross value of energy produced in year 1 (savings + injection income)
  const grossYear1 = selfKwh * o.retailPrice + injKwh * o.injectionPrice;

  const cashflows: number[] = [];
  let lcoeCost = 0, lcoeEnergy = 0;

  if (model === "capex") {
    cashflows.push(-capex);
    lcoeCost = capex;
    for (let t = 1; t <= o.lifetimeYears; t++) {
      const deg = Math.pow(1 - o.degradation, t - 1);
      const priceInfl = Math.pow(1 + o.inflation, t - 1);
      const energy = o.annualKwh * deg;
      const value = (selfKwh * o.retailPrice + injKwh * o.injectionPrice) * deg * priceInfl;
      const om = o.omRatePerKwpYear * p.systemKwp * priceInfl;
      cashflows.push(value - om);
      lcoeCost += om / Math.pow(1 + o.discountRate, t);
      lcoeEnergy += energy / Math.pow(1 + o.discountRate, t);
    }
  } else if (model === "opex_ppa") {
    // Client pays PPA price for self-consumed energy, no upfront cost
    for (let t = 1; t <= o.lifetimeYears; t++) {
      const deg = Math.pow(1 - o.degradation, t - 1);
      const priceInfl = Math.pow(1 + o.inflation, t - 1);
      const avoided = selfKwh * deg * o.retailPrice * priceInfl;
      const ppaCost = selfKwh * deg * o.ppaPrice * priceInfl;
      cashflows.push(avoided - ppaCost);
    }
    lcoeCost = capex; lcoeEnergy = 0;
    for (let t = 1; t <= o.lifetimeYears; t++) {
      lcoeEnergy += o.annualKwh * Math.pow(1 - o.degradation, t - 1) / Math.pow(1 + o.discountRate, t);
    }
  } else {
    // leasing: fixed monthly fee, client keeps all energy value
    const lease = o.leaseMonthly ?? Math.round((capex * 1.25) / (o.lifetimeYears * 12));
    for (let t = 1; t <= o.lifetimeYears; t++) {
      const deg = Math.pow(1 - o.degradation, t - 1);
      const priceInfl = Math.pow(1 + o.inflation, t - 1);
      const value = (selfKwh * o.retailPrice + injKwh * o.injectionPrice) * deg * priceInfl;
      cashflows.push(value - lease * 12);
    }
    lcoeCost = capex; lcoeEnergy = 0;
    for (let t = 1; t <= o.lifetimeYears; t++) {
      lcoeEnergy += o.annualKwh * Math.pow(1 - o.degradation, t - 1) / Math.pow(1 + o.discountRate, t);
    }
  }

  // Payback: first year cumulative cashflow turns positive
  let cum = 0, payback = Infinity;
  for (let i = 0; i < cashflows.length; i++) {
    cum += cashflows[i];
    if (cum >= 0) { payback = i; break; }
  }

  const lifetimeSavings = Math.round(cashflows.reduce((a, b) => a + b, 0));
  const lcoe = lcoeEnergy > 0 ? Math.round((lcoeCost / lcoeEnergy) * 1000) / 1000 : 0;

  return {
    model,
    capexEur: capex,
    year1SavingsEur: Math.round(grossYear1),
    paybackYears: payback === Infinity ? Infinity : payback,
    npvEur: Math.round(npv(o.discountRate, cashflows)),
    irrPct: Math.round(irr(cashflows) * 1000) / 10,
    lcoeEurKwh: lcoe,
    lifetimeSavingsEur: lifetimeSavings,
    co2TonnesPerYear,
    cashflows,
  };
}

/** Battery sizing heuristic: size to capture ~1-2h of midday surplus. */
export function suggestBattery(systemKwp: number, selfConsumptionRate: number): {
  kwh: number; newSelfConsumption: number; extraCostEur: number;
} {
  const surplus = 1 - selfConsumptionRate;
  const kwh = Math.round(systemKwp * 1.5 * surplus * 10) / 10; // ~1.5 kWh per kWp scaled by surplus
  // Battery lifts self-consumption toward ~90% of the capturable surplus
  const newSelfConsumption = Math.min(0.95, selfConsumptionRate + surplus * 0.6);
  const extraCostEur = Math.round(kwh * 450); // ~€450/kWh installed
  return { kwh, newSelfConsumption: Math.round(newSelfConsumption * 100) / 100, extraCostEur };
}
