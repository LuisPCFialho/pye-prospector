import { describe, it, expect } from "vitest";
import {
  npv, irr, computeFinance, computeSolarFinance, formatEur, suggestBattery,
} from "./solarFinance";

describe("npv", () => {
  it("at zero discount rate is the plain sum of cashflows", () => {
    expect(npv(0, [-100, 50, 50, 50])).toBe(50);
  });
  it("discounts future cashflows", () => {
    expect(npv(0.1, [-100, 110])).toBeCloseTo(0, 6);
  });
});

describe("irr (bisection)", () => {
  it("recovers a known 10% return", () => {
    expect(irr([-100, 110])).toBeCloseTo(0.1, 2);
  });
  it("returns NaN when the first cashflow is non-negative (no investment)", () => {
    expect(Number.isNaN(irr([100, 50]))).toBe(true);
  });
  it("returns NaN when there is no sign change", () => {
    expect(Number.isNaN(irr([-100, -50, -10]))).toBe(true);
  });
});

describe("computeFinance", () => {
  it("CAPEX model: tiered cost, positive savings, 26 cashflows (year 0..25)", () => {
    const r = computeFinance("capex", { systemKwp: 500, annualKwh: 750_000 });
    expect(r.capexEur).toBe(500 * 650); // >=500 kWp tier
    expect(r.cashflows).toHaveLength(26);
    expect(r.cashflows[0]).toBe(-r.capexEur); // year 0 = -capex
    expect(r.year1SavingsEur).toBeGreaterThan(0);
    expect(Number.isFinite(r.npvEur)).toBe(true);
    expect(r.lcoeEurKwh).toBeGreaterThan(0);
  });

  it("PPA model: no upfront outflow, 25 operating cashflows", () => {
    const r = computeFinance("opex_ppa", { systemKwp: 200, annualKwh: 300_000 });
    expect(r.cashflows).toHaveLength(25);
    expect(r.cashflows.every((c) => Number.isFinite(c))).toBe(true);
  });

  it("leasing model produces finite NPV and LCOE", () => {
    const r = computeFinance("leasing", { systemKwp: 120, annualKwh: 180_000 });
    expect(Number.isFinite(r.npvEur)).toBe(true);
    expect(r.lcoeEurKwh).toBeGreaterThan(0);
  });

  it("a profitable CAPEX project has a finite payback within its lifetime", () => {
    const r = computeFinance("capex", { systemKwp: 500, annualKwh: 800_000 });
    expect(r.paybackYears).toBeLessThanOrEqual(25);
    expect(r.paybackYears).toBeGreaterThan(0);
  });
});

describe("computeSolarFinance (simple model)", () => {
  it("reports Infinity payback when there are no savings", () => {
    const r = computeSolarFinance(100, 0);
    expect(r.paybackYears).toBe(Infinity);
  });
  it("scales investment with the per-kWp tier", () => {
    const r = computeSolarFinance(600, 900_000);
    expect(r.investmentEur).toBe(600 * 650);
    expect(r.annualSavingsEur).toBeGreaterThan(0);
  });
});

describe("formatEur", () => {
  it("formats thousands and millions compactly", () => {
    expect(formatEur(1500)).toBe("€1.5k");
    expect(formatEur(1_500_000)).toBe("€1.5M");
    expect(formatEur(500)).toBe("€500");
    expect(formatEur(150_000)).toBe("€150k");
  });
  it("renders a dash for non-finite values", () => {
    expect(formatEur(Infinity)).toBe("—");
  });
});

describe("suggestBattery", () => {
  it("sizes to capture midday surplus and lifts self-consumption", () => {
    const b = suggestBattery(500, 0.75);
    expect(b.kwh).toBeCloseTo(187.5, 1);
    expect(b.newSelfConsumption).toBeCloseTo(0.9, 2);
    expect(b.extraCostEur).toBe(Math.round(b.kwh * 450));
  });
});
