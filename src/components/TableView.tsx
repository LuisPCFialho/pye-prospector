import { useState } from "react";
import { ArrowUpDown, ExternalLink, Sun, Flag, X } from "lucide-react";
import { useAppStore } from "../store/appStore";
import { exportLeadsCSV } from "../db/database";
import { SOLAR_STATUS_COLORS, PIPELINE_COLORS } from "../types/building";
import { estimatePeakPower } from "../lib/pvgis";

type SortKey = "name" | "area" | "kwp" | "company" | "pipeline";

export default function TableView() {
  const buildings         = useAppStore((s) => s.buildings);
  const leads             = useAppStore((s) => s.leads);
  const filterSolarStatus = useAppStore((s) => s.filterSolarStatus);
  const filterMinAreaSqm  = useAppStore((s) => s.filterMinAreaSqm);
  const filterMaxAreaSqm  = useAppStore((s) => s.filterMaxAreaSqm);
  const filterKeyword     = useAppStore((s) => s.filterKeyword);
  const selectBuilding    = useAppStore((s) => s.selectBuilding);
  const setViewMode       = useAppStore((s) => s.setViewMode);

  const [sortKey, setSortKey]   = useState<SortKey>("area");
  const [sortDesc, setSortDesc] = useState(true);

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
    } catch { /* ignore */ }
  }

  const rows = buildings
    .filter((b) => {
      const lead = leads[b.id];
      if (filterSolarStatus !== "all" && lead?.solarStatus !== filterSolarStatus) return false;
      const minA = filterMinAreaSqm || 0;
      if (minA > 0 && b.areaSqm < minA) return false;
      const maxA = filterMaxAreaSqm || 0;
      if (maxA > 0 && b.areaSqm > maxA) return false;
      if (filterKeyword) {
        const kw = filterKeyword.toLowerCase();
        const hit = [b.name, b.operator, lead?.company].some((v) => v?.toLowerCase().includes(kw));
        if (!hit) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const la = leads[a.id], lb = leads[b.id];
      let va: string | number = 0, vb: string | number = 0;
      switch (sortKey) {
        case "name":     va = a.name ?? ""; vb = b.name ?? ""; break;
        case "area":     va = a.areaSqm;    vb = b.areaSqm;    break;
        case "kwp":      va = la?.estimatedKwp ?? estimatePeakPower(a.areaSqm);
                         vb = lb?.estimatedKwp ?? estimatePeakPower(b.areaSqm); break;
        case "company":  va = la?.company ?? ""; vb = lb?.company ?? ""; break;
        case "pipeline": va = la?.pipelineStage ?? ""; vb = lb?.pipelineStage ?? ""; break;
      }
      if (typeof va === "string") return sortDesc ? vb.toString().localeCompare(va.toString()) : va.toString().localeCompare(vb.toString());
      return sortDesc ? (vb as number) - (va as number) : (va as number) - (vb as number);
    });

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
        <span className="text-xs text-[#8892a4]">{rows.length.toLocaleString("pt-PT")} locations</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] hover:bg-[#ea6d0e] text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Export
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-[#13131f] border-b border-[#1e1f30]">
            <tr>
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

              return (
                <tr
                  key={b.id}
                  onClick={() => { selectBuilding(b.id); setViewMode("map"); }}
                  className="border-b border-[#1a1b2e] hover:bg-[#1a1b2e]/60 cursor-pointer transition-colors"
                >
                  {/* Location Name */}
                  <td className="px-4 py-2.5 max-w-[200px]">
                    <span className="truncate block text-white font-medium">{name}</span>
                  </td>

                  {/* Company */}
                  <td className="px-4 py-2.5 max-w-[160px]">
                    <span className="truncate block text-[#c8d0df]">{lead?.company ?? "—"}</span>
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

                  {/* Website */}
                  <td className="px-4 py-2.5 max-w-[160px]">
                    {lead?.website ? (
                      <a
                        href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[#60a5fa] hover:text-[#93c5fd] truncate block"
                        title={lead.website}
                      >
                        {lead.website.replace(/^https?:\/\//, "").slice(0, 28)}
                      </a>
                    ) : (
                      <span className="text-[#2a2b3d]">—</span>
                    )}
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
                <td colSpan={9} className="px-4 py-16 text-center text-[#4a5160] text-sm">
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
