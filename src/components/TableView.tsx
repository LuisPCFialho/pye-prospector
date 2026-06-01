import { useAppStore } from "../store/appStore";
import { exportLeadsCSV } from "../db/database";
import {
  SOLAR_STATUS_LABELS, PIPELINE_LABELS,
  SOLAR_STATUS_COLORS, PIPELINE_COLORS,
} from "../types/building";

export default function TableView() {
  const { buildings, leads, filterSolarStatus, filterPipelineStage, filterMinAreaSqm, selectBuilding, setViewMode } =
    useAppStore((s) => ({
      buildings: s.buildings,
      leads: s.leads,
      filterSolarStatus: s.filterSolarStatus,
      filterPipelineStage: s.filterPipelineStage,
      filterMinAreaSqm: s.filterMinAreaSqm,
      selectBuilding: s.selectBuilding,
      setViewMode: s.setViewMode,
    }));

  const rows = buildings
    .filter((b) => {
      const lead = leads[b.id];
      if (filterSolarStatus !== "all" && lead?.solarStatus !== filterSolarStatus) return false;
      if (filterPipelineStage !== "all" && lead?.pipelineStage !== filterPipelineStage) return false;
      if (b.areaSqm < filterMinAreaSqm) return false;
      return true;
    })
    .sort((a, b) => b.areaSqm - a.areaSqm);

  async function handleExport() {
    try {
      const csv = await exportLeadsCSV();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pye_leads.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed", e);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0f0f1a] text-slate-100">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-[#1a1a2e] shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewMode("map")} className="text-slate-400 hover:text-white text-sm">
            ← Voltar ao mapa
          </button>
          <span className="text-slate-600">|</span>
          <span className="text-sm text-slate-300">{rows.length} edifícios</span>
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-1.5 rounded bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-semibold"
        >
          Exportar CSV
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#1a1a2e] border-b border-slate-700">
            <tr>
              {["Nome / Morada", "Área m²", "Tag", "Painéis", "Pipeline", "kWh/ano", "Empresa"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-slate-400 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const lead = leads[b.id];
              return (
                <tr
                  key={b.id}
                  onClick={() => { selectBuilding(b.id); setViewMode("map"); }}
                  className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer"
                >
                  <td className="px-4 py-2 max-w-[180px] truncate">
                    {b.name || b.operator || `Way ${b.osmId ?? b.id.slice(0, 8)}`}
                  </td>
                  <td className="px-4 py-2">{b.areaSqm.toLocaleString("pt-PT")}</td>
                  <td className="px-4 py-2 text-slate-400">{b.buildingTag ?? "—"}</td>
                  <td className="px-4 py-2">
                    {lead ? (
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{
                          background: SOLAR_STATUS_COLORS[lead.solarStatus] + "30",
                          color: SOLAR_STATUS_COLORS[lead.solarStatus],
                        }}
                      >
                        {SOLAR_STATUS_LABELS[lead.solarStatus]}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {lead ? (
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{
                          background: PIPELINE_COLORS[lead.pipelineStage] + "30",
                          color: PIPELINE_COLORS[lead.pipelineStage],
                        }}
                      >
                        {PIPELINE_LABELS[lead.pipelineStage]}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {lead?.estimatedKwhPerYear
                      ? (lead.estimatedKwhPerYear / 1000).toFixed(1) + " MWh"
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-300">{lead?.company ?? "—"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                  Sem edifícios. Usa "Get Rooftops" para importar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
