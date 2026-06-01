import { useEffect, useState } from "react";
import { useAppStore } from "../store/appStore";
import { getDashboardStats, type DashboardStats } from "../db/database";
import { SOLAR_STATUS_LABELS, PIPELINE_LABELS, SOLAR_STATUS_COLORS, PIPELINE_COLORS } from "../types/building";

export default function Dashboard() {
  const setViewMode = useAppStore((s) => s.setViewMode);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    getDashboardStats().then(setStats).catch(console.error);
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        A carregar estatísticas…
      </div>
    );
  }

  const maxSolar = Math.max(...Object.values(stats.bySolarStatus), 1);
  const maxPipeline = Math.max(...Object.values(stats.byPipelineStage), 1);

  return (
    <div className="flex flex-col h-full bg-[#0f0f1a] text-slate-100 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-800 bg-[#1a1a2e] shrink-0">
        <button onClick={() => setViewMode("map")} className="text-slate-400 hover:text-white text-sm">
          ← Mapa
        </button>
        <h1 className="text-lg font-semibold">Analytics</h1>
      </div>

      <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI cards */}
        <KpiCard label="Edifícios C&I" value={stats.totalBuildings.toLocaleString("pt-PT")} icon="🏭" />
        <KpiCard label="Leads" value={stats.totalLeads.toLocaleString("pt-PT")} icon="📋" />
        <KpiCard
          label="Área total"
          value={`${(stats.totalAreaSqm / 1_000_000).toFixed(2)} km²`}
          icon="📐"
        />
        <KpiCard
          label="Potencial solar"
          value={`${(stats.totalKwhPerYear / 1_000_000).toFixed(1)} GWh/ano`}
          icon="☀️"
        />
      </div>

      <div className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Solar status chart */}
        <div className="bg-[#1a1a2e] rounded-xl border border-slate-700 p-5">
          <h2 className="text-sm font-semibold mb-4">Estado Solar</h2>
          <div className="space-y-2">
            {Object.entries(SOLAR_STATUS_LABELS).map(([k, label]) => {
              const count = stats.bySolarStatus[k] ?? 0;
              const pct = maxSolar > 0 ? (count / maxSolar) * 100 : 0;
              return (
                <div key={k}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">{label}</span>
                    <span className="text-slate-400">{count}</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: SOLAR_STATUS_COLORS[k as keyof typeof SOLAR_STATUS_COLORS] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pipeline chart */}
        <div className="bg-[#1a1a2e] rounded-xl border border-slate-700 p-5">
          <h2 className="text-sm font-semibold mb-4">Pipeline</h2>
          <div className="space-y-2">
            {Object.entries(PIPELINE_LABELS).map(([k, label]) => {
              const count = stats.byPipelineStage[k] ?? 0;
              const pct = maxPipeline > 0 ? (count / maxPipeline) * 100 : 0;
              return (
                <div key={k}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">{label}</span>
                    <span className="text-slate-400">{count}</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: PIPELINE_COLORS[k as keyof typeof PIPELINE_COLORS] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-[#1a1a2e] rounded-xl border border-slate-700 p-4 flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
        <div className="text-xl font-bold text-slate-100 mt-0.5">{value}</div>
      </div>
    </div>
  );
}
