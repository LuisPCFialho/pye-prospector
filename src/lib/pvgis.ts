/**
 * PVGIS API client (Comissão Europeia) with regional-yield fallback.
 * Docs: https://re.jrc.ec.europa.eu/pvg_tools/en/  — 100% free, no API key required.
 */

const PVGIS_BASE = "https://re.jrc.ec.europa.eu/api/v5_3";

export interface PVGISInput {
  lat: number;
  lon: number;
  /** Peak power in kWp (roughly: roof area m² * 0.18 for typical efficiency). */
  peakPowerKwp: number;
  /** Panel tilt in degrees, default 30 (good for Portugal latitude). */
  angle?: number;
  /** Azimuth: 0 = south, -90 = east, 90 = west. */
  aspect?: number;
  /** System losses %, default 14 (PV+inverter+wiring). */
  loss?: number;
  /** Extra shading loss % (0-40) added on top of system losses. */
  shadingLoss?: number;
  /** Ask PVGIS to compute the optimal tilt+azimuth for max yearly yield. */
  optimal?: boolean;
}

export interface PVGISResult {
  yearlyEnergyKwh: number;
  monthlyAverageKwh: number[];
  variabilityKwh: number;
  source: "PVGIS-SARAH3" | "regional-estimate";
  /** Tilt actually used (degrees) — echoed back, useful when optimal=true. */
  tilt: number;
  /** Azimuth actually used (0=S) — echoed back. */
  azimuth: number;
  /** Specific yield kWh/kWp/year. */
  specificYield: number;
}

/**
 * Regional yield in kWh/kWp/year for Portugal — used as fallback when PVGIS is unreachable.
 * Higher in southern (Algarve, Alentejo) and lower in northern (Minho, Porto) regions.
 */
function regionalYieldKwhPerKwp(lat: number): number {
  // Linear interp: 37.0°N (Algarve) → 1620 ; 42.0°N (Norte) → 1380
  const t = Math.max(0, Math.min(1, (42.0 - lat) / 5.0));
  return Math.round(1380 + (1620 - 1380) * t);
}

/** Monthly distribution (% of annual yield) — typical Portuguese pattern */
const MONTHLY_FRACTION = [
  0.045, 0.060, 0.085, 0.100, 0.115, 0.125,
  0.130, 0.122, 0.095, 0.070, 0.045, 0.030,
];

export async function fetchPVGIS(input: PVGISInput): Promise<PVGISResult> {
  const totalLoss = Math.min(60, (input.loss ?? 14) + (input.shadingLoss ?? 0));
  const params = new URLSearchParams({
    lat: input.lat.toString(),
    lon: input.lon.toString(),
    peakpower: input.peakPowerKwp.toString(),
    loss: totalLoss.toString(),
    pvtechchoice: "crystSi",
    mountingplace: "building",
    outputformat: "json",
  });
  if (input.optimal) {
    params.set("optimalangles", "1");
  } else {
    params.set("angle", (input.angle ?? 30).toString());
    params.set("aspect", (input.aspect ?? 0).toString());
  }

  try {
    const url = `${PVGIS_BASE}/PVcalc?${params.toString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));

    if (!res.ok) throw new Error(`PVGIS ${res.status}`);
    const data = await res.json();
    const yearly = data?.outputs?.totals?.fixed?.E_y ?? 0;
    const monthly: { E_m: number }[] = data?.outputs?.monthly?.fixed ?? [];
    const fixedMount = data?.inputs?.mounting_system?.fixed;
    const usedTilt = fixedMount?.slope?.value ?? input.angle ?? 30;
    const usedAzimuth = fixedMount?.azimuth?.value ?? input.aspect ?? 0;

    if (yearly > 0 && monthly.length === 12) {
      return {
        yearlyEnergyKwh: yearly,
        monthlyAverageKwh: monthly.map((m) => m.E_m),
        variabilityKwh: data?.outputs?.totals?.fixed?.SD_y ?? 0,
        source: "PVGIS-SARAH3",
        tilt: Math.round(usedTilt),
        azimuth: Math.round(usedAzimuth),
        specificYield: input.peakPowerKwp > 0 ? Math.round(yearly / input.peakPowerKwp) : 0,
      };
    }
    throw new Error("PVGIS returned no usable data");
  } catch (e) {
    // Fallback: regional yield estimate
    const yieldKwhPerKwp = regionalYieldKwhPerKwp(input.lat);
    const lossesFactor = 1 - totalLoss / 100;
    const yearly = Math.round(input.peakPowerKwp * yieldKwhPerKwp * lossesFactor);
    const monthly = MONTHLY_FRACTION.map((f) => Math.round(yearly * f));
    console.warn("Using regional yield fallback (PVGIS unavailable):", e);
    return {
      yearlyEnergyKwh: yearly,
      monthlyAverageKwh: monthly,
      variabilityKwh: yearly * 0.06,
      source: "regional-estimate",
      tilt: input.optimal ? Math.round(input.lat - 8) : (input.angle ?? 30),
      azimuth: input.aspect ?? 0,
      specificYield: input.peakPowerKwp > 0 ? Math.round(yearly / input.peakPowerKwp) : 0,
    };
  }
}

/** Heuristic: roof area in m² → installable peak power in kWp (assumes 65% usable, 180 W/m²). */
export function estimatePeakPower(roofAreaSqm: number, usableFraction = 0.65): number {
  return Math.max(0, roofAreaSqm * usableFraction * 0.18);
}
