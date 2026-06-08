import { useState, useMemo } from "react";
import { ArrowUpDown, ExternalLink, Sun, Flag, X } from "lucide-react";
import { useAppStore } from "../store/appStore";
import { exportLeadsCSV, bulkSetStage, bulkSetFlag, getAllLeads } from "../db/database";
import { SOLAR_STATUS_COLORS, PIPELINE_COLORS, PIPELINE_LABELS, type PipelineStage } from "../types/building";
import { estimatePeakPower } from "../lib/pvgis";
import { getDisplayCompany, getDisplayWebsite } from "../lib/leadAutoFill";
import { scoreColor } from "../lib/leadScore";
import { useFilteredBuildings } from "../hooks/useFilteredBuildings";

type SortKey = "name" | "area" | "kwp" | "company" | "pipeline" | "score";

export default function TableView() {
  const leads          = useAppStore((s) => s.leads);
  const selectBuilding = useAppStore((s) => s.selectBuilding);
  const setViewMode    = useAppStore((s) => s.setViewMode);
  const notify         = useAppStore((s) => s.notify);
  const selectionIds   = useAppStore((s) => s.selectionIds);
  const toggleSelection = useAppStore((s) => s.toggleSelection);
  const setSelectionIds = useAppStore((s) => s.setSelectionIds);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const setLeads       = useAppStore((s) => s.setLeads);
  const buildings      = useFilteredBuildings();

  const [sortKey, setSortKey]   = useState<SortKey>("score");
  const [sortDesc, setSortDesc] = useState(true);

  async function applyBulk(fn: () => Promise<void>, msg: string) {
    try {
      await fn();
      setLeads(await getAllLeads());
      notify(msg, "success");
      clearSelection();
    } catch (e) {
      notify(`Erro: ${e instanceof Error ? e.message : "desconhecido"}`, "error");
    }
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDesc(!sortDesc);
    else { setSortKey(k); setSortDesc(true); }
  }

  async function handleExport() {
    try {
      const csv = await exportLeadsCSV();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = "pye_leads.csv"; a.click();
      URL.revokeObjectURL(url);
      notify("CSV exportado", "success");
    } catch (e) {
      notify(`Erro ao exportar CSV: ${e instanceof Error ? e.message : "DB indisponível"}`, "error");
    }
  }

  // buildings already filtered by useFilteredBuildings hook; memoize the sort
  const rows = useMemo(() => buildings
    .slice()
    .sort((a, b) => {
      const la = leads[a.id], lb = leads[b.id];
      let va: string | number = 0, vb: string | number = 0;
      switch (sortKey) {
        case "name":     va = a.name ?? ""; vb = b.name ?? ""; break;
        case "area":     va = a.areaSqm;    vb = b.areaSqm;    break;
        case "kwp":      va = la?.estimatedKwp ?? estimatePeakPower(a.areaSqm);
                         vb = lb?.estimatedKwp ?? estimatePeakPower(b.areaSqm); break;
        case "company":  va = getDisplayCompany(a, la); vb = getDisplayCompany(b, lb); break;
        case "pipeline": va = la?.pipelineStage ?? ""; vb = lb?.pipelineStage ?? ""; break;
        case "score":    va = la?.score ?? 0; vb = lb?.score ?? 0; break;
      }
      if (typeof va === "string") return sortDesc ? vb.toString().localeCompare(va.toString()) : va.toString().localeCompare(vb.toString());
      return sortDesc ? (vb as number) - (va as number) : (va as number) - (vb as number);
    }), [buildings, leads, sortKey, sortDesc]);

  const stats = useMemo(() => {
    let totalArea = 0, totalKwp = 0;
    for (const b of buildings) {
      totalArea += b.areaSqm;
      totalKwp += leads[b.id]?.estimatedKwp ?? estimatePeakPower(b.areaSqm);
    }
    return { count: buildings.length, totalArea, totalKwp: Math.round(totalKwp) };
  }, [buildings, leads]);

  const Th = ({ label, k }: { label: string; k?: SortKey }) => (
    <th
      className={`px-4 py-2.5 text-left text-[11px] font-medium text-[#8892a4] uppercase tracking-wide whitespace-nowrap ${k ? "cursor-pointer hover:text-[#c8d0df]" : ""}`}
      onClick={k ? () => toggleSort(k) : undefined}
    >
      <span className="flex items-center gap-1">
        {label}
        {k && <ArrowUpDown size={11} className={sortKey === k ? "text-[#f97316]" : "opacity-40"} />}
      </span>
    </th>
  );

  return (
    <div className="flex flex-col h-full bg-[#0d0e1a] text-white">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-[#1e1f30] bg-[#13131f] shrink-0">
        <button
          type="button"
          onClick={() => setViewMode("map")}
          className="flex items-center gap-1.5 text-[#8892a4] hover:text-white text-xs transition-colors"
        >
          <X size={14} />
          <span>Back to Map</span>
        </button>
        <span className="text-[#1e1f30]">|</span>
        <span className="text-xs text-[#8892a4]">{stats.count.toLocaleString("pt-PT")} edifícios</span>
        <span className="text-[#1e1f30]">·</span>
        <span className="text-xs text-[#8892a4]">{(stats.totalArea / 1000).toLocaleString("pt-PT", { maximumFractionDigits: 0 })}k m²</span>
        <span className="text-[#1e1f30]">·</span>
        <span className="text-xs text-[#f97316]">{stats.totalKwp.toLocaleString("pt-PT", { maximumFractionDigits: 0 })} kWp total</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] hover:bg-[#ea6d0e] text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Bulk action bar */}
      {selectionIds.length > 0 && (
        <div className="flex items-center gap-3 px-5 py-2 bg-[#f97316]/15 border-b border-[#f97316]/30 shrink-0 text-xs">
          <span className="text-[#f97316] font-semibold">{selectionIds.length} selecionados</span>
          <span className="text-[#1e1f30]">|</span>
          <span className="text-[#8892a4]">Mudar fase:</span>
          {(["contacted", "meeting", "proposal", "won", "lost"] as PipelineStage[]).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => applyBulk(() => bulkSetStage(selectionIds, st), `${selectionIds.length} → ${PIPELINE_LABELS[st]}`)}
              className="px-2 py-0.5 rounded bg-[#1e1f30] hover:bg-[#252637] text-[#c8d0df]"
            >
              {PIPELINE_LABELS[st]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => applyBulk(() => bulkSetFlag(selectionIds, true), `${selectionIds.length} marcados`)}
            className="px-2 py-0.5 rounded bg-[#1e1f30] hover:bg-[#252637] text-[#eab308]"
          >
            ⚑ Marcar
          </button>
          <div className="flex-1" />
          <button type="button" onClick={clearSelection} className="text-[#8892a4] hover:text-white">Limpar</button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-[#13131f] border-b border-[#1e1f30]">
            <tr>
              <th className="px-3 py-2.5 w-8">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos"
                  className="accent-[#f97316]"
                  checked={rows.length > 0 && selectionIds.length === rows.length}
                  onChange={(e) => setSelectionIds(e.target.checked ? rows.map((b) => b.id) : [])}
                />
              </th>
              <Th label="Score" k="score" />
              <Th label="Location Name" k="name" />
              <Th label="Company"       k="company" />
              <Th label="Industry" />
              <Th label="Area (m²)"     k="area" />
              <Th label="Solar Potential (kWp)" k="kwp" />
              <Th label="Solar" />
              <Th label="Flag" />
              <Th label="Website" />
              <Th label="Direct Link" />
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const lead = leads[b.id];
              const kwp  = lead?.estimatedKwp ?? estimatePeakPower(b.areaSqm);
              const name = b.name ?? b.operator ?? `Way ${b.osmId ?? b.id.slice(0, 8)}`;
              const selected = selectionIds.includes(b.id);

              return (
                <tr
                  key={b.id}
                  onClick={() => { selectBuilding(b.id); setViewMode("map"); }}
                  className={`border-b border-[#1a1b2e] hover:bg-[#1a1b2e]/60 cursor-pointer transition-colors ${selected ? "bg-[#f97316]/10" : ""}`}
                >
                  {/* Selection checkbox */}
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${name}`}
                      className="accent-[#f97316]"
                      checked={selected}
                      onChange={() => toggleSelection(b.id)}
                    />
                  </td>

                  {/* Score */}
                  <td className="px-4 py-2.5">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-slate-950"
                      style={{ background: scoreColor(lead?.score ?? 0) }}
                    >
                      {lead?.score ?? "—"}
                    </span>
                  </td>

                  {/* Location Name */}
                  <td className="px-4 py-2.5 max-w-[200px]">
                    <span className="truncate block text-white font-medium">{name}</span>
                  </td>

                  {/* Company — OSM-aware display */}
                  <td className="px-4 py-2.5 max-w-[160px]">
                    <span className="truncate block text-[#c8d0df]" title={getDisplayCompany(b, lead)}>
                      {getDisplayCompany(b, lead)}
                    </span>
                  </td>

                  {/* Industry */}
                  <td className="px-4 py-2.5 text-[#8892a4]">
                    {lead?.buildingUse ? lead.buildingUse.replace("_", " ") : b.buildingTag ?? "—"}
                  </td>

                  {/* Area */}
                  <td className="px-4 py-2.5 text-[#c8d0df] tabular-nums">
                    {b.areaSqm.toLocaleString("pt-PT")}
                  </td>

                  {/* Solar Potential */}
                  <td className="px-4 py-2.5 tabular-nums">
                    <span className="text-[#f97316]">{kwp.toFixed(1)}</span>
                  </td>

                  {/* Solar icon */}
                  <td className="px-4 py-2.5">
                    {lead?.solarStatus && lead.solarStatus !== "unknown" ? (
                      <Sun
                        size={14}
                        style={{ color: SOLAR_STATUS_COLORS[lead.solarStatus] }}
                      />
                    ) : (
                      <span className="text-[#2a2b3d]">—</span>
                    )}
                  </td>

                  {/* Flag */}
                  <td className="px-4 py-2.5">
                    {lead?.pipelineStage && lead.pipelineStage !== "to_contact" ? (
                      <Flag
                        size={13}
                        style={{ color: PIPELINE_COLORS[lead.pipelineStage] }}
                        fill="currentColor"
                      />
                    ) : (
                      <span className="text-[#2a2b3d]">—</span>
                    )}
                  </td>

                  {/* Website — OSM-aware display */}
                  <td className="px-4 py-2.5 max-w-[160px]">
                    {(() => {
                      const w = getDisplayWebsite(b, lead);
                      if (!w) return <span className="text-[#2a2b3d]">—</span>;
                      return (
                        <a
                          href={w.startsWith("http") ? w : `https://${w}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[#60a5fa] hover:text-[#93c5fd] truncate block"
                          title={w}
                        >
                          {w.replace(/^https?:\/\//, "").slice(0, 28)}
                        </a>
                      );
                    })()}
                  </td>

                  {/* Direct Link */}
                  <td className="px-4 py-2.5">
                    {b.osmId ? (
                      <a
                        href={`https://www.openstreetmap.org/way/${b.osmId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[#8892a4] hover:text-white transition-colors"
                        title="Abrir no OSM"
                      >
                        <ExternalLink size={13} />
                      </a>
                    ) : (
                      <span className="text-[#2a2b3d]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-16 text-center text-[#4a5160] text-sm">
                  Sem edifícios. Usa "Get Rooftops" na barra lateral para importar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
