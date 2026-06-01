import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { fetchPVGIS, estimatePeakPower } from "../lib/pvgis";
import { saveLead } from "../db/database";
import SolarChart from "./SolarChart";

type Tab = "flag" | "solar" | "individual" | "metadata" | "streetview";

export default function LocationDetails() {
  const {
    selectedBuildingId, buildings, leads,
    setShowLocationDetails, setShowStreetView, upsertLead,
  } = useAppStore((s) => ({
    selectedBuildingId: s.selectedBuildingId,
    buildings: s.buildings,
    leads: s.leads,
    setShowLocationDetails: s.setShowLocationDetails,
    setShowStreetView: s.setShowStreetView,
    upsertLead: s.upsertLead,
  }));

  const [tab, setTab] = useState<Tab>("flag");
  const [calcingSolar, setCalcingSolar] = useState(false);

  const building = buildings.find((b) => b.id === selectedBuildingId);
  const lead = selectedBuildingId ? leads[selectedBuildingId] : undefined;

  if (!building) return null;

  async function handleCalcSolar() {
    if (!building) return;
    setCalcingSolar(true);
    try {
      const kwp = estimatePeakPower(building.areaSqm);
      const result = await fetchPVGIS({
        lat: building.centroidLat,
        lon: building.centroidLon,
        peakPowerKwp: kwp,
      });
      const updated = {
        ...(lead ?? {
          id: crypto.randomUUID(),
          buildingId: building.id,
          solarStatus: "unknown" as const,
          pipelineStage: "to_contact" as const,
          createdAt: new Date().toISOString(),
        }),
        estimatedKwhPerYear: result.yearlyEnergyKwh,
        estimatedKwp: kwp,
        monthlyKwh: result.monthlyAverageKwh,
        updatedAt: new Date().toISOString(),
      };
      await saveLead(updated as typeof updated & { updatedAt: string });
      upsertLead(updated as typeof updated & { updatedAt: string });
    } finally {
      setCalcingSolar(false);
    }
  }

  async function handleField(field: string, value: string) {
    if (!building) return;
    const updated = {
      ...(lead ?? {
        id: crypto.randomUUID(),
        buildingId: building.id,
        solarStatus: "unknown" as const,
        pipelineStage: "to_contact" as const,
        createdAt: new Date().toISOString(),
      }),
      [field]: value,
      updatedAt: new Date().toISOString(),
    };
    await saveLead(updated as typeof updated & { updatedAt: string });
    upsertLead(updated as typeof updated & { updatedAt: string });
  }

  const kwp = lead?.estimatedKwp ?? estimatePeakPower(building.areaSqm);
  const density = building.areaSqm > 0 ? kwp / building.areaSqm : 0;
  const tabs: { key: Tab; label: string }[] = [
    { key: "flag", label: "🚩 Flag" },
    { key: "solar", label: "☀️ Solar" },
    { key: "individual", label: "👤 Individual" },
    { key: "metadata", label: "🔍 Metadata" },
    { key: "streetview", label: "📷 Street View" },
  ];

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
      <div className="w-[680px] max-h-[90vh] bg-[#1a1a2e] border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#12121e] border-b border-slate-700 shrink-0">
          <span className="font-semibold">Location Details</span>
          <button
            onClick={() => setShowLocationDetails(false)}
            className="w-7 h-7 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-xs font-medium transition whitespace-nowrap ${
                tab === t.key
                  ? "text-brand-400 border-b-2 border-brand-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5">
          {tab === "flag" && (
            <div className="grid grid-cols-2 gap-4">
              <ROField label="Tipo" value="Rooftop" />
              <ROField label="Área" value={`m² ${building.areaSqm.toLocaleString("pt-PT")}`} />
              <ROField label="Lat / Lon" value={`${building.centroidLat.toFixed(5)}, ${building.centroidLon.toFixed(5)}`} />
              <ROField label="Tag OSM" value={building.buildingTag ?? "—"} />
              <EditField label="Empresa" value={lead?.company ?? ""} onChange={(v) => handleField("company", v)} />
              <EditField label="Telefone" value={lead?.telephone ?? ""} onChange={(v) => handleField("telephone", v)} />
              <EditField label="Website" value={lead?.website ?? ""} onChange={(v) => handleField("website", v)} />
              <EditField label="Tags" value={lead?.tags ?? ""} onChange={(v) => handleField("tags", v)} />
              <div className="col-span-2">
                <EditField label="Notas" value={lead?.notes ?? ""} onChange={(v) => handleField("notes", v)} textarea />
              </div>
              <div className="col-span-2 text-[10px] text-slate-500">
                Adicionado: {lead?.createdAt ? new Date(lead.createdAt).toLocaleDateString("pt-PT") : "Hoje"} ·
                Última alteração: {lead?.updatedAt ? new Date(lead.updatedAt).toLocaleDateString("pt-PT") : "—"}
              </div>
            </div>
          )}

          {tab === "solar" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <ROField label="Área" value={`m² ${building.areaSqm.toLocaleString("pt-PT")}`} />
                <ROField label="Potencial solar" value={`kWp ${kwp.toFixed(1)}`} accent />
                <ROField label="Densidade solar" value={`kWp/m² ${density.toFixed(2)}`} />
                {lead?.estimatedKwhPerYear && (
                  <ROField
                    label="Geração anual estimada"
                    value={`${(lead.estimatedKwhPerYear / 1000).toFixed(1)} MWh/ano`}
                    accent
                  />
                )}
              </div>
              {lead?.monthlyKwh ? (
                <SolarChart monthlyKwh={lead.monthlyKwh} totalKwh={lead.estimatedKwhPerYear ?? 0} />
              ) : (
                <button
                  onClick={handleCalcSolar}
                  disabled={calcingSolar}
                  className="w-full py-2 rounded bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-slate-950 text-sm font-semibold"
                >
                  {calcingSolar ? "A calcular PVGIS…" : "☀️ Calcular potencial solar (PVGIS)"}
                </button>
              )}
            </div>
          )}

          {tab === "individual" && (
            <div className="grid grid-cols-2 gap-4">
              <EditField label="Empresa" value={lead?.company ?? ""} onChange={(v) => handleField("company", v)} />
              <EditField label="Telefone" value={lead?.telephone ?? ""} onChange={(v) => handleField("telephone", v)} />
              <EditField label="Website" value={lead?.website ?? ""} onChange={(v) => handleField("website", v)} />
              <EditField label="Dono / Proprietário" value={lead?.owner ?? ""} onChange={(v) => handleField("owner", v)} />
              <div className="col-span-2">
                <EditField label="Notas" value={lead?.notes ?? ""} onChange={(v) => handleField("notes", v)} textarea />
              </div>
            </div>
          )}

          {tab === "metadata" && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 mb-3">Tags OSM brutas para este edifício:</p>
              {Object.entries(building.rawTags ?? {}).map(([k, v]) => (
                <div key={k} className="flex gap-2 text-xs">
                  <span className="text-slate-400 w-32 shrink-0">{k}</span>
                  <span className="text-slate-100">{v}</span>
                </div>
              ))}
              {building.osmId && (
                <a
                  href={`https://www.openstreetmap.org/way/${building.osmId}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-block mt-3 text-xs text-brand-400 hover:text-brand-300"
                >
                  Abrir no OpenStreetMap ↗
                </a>
              )}
            </div>
          )}

          {tab === "streetview" && (
            <div className="text-center py-6">
              <button
                onClick={() => { setShowLocationDetails(false); setShowStreetView(true); }}
                className="px-6 py-2 rounded bg-brand-500 hover:bg-brand-400 text-slate-950 text-sm font-semibold"
              >
                📷 Abrir Street View
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ROField({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`text-sm font-medium ${accent ? "text-brand-400" : "text-slate-100"}`}>{value}</div>
    </div>
  );
}

function EditField({
  label, value, onChange, textarea,
}: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  const cls = "w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-brand-500";
  return (
    <div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</div>
      {textarea ? (
        <textarea
          className={`${cls} resize-none h-20`} value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input className={cls} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
