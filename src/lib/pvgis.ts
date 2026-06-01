/**
 * PVGIS API client (Comissão Europeia).
 * Docs: https://re.jrc.ec.europa.eu/pvg_tools/en/
 * 100% free, no API key required.
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
}

export interface PVGISResult {
  yearlyEnergyKwh: number;
  monthlyAverageKwh: number[];
  variabilityKwh: number;
  source: "PVGIS-SARAH3";
}

export async function fetchPVGIS(input: PVGISInput): Promise<PVGISResult> {
  const params = new URLSearchParams({
    lat: input.lat.toString(),
    lon: input.lon.toString(),
    peakpower: input.peakPowerKwp.toString(),
    loss: (input.loss ?? 14).toString(),
    angle: (input.angle ?? 30).toString(),
    aspect: (input.aspect ?? 0).toString(),
    pvtechchoice: "crystSi",
    mountingplace: "building",
    outputformat: "json",
  });

  const url = `${PVGIS_BASE}/PVcalc?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PVGIS error ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const yearly = data?.outputs?.totals?.fixed?.E_y ?? 0;
  const monthly: { E_m: number }[] = data?.outputs?.monthly?.fixed ?? [];
  return {
    yearlyEnergyKwh: yearly,
    monthlyAverageKwh: monthly.map((m) => m.E_m),
    variabilityKwh: data?.outputs?.totals?.fixed?.SD_y ?? 0,
    source: "PVGIS-SARAH3",
  };
}

/** Heuristic: roof area in m² → installable peak power in kWp (assumes 60% usable area, 180 W/m²). */
export function estimatePeakPower(roofAreaSqm: number, usableFraction = 0.6): number {
  return Math.max(0, roofAreaSqm * usableFraction * 0.18);
}
