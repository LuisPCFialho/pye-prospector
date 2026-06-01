import { useAppStore } from "../store/appStore";
import { fetchBuildingsInBBox } from "../lib/overpass";
import { saveBuildingsBatch, getAllLeads, exportLeadsCSV } from "../db/database";
import { getViewportBBox } from "../lib/mapInstance";

const NAV_ITEMS = [
  { id: "get-rooftops", icon: "🏠", label: "Get Rooftops" },
  { id: "draw-rooftops", icon: "✏️", label: "Draw Rooftops" },
  { id: "search-filter", icon: "🔍", label: "Search Filter" },
  { id: "select", icon: "↖", label: "Select" },
  { id: "view-table", icon: "⊞", label: "View Table" },
  { id: "analytics", icon: "📊", label: "Analytics" },
] as const;

type NavId = (typeof NAV_ITEMS)[number]["id"];

export default function Sidebar() {
  const {
    drawMode, isLoadingBuildings, viewMode,
    setDrawMode, setLoadingBuildings, setLoadError,
    addBuildings, setLeads, setViewMode,
    setShowSearchFilter, showSearchFilter,
  } = useAppStore((s) => ({
    drawMode: s.drawMode,
    isLoadingBuildings: s.isLoadingBuildings,
    viewMode: s.viewMode,
    setDrawMode: s.setDrawMode,
    setLoadingBuildings: s.setLoadingBuildings,
    setLoadError: s.setLoadError,
    addBuildings: s.addBuildings,
    setLeads: s.setLeads,
    setViewMode: s.setViewMode,
    setShowSearchFilter: s.setShowSearchFilter,
    showSearchFilter: s.showSearchFilter,
  }));

  async function handleGetRooftops() {
    const bbox = getViewportBBox();
    if (!bbox) return;

    const bboxAreaDeg =
      (bbox.maxLon - bbox.minLon) * (bbox.maxLat - bbox.minLat);
    if (bboxAreaDeg > 0.05) {
      setLoadError("Área demasiado grande. Aproxima o mapa primeiro (zoom ≥ 13).");
      setTimeout(() => setLoadError(null), 4000);
      return;
    }

    setLoadingBuildings(true);
    setLoadError(null);
    try {
      const buildings = await fetchBuildingsInBBox(bbox);
      await saveBuildingsBatch(buildings);
      addBuildings(buildings);

      const leads = await getAllLeads();
      setLeads(leads);
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
      console.error("Export failed", e);
    }
  }

  async function handleNav(id: NavId) {
    switch (id) {
      case "get-rooftops":
        await handleGetRooftops();
        break;
      case "draw-rooftops":
        setDrawMode(drawMode === "polygon" ? "none" : "polygon");
        setViewMode("map");
        break;
      case "search-filter":
        setShowSearchFilter(!showSearchFilter);
        setViewMode("map");
        break;
      case "select":
        break;
      case "view-table":
        setViewMode("table");
        break;
      case "analytics":
        setViewMode("analytics");
        break;
    }
  }

  const activeId: NavId | null =
    viewMode === "table"
      ? "view-table"
      : viewMode === "analytics"
        ? "analytics"
        : drawMode === "polygon"
          ? "draw-rooftops"
          : showSearchFilter
            ? "search-filter"
            : null;

  return (
    <aside className="w-[220px] shrink-0 bg-[#12121e] border-r border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center font-bold text-slate-950 text-sm">
            P
          </div>
          <span className="font-bold tracking-tight text-white">PYE</span>
          <span className="text-slate-400 text-xs ml-1">Prospector</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {NAV_ITEMS.map(({ id, icon, label }) => (
          <button
            type="button"
            key={id}
            disabled={id === "get-rooftops" && isLoadingBuildings}
            onClick={() => handleNav(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              activeId === id
                ? "bg-brand-500/20 text-brand-400 font-medium"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            } ${id === "get-rooftops" && isLoadingBuildings ? "opacity-50 cursor-wait" : ""}`}
          >
            <span className="text-base w-5 text-center shrink-0">{icon}</span>
            <span>
              {id === "get-rooftops" && isLoadingBuildings ? "A carregar…" : label}
            </span>
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-4 pt-2 border-t border-slate-800 space-y-0.5">
        <button
          type="button"
          onClick={handleExportCSV}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
        >
          <span className="text-base w-5 text-center shrink-0">📥</span>
          <span>Exportar CSV</span>
        </button>
        <button type="button" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:text-slate-300 transition-all">
          <span className="text-base w-5 text-center shrink-0">⚙</span>
          <span>Definições</span>
        </button>
      </div>
    </aside>
  );
}
