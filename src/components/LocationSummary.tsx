import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { fetchPVGIS, estimatePeakPower } from "../lib/pvgis";
import { saveLead } from "../db/database";

type Tab = "flag" | "solar" | "individual";

const SOLAR_STATUS_OPTS = [
  { value: "unknown", label: "Desconhecido" },
  { value: "no_panels", label: "Sem painéis" },
  { value: "has_panels", label: "Com painéis" },
  { value: "partial", label: "Parcial" },
  { value: "inconclusive", label: "Inconclusivo" },
] as const;

const PIPELINE_OPTS = [
  { value: "to_contact", label: "Por contactar" },
  { value: "contacted", label: "Contactado" },
  { value: "meeting", label: "Reunião" },
  { value: "proposal", label: "Proposta" },
  { value: "won", label: "Ganho" },
  { value: "lost", label: "Perdido" },
] as const;

export default function LocationSummary() {
  const {
    selectedBuildingId, buildings, leads,
    showLocationSummary, selectBuilding,
    setShowLocationDetails, setShowStreetView, upsertLead,
  } = useAppStore((s) => ({
    selectedBuildingId: s.selectedBuildingId,
    buildings: s.buildings,
    leads: s.leads,
    showLocationSummary: s.showLocationSummary,
    selectBuilding: s.selectBuilding,
    setShowLocationDetails: s.setShowLocationDetails,
    setShowStreetView: s.setShowStreetView,
    upsertLead: s.upsertLead,
  }));

  const [tab, setTab] = useState<Tab>("flag");
  const [calcingSolar, setCalcingSolar] = useState(false);

  const building = buildings.find((b) => b.id === selectedBuildingId);
  const lead = selectedBuildingId ? leads[selectedBuildingId] : undefined;

  if (!showLocationSummary || !building) return null;

  async function handleCalcSolar() {
    if (!building) return;
    setCalcingSolar(true);
    try {
      const kwp = estimatePeakPower(building.areaSqm);
      const result = await fetchPVGIS({ lat: building.centroidLat, lon: building.centroidLon, peakPowerKwp: kwp });
      const updated = {
        ...(lead ?? {
          id: crypto.randomUUID(),
          buildingId: building.id,
          solarStatus: "unknown" as const,
          pipelineStage: "to_contact" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        estimatedKwhPerYear: result.yearlyEnergyKwh,
        estimatedKwp: kwp,
        monthlyKwh: result.monthlyAverageKwh,
        updatedAt: new Date().toISOString(),
      };
      await saveLead(updated);
      upsertLead(updated);
    } finally {
      setCalcingSolar(false);
    }
  }

  async function handleFieldChange(field: string, value: string) {
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

  return (
    <div className="absolute top-4 right-4 z-20 w-80 bg-[#1a1a2e] border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#12121e] border-b border-slate-700">
        <span className="text-sm font-semibold">Location Summary</span>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLocationDetails(true)}
            className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-xs"
            title="Expandir"
          >
            ⤢
          </button>
          <button
            onClick={() => selectBuilding(null)}
            className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-xs"
            title="Fechar"
          >
            ×
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {(["flag", "solar", "individual"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium capitalize transition ${
              tab === t
                ? "text-brand-400 border-b-2 border-brand-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t === "flag" ? "🚩 Flag" : t === "solar" ? "☀️ Solar" : "👤 Individual"}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3 text-sm">
        {tab === "flag" && (
          <>
            <Field label="Tipo" value="Rooftop C&I" />
            <Field label="Área" value={`m² ${building.areaSqm.toLocaleString("pt-PT")}`} />
            <SelectField
              label="Estado solar"
              value={lead?.solarStatus ?? "unknown"}
              opts={SOLAR_STATUS_OPTS}
              onChange={(v) => handleFieldChange("solarStatus", v)}
            />
            <SelectField
              label="Pipeline"
              value={lead?.pipelineStage ?? "to_contact"}
              opts={PIPELINE_OPTS}
              onChange={(v) => handleFieldChange("pipelineStage", v)}
            />
            {building.name && <Field label="Nome" value={building.name} />}
            {building.operator && <Field label="Operador" value={building.operator} />}
          </>
        )}

        {tab === "solar" && (
          <>
            <Field label="Área" value={`m² ${building.areaSqm.toLocaleString("pt-PT")}`} />
            <Field
              label="Potencial solar"
              value={`kWp ${kwp.toFixed(1)}`}
              accent
            />
            {lead?.estimatedKwhPerYear ? (
              <Field
                label="Geração anual"
                value={`${(lead.estimatedKwhPerYear / 1000).toFixed(1)} MWh/ano`}
                accent
              />
            ) : (
              <button
                onClick={handleCalcSolar}
                disabled={calcingSolar}
                className="w-full py-1.5 rounded bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-slate-950 text-xs font-semibold"
              >
                {calcingSolar ? "A calcular…" : "☀️ Calcular PVGIS"}
              </button>
            )}
          </>
        )}

        {tab === "individual" && (
          <>
            <EditableField
              label="Empresa"
              value={lead?.company ?? ""}
              onChange={(v) => handleFieldChange("company", v)}
            />
            <EditableField
              label="Telefone"
              value={lead?.telephone ?? ""}
              onChange={(v) => handleFieldChange("telephone", v)}
            />
            <EditableField
              label="Website"
              value={lead?.website ?? ""}
              onChange={(v) => handleFieldChange("website", v)}
            />
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 flex gap-2">
        <button
          onClick={() => setShowLocationDetails(true)}
          className="flex-1 h-7 rounded bg-slate-700 hover:bg-slate-600 text-xs"
        >
          Ver detalhes
        </button>
        <button
          onClick={() => setShowStreetView(true)}
          className="flex-1 h-7 rounded bg-slate-700 hover:bg-slate-600 text-xs"
        >
          Street View
        </button>
        {building.osmId && (
          <a
            href={`https://www.openstreetmap.org/way/${building.osmId}`}
            target="_blank" rel="noopener noreferrer"
            className="h-7 w-7 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-xs"
            title="Abrir no OSM"
          >
            ↗
          </a>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`text-sm font-medium ${accent ? "text-brand-400" : "text-slate-100"}`}>
        {value}
      </div>
    </div>
  );
}

function EditableField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</div>
      <input
        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({
  label, value, opts, onChange,
}: {
  label: string;
  value: string;
  opts: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</div>
      <select
        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {opts.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
