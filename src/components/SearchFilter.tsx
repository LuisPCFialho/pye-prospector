import { useAppStore } from "../store/appStore";
import { SOLAR_STATUS_LABELS, PIPELINE_LABELS } from "../types/building";

export default function SearchFilter() {
  const {
    filterSolarStatus, filterPipelineStage, filterMinAreaSqm,
    setFilterSolarStatus, setFilterPipelineStage, setFilterMinAreaSqm,
    setShowSearchFilter,
  } = useAppStore((s) => ({
    filterSolarStatus: s.filterSolarStatus,
    filterPipelineStage: s.filterPipelineStage,
    filterMinAreaSqm: s.filterMinAreaSqm,
    setFilterSolarStatus: s.setFilterSolarStatus,
    setFilterPipelineStage: s.setFilterPipelineStage,
    setFilterMinAreaSqm: s.setFilterMinAreaSqm,
    setShowSearchFilter: s.setShowSearchFilter,
  }));

  return (
    <div className="absolute top-4 left-[228px] z-20 w-64 bg-[#1a1a2e] border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#12121e] border-b border-slate-700">
        <span className="text-sm font-semibold">Filtros</span>
        <button onClick={() => setShowSearchFilter(false)} className="text-slate-400 hover:text-white">×</button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Estado solar</label>
          <select
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none"
            value={filterSolarStatus}
            onChange={(e) => setFilterSolarStatus(e.target.value as typeof filterSolarStatus)}
          >
            <option value="all">Todos</option>
            {Object.entries(SOLAR_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Pipeline</label>
          <select
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none"
            value={filterPipelineStage}
            onChange={(e) => setFilterPipelineStage(e.target.value as typeof filterPipelineStage)}
          >
            <option value="all">Todos</option>
            {Object.entries(PIPELINE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">
            Área mínima: {filterMinAreaSqm.toLocaleString("pt-PT")} m²
          </label>
          <input
            type="range" min={0} max={10000} step={100}
            value={filterMinAreaSqm}
            onChange={(e) => setFilterMinAreaSqm(Number(e.target.value))}
            className="w-full accent-brand-500"
          />
        </div>
        <button
          onClick={() => { setFilterSolarStatus("all"); setFilterPipelineStage("all"); setFilterMinAreaSqm(0); }}
          className="w-full py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs"
        >
          Limpar filtros
        </button>
      </div>
    </div>
  );
}
