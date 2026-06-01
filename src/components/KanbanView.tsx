import { useAppStore } from "../store/appStore";
import {
  KANBAN_COLUMNS, PIPELINE_LABELS, PIPELINE_COLORS,
  type PipelineStage,
} from "../types/building";
import ScoringBadge from "./ScoringBadge";

export default function KanbanView() {
  const buildings = useAppStore((s) => s.buildings);
  const leads = useAppStore((s) => s.leads);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const selectBuilding = useAppStore((s) => s.selectBuilding);

  const allLeads = Object.values(leads);

  function leadsForColumn(stages: PipelineStage[]) {
    return allLeads.filter((l) => stages.includes(l.pipelineStage));
  }

  return (
    <div className="flex flex-col h-full bg-[#0f0f1a] text-slate-100 overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-3 border-b border-slate-800 bg-[#1a1a2e] shrink-0">
        <button
          type="button"
          onClick={() => setViewMode("map")}
          className="text-slate-400 hover:text-white text-sm"
        >
          ← Mapa
        </button>
        <h1 className="text-lg font-semibold">Pipeline Kanban</h1>
        <span className="text-xs text-slate-500">{allLeads.length} leads</span>
      </div>

      <div className="flex-1 overflow-x-auto p-4">
        <div className="grid grid-cols-4 gap-4 h-full min-w-[1100px]">
          {KANBAN_COLUMNS.map((col) => {
            const items = leadsForColumn(col.id);
            return (
              <div key={col.label} className="flex flex-col bg-[#12121e] rounded-lg border border-slate-800 overflow-hidden">
                <div
                  className="px-3 py-2 flex items-center justify-between border-b border-slate-800"
                  style={{ background: col.color + "15" }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                    <h3 className="text-sm font-semibold">{col.label}</h3>
                  </div>
                  <span className="text-xs text-slate-400">{items.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {items.length === 0 ? (
                    <p className="text-xs text-slate-600 italic text-center py-6">
                      Sem leads neste estado
                    </p>
                  ) : (
                    items.map((lead) => {
                      const b = buildings.find((x) => x.id === lead.buildingId);
                      const title = lead.company || b?.name || b?.operator || `Edifício ${b?.osmId ?? lead.buildingId.slice(0, 8)}`;
                      const stageColor = PIPELINE_COLORS[lead.pipelineStage];
                      return (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => {
                            selectBuilding(lead.buildingId);
                            setViewMode("map");
                          }}
                          className="w-full text-left bg-[#1a1a2e] hover:bg-slate-800 border border-slate-700 hover:border-brand-500 rounded-lg p-3 transition"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <h4 className="text-xs font-semibold text-slate-100 line-clamp-2 flex-1">{title}</h4>
                            {lead.score !== undefined && (
                              <ScoringBadge score={lead.score} size="sm" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                            <span
                              className="px-1.5 py-0.5 rounded-full"
                              style={{ background: stageColor + "30", color: stageColor }}
                            >
                              {PIPELINE_LABELS[lead.pipelineStage]}
                            </span>
                            {lead.estimatedKwp && (
                              <span>{Math.round(lead.estimatedKwp)} kWp</span>
                            )}
                            {lead.estimatedValueEur && (
                              <span className="text-brand-400 font-semibold">
                                {(lead.estimatedValueEur / 1000).toFixed(0)}k €
                              </span>
                            )}
                          </div>
                          {b && (
                            <p className="text-[10px] text-slate-500 mt-1">
                              {Math.round(b.areaSqm).toLocaleString("pt-PT")} m²
                            </p>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
