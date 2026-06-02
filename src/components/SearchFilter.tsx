import { useState } from "react";
import { X } from "lucide-react";
import { useAppStore } from "../store/appStore";

export default function SearchFilter() {
  const buildings             = useAppStore((s) => s.buildings);
  const leads                 = useAppStore((s) => s.leads);
  const filterSolarStatus     = useAppStore((s) => s.filterSolarStatus);
  const filterPipelineStage   = useAppStore((s) => s.filterPipelineStage);
  const filterMinAreaSqm      = useAppStore((s) => s.filterMinAreaSqm);
  const filterMaxAreaSqm      = useAppStore((s) => s.filterMaxAreaSqm);
  const filterKeyword         = useAppStore((s) => s.filterKeyword);
  const filterOnlyFlagged     = useAppStore((s) => s.filterOnlyFlagged);
  const filterOnlyDropped     = useAppStore((s) => s.filterOnlyDropped);
  const filterExcludeDropped  = useAppStore((s) => s.filterExcludeDropped);

  const setFilterSolarStatus    = useAppStore((s) => s.setFilterSolarStatus);
  const setFilterPipelineStage  = useAppStore((s) => s.setFilterPipelineStage);
  const setFilterMinAreaSqm     = useAppStore((s) => s.setFilterMinAreaSqm);
  const setFilterMaxAreaSqm     = useAppStore((s) => s.setFilterMaxAreaSqm);
  const setFilterKeyword        = useAppStore((s) => s.setFilterKeyword);
  const setFilterOnlyFlagged    = useAppStore((s) => s.setFilterOnlyFlagged);
  const setFilterOnlyDropped    = useAppStore((s) => s.setFilterOnlyDropped);
  const setFilterExcludeDropped = useAppStore((s) => s.setFilterExcludeDropped);
  const setShowSearchFilter     = useAppStore((s) => s.setShowSearchFilter);

  const [localMin, setLocalMin] = useState(filterMinAreaSqm.toString());
  const [localMax, setLocalMax] = useState(filterMaxAreaSqm > 0 ? filterMaxAreaSqm.toString() : "");

  // Count matching results
  const matchCount = buildings.filter((b) => {
    const lead = leads[b.id];
    if (filterSolarStatus !== "all" && lead?.solarStatus !== filterSolarStatus) return false;
    if (filterPipelineStage !== "all" && lead?.pipelineStage !== filterPipelineStage) return false;
    const minA = filterMinAreaSqm || 0;
    if (minA > 0 && b.areaSqm < minA) return false;
    const maxA = filterMaxAreaSqm || 0;
    if (maxA > 0 && b.areaSqm > maxA) return false;
    if (filterKeyword) {
      const kw = filterKeyword.toLowerCase();
      const matches = [b.name, b.operator, lead?.company, lead?.tags].some((v) => v?.toLowerCase().includes(kw));
      if (!matches) return false;
    }
    if (filterOnlyFlagged && !lead?.flagged) return false;
    if (filterOnlyDropped && lead?.pipelineStage !== "lost") return false;
    if (filterExcludeDropped && lead?.pipelineStage === "lost") return false;
    return true;
  }).length;

  function handleApply() {
    setFilterMinAreaSqm(Number(localMin) || 0);
    setFilterMaxAreaSqm(Number(localMax) || 0);
    setShowSearchFilter(false);
  }

  function handleReset() {
    setFilterSolarStatus("all");
    setFilterPipelineStage("all");
    setFilterMinAreaSqm(0);
    setFilterMaxAreaSqm(0);
    setFilterKeyword("");
    setFilterOnlyFlagged(false);
    setFilterOnlyDropped(false);
    setFilterExcludeDropped(false);
    setLocalMin("0");
    setLocalMax("");
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
      <div className="w-[460px] max-h-[90vh] bg-[#13131f] border border-[#1e1f30] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e1f30]">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm text-white">Search Filter</span>
            <span className="text-[11px] text-[#8892a4] bg-[#1e1f30] px-2 py-0.5 rounded-full">
              {matchCount.toLocaleString("pt-PT")} results
            </span>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setShowSearchFilter(false)}
            className="w-6 h-6 rounded flex items-center justify-center text-[#8892a4] hover:text-white hover:bg-[#1e1f30] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Roof Area */}
          <section>
            <label className="block text-[10px] text-[#8892a4] uppercase tracking-wide mb-2">
              Roof Area (m²)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                aria-label="Área mínima"
                placeholder="Min"
                value={localMin}
                onChange={(e) => setLocalMin(e.target.value)}
                className="flex-1 h-8 bg-[#1e1f30] border border-[#2a2b3d] rounded-lg px-3 text-xs text-white placeholder-[#4a5160] focus:outline-none focus:border-[#f97316]/50"
              />
              <span className="text-[#4a5160] text-xs">—</span>
              <input
                type="number"
                aria-label="Área máxima"
                placeholder="Max"
                value={localMax}
                onChange={(e) => setLocalMax(e.target.value)}
                className="flex-1 h-8 bg-[#1e1f30] border border-[#2a2b3d] rounded-lg px-3 text-xs text-white placeholder-[#4a5160] focus:outline-none focus:border-[#f97316]/50"
              />
              <span className="text-[10px] text-[#4a5160]">m²</span>
            </div>
          </section>

          {/* Keywords */}
          <section>
            <label className="block text-[10px] text-[#8892a4] uppercase tracking-wide mb-2">
              Keywords
            </label>
            <input
              type="text"
              aria-label="Palavras-chave"
              placeholder="Nome, empresa, tags…"
              value={filterKeyword}
              onChange={(e) => setFilterKeyword(e.target.value)}
              className="w-full h-8 bg-[#1e1f30] border border-[#2a2b3d] rounded-lg px-3 text-xs text-white placeholder-[#4a5160] focus:outline-none focus:border-[#f97316]/50"
            />
          </section>

          {/* Quick Show */}
          <section>
            <label className="block text-[10px] text-[#8892a4] uppercase tracking-wide mb-2">
              Quick Show
            </label>
            <div className="flex gap-2">
              <ToggleBtn
                label="With Solar"
                active={filterSolarStatus === "has_panels"}
                onClick={() => setFilterSolarStatus(filterSolarStatus === "has_panels" ? "all" : "has_panels")}
                color="blue"
              />
              <ToggleBtn
                label="Without Solar"
                active={filterSolarStatus === "no_panels"}
                onClick={() => setFilterSolarStatus(filterSolarStatus === "no_panels" ? "all" : "no_panels")}
                color="red"
              />
              <ToggleBtn
                label="Not Tagged"
                active={filterPipelineStage === "to_contact"}
                onClick={() => setFilterPipelineStage(filterPipelineStage === "to_contact" ? "all" : "to_contact")}
                color="grey"
              />
            </div>
          </section>

          {/* Dropped Locations */}
          <section>
            <label className="block text-[10px] text-[#8892a4] uppercase tracking-wide mb-2">
              Dropped Locations
            </label>
            <div className="flex gap-2">
              <ToggleBtn
                label="Exclude Dropped"
                active={filterExcludeDropped}
                onClick={() => { setFilterExcludeDropped(!filterExcludeDropped); if (!filterExcludeDropped) setFilterOnlyDropped(false); }}
                color="grey"
              />
              <ToggleBtn
                label="Only Dropped"
                active={filterOnlyDropped}
                onClick={() => { setFilterOnlyDropped(!filterOnlyDropped); if (!filterOnlyDropped) setFilterExcludeDropped(false); }}
                color="orange"
              />
            </div>
          </section>

          {/* Solar Status */}
          <section>
            <label className="block text-[10px] text-[#8892a4] uppercase tracking-wide mb-2">
              Solar Status
            </label>
            <select
              aria-label="Estado solar"
              value={filterSolarStatus}
              onChange={(e) => setFilterSolarStatus(e.target.value as typeof filterSolarStatus)}
              className="w-full h-8 bg-[#1e1f30] border border-[#2a2b3d] rounded-lg px-3 text-xs text-white focus:outline-none focus:border-[#f97316]/50"
            >
              <option value="all">All</option>
              <option value="unknown">Unknown</option>
              <option value="no_panels">Without Solar</option>
              <option value="has_panels">With Solar</option>
              <option value="partial">Partial</option>
              <option value="inconclusive">Inconclusive</option>
            </select>
          </section>

          {/* Pipeline Stage */}
          <section>
            <label className="block text-[10px] text-[#8892a4] uppercase tracking-wide mb-2">
              Pipeline Stage
            </label>
            <select
              aria-label="Fase do pipeline"
              value={filterPipelineStage}
              onChange={(e) => setFilterPipelineStage(e.target.value as typeof filterPipelineStage)}
              className="w-full h-8 bg-[#1e1f30] border border-[#2a2b3d] rounded-lg px-3 text-xs text-white focus:outline-none focus:border-[#f97316]/50"
            >
              <option value="all">All Stages</option>
              <option value="to_contact">To Contact</option>
              <option value="contacted">Contacted</option>
              <option value="meeting">Meeting</option>
              <option value="proposal">Proposal</option>
              <option value="won">Won</option>
              <option value="lost">Lost / Dropped</option>
            </select>
          </section>

          {/* Only Flagged */}
          <section>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={filterOnlyFlagged}
                onChange={(e) => setFilterOnlyFlagged(e.target.checked)}
                className="w-4 h-4 accent-[#f97316] rounded"
              />
              <span className="text-sm text-[#c8d0df]">Only flagged locations</span>
            </label>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#1e1f30] flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 h-9 bg-[#1e1f30] hover:bg-[#252637] border border-[#2a2b3d] rounded-lg text-sm text-[#c8d0df] transition-colors"
          >
            Reset Criteria
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 h-9 bg-[#f97316] hover:bg-[#ea6d0e] rounded-lg text-sm text-white font-semibold transition-colors"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleBtn({
  label, active, onClick, color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color: "blue" | "red" | "grey" | "orange";
}) {
  const activeColors = {
    blue:   "bg-blue-500/20 text-blue-400 border-blue-500/40",
    red:    "bg-red-500/20 text-red-400 border-red-500/40",
    grey:   "bg-slate-600/20 text-slate-300 border-slate-500/40",
    orange: "bg-[#f97316]/15 text-[#f97316] border-[#f97316]/30",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
        active ? activeColors[color] : "bg-[#1e1f30] text-[#8892a4] border-[#2a2b3d] hover:border-[#3a3b4d] hover:text-[#c8d0df]"
      }`}
    >
      {label}
    </button>
  );
}
