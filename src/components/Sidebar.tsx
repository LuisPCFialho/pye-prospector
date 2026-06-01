import { useAppStore } from "../store/appStore";
import { fetchBuildingsInBBox } from "../lib/overpass";
import { saveBuildingsBatch, getAllLeads, exportLeadsCSV } from "../db/database";
import { getViewportBBox } from "../lib/mapInstance";
import { exportToExcel } from "../lib/excel";

type NavId =
  | "get-rooftops" | "draw-rooftops" | "search-filter"
  | "quick-jump" | "view-table" | "kanban" | "analytics" | "ai-assistant";

const NAV_ITEMS: { id: NavId; icon: string; label: string }[] = [
  { id: "get-rooftops", icon: "🏠", label: "Get Rooftops" },
  { id: "draw-rooftops", icon: "✏️", label: "Draw Rooftops" },
  { id: "quick-jump", icon: "📍", label: "Parques PT" },
  { id: "search-filter", icon: "🔍", label: "Filtros" },
  { id: "view-table", icon: "⊞", label: "Tabela" },
  { id: "kanban", icon: "📋", label: "Kanban" },
  { id: "analytics", icon: "📊", label: "Analytics" },
  { id: "ai-assistant", icon: "🤖", label: "AI Assistant" },
];

export default function Sidebar() {
  const drawMode = useAppStore((s) => s.drawMode);
  const isLoadingBuildings = useAppStore((s) => s.isLoadingBuildings);
  const viewMode = useAppStore((s) => s.viewMode);
  const showSearchFilter = useAppStore((s) => s.showSearchFilter);
  const showAIAssistant = useAppStore((s) => s.showAIAssistant);
  const showQuickJump = useAppStore((s) => s.showQuickJump);
  const buildings = useAppStore((s) => s.buildings);
  const leads = useAppStore((s) => s.leads);
  const notes = useAppStore((s) => s.notes);
  const tasks = useAppStore((s) => s.tasks);
  const setDrawMode = useAppStore((s) => s.setDrawMode);
  const setLoadingBuildings = useAppStore((s) => s.setLoadingBuildings);
  const setLoadError = useAppStore((s) => s.setLoadError);
  const setSuccessMessage = useAppStore((s) => s.setSuccessMessage);
  const addBuildings = useAppStore((s) => s.addBuildings);
  const setLeads = useAppStore((s) => s.setLeads);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const setShowSearchFilter = useAppStore((s) => s.setShowSearchFilter);
  const setShowAIAssistant = useAppStore((s) => s.setShowAIAssistant);
  const setShowQuickJump = useAppStore((s) => s.setShowQuickJump);

  async function handleGetRooftops() {
    const bbox = getViewportBBox();
    if (!bbox) return;

    const bboxAreaDeg = (bbox.maxLon - bbox.minLon) * (bbox.maxLat - bbox.minLat);
    if (bboxAreaDeg > 0.04) {
      setLoadError("Área demasiado grande. Aproxima o mapa (zoom ≥ 14).");
      setTimeout(() => setLoadError(null), 4000);
      return;
    }
    if (bboxAreaDeg < 0.000001) {
      setLoadError("Zoom demasiado elevado. Afasta o mapa.");
      setTimeout(() => setLoadError(null), 4000);
      return;
    }

    setLoadingBuildings(true);
    setLoadError(null);
    try {
      const fetched = await fetchBuildingsInBBox(bbox);
      if (fetched.length === 0) {
        setLoadError("Nenhum edifício encontrado nesta área.");
        setTimeout(() => setLoadError(null), 4000);
      } else {
        addBuildings(fetched);
        setSuccessMessage(`${fetched.length} edifícios carregados`);
        setTimeout(() => setSuccessMessage(null), 3000);
        try {
          await saveBuildingsBatch(fetched);
          setLeads(await getAllLeads());
        } catch {
          // No Tauri bridge — skip persistence
        }
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Erro Overpass");
    } finally {
      setLoadingBuildings(false);
    }
  }

  async function handleExportCSV() {
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
      console.error(e);
    }
  }

  function handleExportExcel() {
    try {
      exportToExcel({ buildings, leads, notes, tasks });
      setSuccessMessage("Excel exportado");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      console.error(e);
      setLoadError("Erro ao exportar Excel");
      setTimeout(() => setLoadError(null), 4000);
    }
  }

  async function handleNav(id: NavId) {
    switch (id) {
      case "get-rooftops": await handleGetRooftops(); break;
      case "draw-rooftops":
        setDrawMode(drawMode === "polygon" ? "none" : "polygon");
        setViewMode("map");
        break;
      case "quick-jump":
        setShowQuickJump(true); setViewMode("map");
        break;
      case "search-filter":
        setShowSearchFilter(!showSearchFilter); setViewMode("map");
        break;
      case "view-table": setViewMode("table"); break;
      case "kanban": setViewMode("kanban"); break;
      case "analytics": setViewMode("analytics"); break;
      case "ai-assistant":
        setShowAIAssistant(true); setViewMode("map");
        break;
    }
  }

  function activeId(): NavId | null {
    if (viewMode === "table") return "view-table";
    if (viewMode === "analytics") return "analytics";
    if (viewMode === "kanban") return "kanban";
    if (drawMode === "polygon") return "draw-rooftops";
    if (showQuickJump) return "quick-jump";
    if (showAIAssistant) return "ai-assistant";
    if (showSearchFilter) return "search-filter";
    return null;
  }
  const active = activeId();

  return (
    <aside className="w-[220px] shrink-0 bg-[#12121e] border-r border-slate-800 flex flex-col">
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center font-bold text-slate-950 text-sm">
            P
          </div>
          <span className="font-bold tracking-tight text-white">PYE</span>
          <span className="text-slate-400 text-xs ml-1">Prospector</span>
        </div>
      </div>

      <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
        {NAV_ITEMS.map(({ id, icon, label }) => (
          <button
            type="button"
            key={id}
            disabled={id === "get-rooftops" && isLoadingBuildings}
            onClick={() => handleNav(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              active === id
                ? "bg-brand-500/20 text-brand-400 font-medium"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            } ${id === "get-rooftops" && isLoadingBuildings ? "opacity-50 cursor-wait" : ""}`}
          >
            <span className="text-base w-5 text-center shrink-0">{icon}</span>
            <span className="truncate">
              {id === "get-rooftops" && isLoadingBuildings ? "A carregar…" : label}
            </span>
          </button>
        ))}
      </nav>

      <div className="px-2 pb-4 pt-2 border-t border-slate-800 space-y-0.5">
        <button
          type="button"
          onClick={handleExportExcel}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
        >
          <span className="text-base w-5 text-center shrink-0">📊</span>
          <span>Exportar Excel</span>
        </button>
        <button
          type="button"
          onClick={handleExportCSV}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
        >
          <span className="text-base w-5 text-center shrink-0">📥</span>
          <span>Exportar CSV</span>
        </button>
      </div>
    </aside>
  );
}
