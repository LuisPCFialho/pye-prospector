import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { fetchPVGIS, estimatePeakPower } from "../lib/pvgis";
import { saveLead, duplicateLead, getAllLeads, addActivity } from "../db/database";
import SolarChart from "./SolarChart";
import NotesAndTasks from "./NotesAndTasks";
import { openExternal, streetViewUrl, googleMapsUrl, googleVerifyUrl } from "../lib/openExternal";
import { computeFinance, formatEur, suggestBattery, type FinancingModel } from "../lib/solarFinance";

type Tab = "flag" | "solar" | "individual" | "notes" | "metadata" | "streetview";

const FINANCE_MODELS: { key: FinancingModel; label: string }[] = [
  { key: "capex", label: "CAPEX" },
  { key: "opex_ppa", label: "PPA" },
  { key: "leasing", label: "Leasing" },
];

export default function LocationDetails() {
  const selectedBuildingId = useAppStore((s) => s.selectedBuildingId);
  const buildings = useAppStore((s) => s.buildings);
  const leads = useAppStore((s) => s.leads);
  const setShowLocationDetails = useAppStore((s) => s.setShowLocationDetails);
  const setShowStreetView = useAppStore((s) => s.setShowStreetView);
  const upsertLead = useAppStore((s) => s.upsertLead);
  const setLeads = useAppStore((s) => s.setLeads);
  const notify = useAppStore((s) => s.notify);

  const [tab, setTab] = useState<Tab>("flag");
  const [calcingSolar, setCalcingSolar] = useState(false);
  const [financeModel, setFinanceModel] = useState<FinancingModel>("capex");
  const [shadingLoss, setShadingLoss] = useState(0);
  const [useOptimal, setUseOptimal] = useState(false);
  const [withBattery, setWithBattery] = useState(false);

  const building = buildings.find((b) => b.id === selectedBuildingId);
  const lead = selectedBuildingId ? leads[selectedBuildingId] : undefined;

  if (!building) return null;

  function ensureLead() {
    if (lead) return lead;
    return {
      id: crypto.randomUUID(),
      buildingId: building!.id,
      solarStatus: "unknown" as const,
      pipelineStage: "to_contact" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async function handleCalcSolar() {
    if (!building) return;
    setCalcingSolar(true);
    try {
      const kwp = lead?.estimatedKwp ?? estimatePeakPower(building.areaSqm);
      const result = await fetchPVGIS({
        lat: building.centroidLat,
        lon: building.centroidLon,
        peakPowerKwp: kwp,
        shadingLoss,
        optimal: useOptimal,
      });
      const base = ensureLead();
      const updated = {
        ...base,
        estimatedKwhPerYear: result.yearlyEnergyKwh,
        estimatedKwp: kwp,
        monthlyKwh: result.monthlyAverageKwh,
        updatedAt: new Date().toISOString(),
      };
      try { await saveLead(updated); } catch {}
      upsertLead(updated);
      notify(
        `${(result.yearlyEnergyKwh / 1000).toFixed(1)} MWh/ano · ${result.specificYield} kWh/kWp · ${result.tilt}°${useOptimal ? " (ótimo)" : ""}` +
        (result.source === "regional-estimate" ? " (estimativa regional)" : ""),
        result.source === "regional-estimate" ? "warning" : "success",
      );
    } catch (e) {
      notify(`Erro ao calcular solar: ${e instanceof Error ? e.message : "desconhecido"}`, "error");
    } finally {
      setCalcingSolar(false);
    }
  }

  async function handleField(field: string, value: string | number | undefined) {
    if (!building) return;
    const base = ensureLead();
    const prevStage = base.pipelineStage;
    const updated = {
      ...base,
      [field]: value,
      updatedAt: new Date().toISOString(),
    } as typeof base & Record<string, unknown>;
    try {
      await saveLead(updated as Parameters<typeof saveLead>[0]);
      // Log a stage-change activity for the pipeline timeline
      if (field === "pipelineStage" && value !== prevStage) {
        await addActivity(base.id, "stage_change", undefined, JSON.stringify({ from: prevStage, to: value }));
      }
    } catch { /* no tauri */ }
    upsertLead(updated as Parameters<typeof saveLead>[0]);
  }

  async function handleDuplicate() {
    if (!lead) return;
    try {
      await duplicateLead(lead.id);
      const all = await getAllLeads();
      setLeads(all);
      notify("Lead duplicado", "success");
    } catch (e) {
      notify(`Erro ao duplicar: ${e instanceof Error ? e.message : "DB indisponível"}`, "error");
    }
  }

  const kwp = lead?.estimatedKwp ?? estimatePeakPower(building.areaSqm);
  const density = building.areaSqm > 0 ? kwp / building.areaSqm : 0;

  const tabs: { key: Tab; label: string }[] = [
    { key: "flag", label: "🚩 Flag" },
    { key: "solar", label: "☀️ Solar" },
    { key: "individual", label: "🏢 Individual" },
    { key: "notes", label: "📝 Notes" },
    { key: "metadata", label: "🔍 Get Metadata" },
    { key: "streetview", label: "📷 Street View" },
  ];

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/60"
      onClick={() => setShowLocationDetails(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes da localização"
        className="w-[760px] max-h-[92vh] bg-[#1a1a2e] border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 bg-[#12121e] border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-semibold">Location Details</span>
          </div>
          <div className="flex items-center gap-2">
            {lead && (
              <button
                type="button"
                onClick={handleDuplicate}
                className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs"
                title="Duplicar lead"
              >
                ⎘ Duplicar
              </button>
            )}
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => setShowLocationDetails(false)}
              className="w-7 h-7 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center"
            >×</button>
          </div>
        </div>

        <div role="tablist" className="flex border-b border-slate-700 shrink-0 overflow-x-auto">
          {tabs.map((t) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === t.key ? "true" : "false"}
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

        <div className="overflow-y-auto flex-1 p-5">
          {tab === "flag" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <ROField label="Tipo" value={`Rooftop · ${building.buildingTag ?? "—"}`} />
                <ROField label="Área" value={`${building.areaSqm.toLocaleString("pt-PT")} m²`} />
                <ROField label="Lat / Lon" value={`${building.centroidLat.toFixed(5)}, ${building.centroidLon.toFixed(5)}`} />
                <ROField label="Source" value={building.source} />
                <SelectField
                  label="Estado Solar"
                  value={lead?.solarStatus ?? "unknown"}
                  opts={[
                    { value: "unknown", label: "Desconhecido" },
                    { value: "no_panels", label: "Sem painéis" },
                    { value: "has_panels", label: "Com painéis" },
                    { value: "partial", label: "Parcial" },
                    { value: "inconclusive", label: "Inconclusivo" },
                  ]}
                  onChange={(v) => handleField("solarStatus", v)}
                />
                <SelectField
                  label="Pipeline"
                  value={lead?.pipelineStage ?? "to_contact"}
                  opts={[
                    { value: "to_contact", label: "Por contactar" },
                    { value: "contacted", label: "Contactado" },
                    { value: "meeting", label: "Reunião" },
                    { value: "proposal", label: "Proposta" },
                    { value: "won", label: "Ganho" },
                    { value: "lost", label: "Perdido" },
                  ]}
                  onChange={(v) => handleField("pipelineStage", v)}
                />
                <div className="col-span-2 text-[10px] text-slate-500">
                  Criado: {lead?.createdAt ? new Date(lead.createdAt).toLocaleDateString("pt-PT") : "—"} ·
                  Atualizado: {lead?.updatedAt ? new Date(lead.updatedAt).toLocaleDateString("pt-PT") : "—"}
                </div>
              </div>
            </div>
          )}

          {tab === "solar" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <ROField label="Área" value={`${building.areaSqm.toLocaleString("pt-PT")} m²`} />
                <ROField label="Potencial Solar" value={`${kwp.toFixed(1)} kWp`} accent />
                <ROField label="Densidade" value={`${density.toFixed(3)} kWp/m²`} />
                {lead?.estimatedKwhPerYear && (
                  <ROField label="Geração Anual" value={`${(lead.estimatedKwhPerYear / 1000).toFixed(1)} MWh`} accent />
                )}
                {lead?.estimatedKwhPerYear && (
                  <ROField label="Poupança Anual" value={`${Math.round(lead.estimatedKwhPerYear * 0.16).toLocaleString("pt-PT")} €`} accent />
                )}
                <ROField label="Latitude" value={`${building.centroidLat.toFixed(4)}°`} />
              </div>
              {/* Solar calc options */}
              <div className="grid grid-cols-3 gap-2 items-end">
                <label className="text-[10px] text-slate-500 flex flex-col gap-1">
                  Sombreamento {shadingLoss}%
                  <input
                    type="range" min={0} max={40} step={5} value={shadingLoss}
                    onChange={(e) => setShadingLoss(Number(e.target.value))}
                    className="accent-brand-500"
                  />
                </label>
                <label className="text-[10px] text-slate-400 flex items-center gap-1.5">
                  <input type="checkbox" checked={useOptimal} onChange={(e) => setUseOptimal(e.target.checked)} className="accent-brand-500" />
                  Ângulo ótimo
                </label>
                <button
                  type="button"
                  onClick={handleCalcSolar}
                  disabled={calcingSolar}
                  className="py-1.5 rounded bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-slate-950 text-xs font-semibold"
                >
                  {calcingSolar ? "A calcular…" : lead?.monthlyKwh ? "↻ Recalcular" : "☀️ Calcular (PVGIS)"}
                </button>
              </div>

              {lead?.monthlyKwh && (
                <SolarChart monthlyKwh={lead.monthlyKwh} totalKwh={lead.estimatedKwhPerYear ?? 0} />
              )}

              {/* Financial / ROI analysis with model selector */}
              {lead?.estimatedKwhPerYear && (() => {
                const battery = withBattery ? suggestBattery(kwp, 0.75) : null;
                const scr = battery ? battery.newSelfConsumption : 0.75;
                const fin = computeFinance(financeModel, {
                  systemKwp: kwp,
                  annualKwh: lead.estimatedKwhPerYear!,
                  selfConsumptionRate: scr,
                });
                const capexWithBattery = fin.capexEur + (battery?.extraCostEur ?? 0);
                return (
                  <div className="mt-2 border-t border-slate-700/50 pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wide">Análise Financeira</span>
                      <div className="flex gap-1" role="tablist" aria-label="Modelo de financiamento">
                        {FINANCE_MODELS.map((m) => (
                          <button
                            key={m.key}
                            type="button"
                            role="tab"
                            aria-selected={financeModel === m.key ? "true" : "false"}
                            onClick={() => setFinanceModel(m.key)}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              financeModel === m.key ? "bg-brand-500 text-slate-950" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <ROField label={financeModel === "capex" ? "Investimento" : "CAPEX (instalador)"} value={formatEur(capexWithBattery)} />
                      <ROField label="Valor energia/ano" value={formatEur(fin.year1SavingsEur)} accent />
                      <ROField label="Payback" value={Number.isFinite(fin.paybackYears) ? `${fin.paybackYears} anos` : "—"} accent />
                      <ROField label="VAL (NPV)" value={formatEur(fin.npvEur)} accent />
                      <ROField label="TIR (IRR)" value={Number.isFinite(fin.irrPct) ? `${fin.irrPct}%` : "—"} />
                      <ROField label="LCOE" value={`${fin.lcoeEurKwh.toFixed(3)} €/kWh`} />
                      <ROField label="Poupança 25 anos" value={formatEur(fin.lifetimeSavingsEur)} accent />
                      <ROField label="CO₂ evitado/ano" value={`${fin.co2TonnesPerYear} t`} />
                      <ROField label="Autoconsumo" value={`~${Math.round(scr * 100)}%`} />
                    </div>
                    <label className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-1">
                      <input type="checkbox" checked={withBattery} onChange={(e) => setWithBattery(e.target.checked)} className="accent-brand-500" />
                      Incluir bateria {battery ? `(${battery.kwh} kWh, +${formatEur(battery.extraCostEur)})` : ""}
                    </label>
                    <p className="text-[9px] text-slate-600">
                      Estimativa para prospeção · tarifa 0,16€/kWh · injeção 0,045€/kWh · taxa desconto 6% · 25 anos.
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {tab === "individual" && (
            <div className="grid grid-cols-2 gap-4">
              <EditField label="Empresa" value={lead?.company ?? ""} onChange={(v) => handleField("company", v)} />
              <EditField label="NIF" value={lead?.nif ?? ""} onChange={(v) => handleField("nif", v)} />
              <SelectField
                label="Setor"
                value={lead?.buildingUse ?? "other"}
                opts={[
                  { value: "food_beverage", label: "Alimentar/Bebidas" },
                  { value: "metalwork", label: "Metalúrgica" },
                  { value: "logistics", label: "Logística" },
                  { value: "retail", label: "Retalho" },
                  { value: "hotels", label: "Hotelaria" },
                  { value: "agriculture", label: "Agricultura" },
                  { value: "office", label: "Escritórios" },
                  { value: "other", label: "Outro" },
                ]}
                onChange={(v) => handleField("buildingUse", v)}
              />
              <EditField label="Telefone" value={lead?.telephone ?? ""} onChange={(v) => handleField("telephone", v)} />
              <EditField label="Website" value={lead?.website ?? ""} onChange={(v) => handleField("website", v)} />
              <EditField label="Dono / Proprietário" value={lead?.owner ?? ""} onChange={(v) => handleField("owner", v)} />
              <EditField label="Tags" value={lead?.tags ?? ""} onChange={(v) => handleField("tags", v)} />
              {lead?.company && (
                <div className="col-span-2 flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => openExternal(`https://www.google.com/search?q=${encodeURIComponent(lead.company! + " empresa contactos Portugal")}`)}
                    className="flex-1 text-center py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-200"
                  >
                    🔍 Google
                  </button>
                  <button
                    type="button"
                    onClick={() => openExternal(`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(lead.company!)}`)}
                    className="flex-1 text-center py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-200"
                  >
                    💼 LinkedIn
                  </button>
                  <button
                    type="button"
                    onClick={() => openExternal(googleVerifyUrl(building.centroidLat, building.centroidLon, lead.company))}
                    className="flex-1 text-center py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-200"
                  >
                    🗺️ Verificar no Maps
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "notes" && (
            lead ? (
              <NotesAndTasks leadId={lead.id} />
            ) : (
              <p className="text-xs text-slate-500 italic py-6 text-center">
                Cria um lead primeiro (clica num separador acima) para adicionar notas e tarefas.
              </p>
            )
          )}

          {tab === "metadata" && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 mb-3">Tags OSM brutas:</p>
              {Object.entries(building.rawTags ?? {}).map(([k, v]) => (
                <div key={k} className="flex gap-2 text-xs">
                  <span className="text-slate-400 w-32 shrink-0">{k}</span>
                  <span className="text-slate-100">{v}</span>
                </div>
              ))}
              <div className="flex gap-3 mt-4 pt-3 border-t border-slate-700/50">
                {building.osmId && (
                  <button
                    type="button"
                    onClick={() => openExternal(`https://www.openstreetmap.org/${building.osmType ?? "way"}/${building.osmId}`)}
                    className="text-xs text-brand-400 hover:text-brand-300"
                  >
                    Abrir no OSM ↗
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openExternal(streetViewUrl(building.centroidLat, building.centroidLon))}
                  className="text-xs text-brand-400 hover:text-brand-300"
                >
                  Street View ↗
                </button>
                <button
                  type="button"
                  onClick={() => openExternal(googleMapsUrl(building.centroidLat, building.centroidLon))}
                  className="text-xs text-brand-400 hover:text-brand-300"
                >
                  Google Maps ↗
                </button>
              </div>
            </div>
          )}

          {tab === "streetview" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Vista de rua próxima do edifício (Mapillary). Abre o modal completo para navegação.
              </p>
              <button
                type="button"
                onClick={() => { setShowLocationDetails(false); setShowStreetView(true); }}
                className="w-full py-2 rounded bg-brand-500 hover:bg-brand-400 text-slate-950 text-sm font-semibold"
              >
                📷 Abrir Street View
              </button>
              <div className="text-[10px] text-slate-500">
                Coordenadas: {building.centroidLat.toFixed(5)}, {building.centroidLon.toFixed(5)}
              </div>
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
  label, value, onChange, textarea, type,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  textarea?: boolean;
  type?: string;
}) {
  const cls = "w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-brand-500";
  return (
    <div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</div>
      {textarea ? (
        <textarea
          className={`${cls} resize-none h-20`}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type={type ?? "text"}
          className={cls}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
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
        aria-label={label}
        title={label}
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
