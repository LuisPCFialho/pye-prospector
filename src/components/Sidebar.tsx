import {
  Download, PenLine, SlidersHorizontal, MousePointer2,
  Layers, Table2, BarChart2, Map, Compass, Settings,
} from "lucide-react";
import { useAppStore } from "../store/appStore";
import { fetchBuildingsInBBox } from "../lib/overpass";
import { saveBuildingsBatch, getAllLeads } from "../db/database";
import { getViewportBBox } from "../lib/mapInstance";
import { exportToExcel } from "../lib/excel";

type NavId =
  | "get-rooftops" | "draw-rooftops" | "search-filter"
  | "select" | "view-table" | "analytics"
  | "layers" | "go-to" | "settings";

interface NavItem {
  id: NavId;
  icon: React.ReactNode;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "get-rooftops",  icon: <Download         size={16} />, label: "Get Rooftops" },
  { id: "draw-rooftops", icon: <PenLine          size={16} />, label: "Draw Rooftops" },
  { id: "search-filter", icon: <SlidersHorizontal size={16} />, label: "Search Filter" },
  { id: "select",        icon: <MousePointer2    size={16} />, label: "Select" },
  { id: "view-table",    icon: <Table2           size={16} />, label: "View Table" },
  { id: "analytics",     icon: <BarChart2        size={16} />, label: "Analytics" },
  { id: "layers",        icon: <Layers           size={16} />, label: "Layers" },
  { id: "go-to",         icon: <Compass          size={16} />, label: "Go To..." },
];

export default function Sidebar() {
  const drawMode            = useAppStore((s) => s.drawMode);
  const isLoadingBuildings  = useAppStore((s) => s.isLoadingBuildings);
  const viewMode            = useAppStore((s) => s.viewMode);
  const showSearchFilter    = useAppStore((s) => s.showSearchFilter);
  const showLayersPanel     = useAppStore((s) => s.showLayersPanel);
  const buildings           = useAppStore((s) => s.buildings);
  const leads               = useAppStore((s) => s.leads);
  const notes               = useAppStore((s) => s.notes);

  const setDrawMode         = useAppStore((s) => s.setDrawMode);
  const setLoadingBuildings = useAppStore((s) => s.setLoadingBuildings);
  const setLoadError        = useAppStore((s) => s.setLoadError);
  const notify              = useAppStore((s) => s.notify);
  const addBuildings        = useAppStore((s) => s.addBuildings);
  const setLeads            = useAppStore((s) => s.setLeads);
  const setViewMode         = useAppStore((s) => s.setViewMode);
  const setShowSearchFilter = useAppStore((s) => s.setShowSearchFilter);
  const setShowLayersPanel  = useAppStore((s) => s.setShowLayersPanel);

  async function handleGetRooftops() {
    const bbox = getViewportBBox();
    if (!bbox) return;
    const bboxAreaDeg = (bbox.maxLon - bbox.minLon) * (bbox.maxLat - bbox.minLat);
    if (bboxAreaDeg > 0.25) {
      notify("Área demasiado grande. Aproxima o mapa um pouco (zoom ≥ 12).", "warning");
      return;
    }
    setLoadingBuildings(true);
    setLoadError(null);
    try {
      const fetched = await fetchBuildingsInBBox(bbox);
      if (fetched.length === 0) {
        notify("Nenhum edifício encontrado nesta área. Tenta outra zona ou afasta o zoom.", "warning");
      } else {
        addBuildings(fetched);
        const ci = fetched.filter((b) => (b.ciScore ?? 0) >= 0.5).length;
        notify(`${fetched.length} edifícios carregados (${ci} comerciais/industriais)`, "success");
        try {
          await saveBuildingsBatch(fetched);
          setLeads(await getAllLeads());
        } catch { /* no Tauri (browser) — kept in memory */ }
      }
    } catch (e) {
      notify(`Erro ao carregar edifícios: ${e instanceof Error ? e.message : "Overpass"}`, "error");
    } finally {
      setLoadingBuildings(false);
    }
  }

  function handleExportExcel() {
    if (buildings.length === 0) {
      notify("Sem edifícios para exportar. Usa 'Get Rooftops' primeiro.", "warning");
      return;
    }
    try {
      exportToExcel({ buildings, leads, notes });
      notify(`Excel exportado (${buildings.length} edifícios)`, "success");
    } catch (e) {
      notify(`Erro ao exportar Excel: ${e instanceof Error ? e.message : "desconhecido"}`, "error");
    }
  }

  function handleGoToSearch() {
    setViewMode("map");
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Pesquisar localização"]');
    if (input) { input.focus(); input.select(); }
  }

  async function handleNav(id: NavId) {
    switch (id) {
      case "get-rooftops": await handleGetRooftops(); break;
      case "draw-rooftops":
        setDrawMode(drawMode === "polygon" ? "none" : "polygon");
        setViewMode("map");
        break;
      case "search-filter":
        setShowSearchFilter(!showSearchFilter);
        setViewMode("map");
        break;
      case "select":
        setViewMode("map");
        break;
      case "view-table":  setViewMode("table"); break;
      case "analytics":   setViewMode("table"); break; // table view doubles as analytics for now
      case "layers":
        setShowLayersPanel(!showLayersPanel);
        setViewMode("map");
        break;
      case "go-to":      handleGoToSearch(); break;
      case "settings":   notify("Definições em breve", "info"); break;
    }
  }

  function activeId(): NavId | null {
    if (viewMode === "table")    return "view-table";
    if (drawMode === "polygon")  return "draw-rooftops";
    if (showLayersPanel)         return "layers";
    if (showSearchFilter)        return "search-filter";
    return null;
  }
  const active = activeId();

  return (
    <aside className="w-[200px] shrink-0 bg-[#13131f] border-r border-[#1e1f30] flex flex-col select-none">
      <div className="px-4 py-4 border-b border-[#1e1f30]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#f97316] flex items-center justify-center shrink-0 overflow-hidden">
            <Map size={16} className="text-white" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-white">PYE Prospector</span>
        </div>
      </div>

      <nav className="flex-1 py-2 px-1.5 overflow-y-auto space-y-px">
        {NAV_ITEMS.map(({ id, icon, label }) => (
          <NavButton
            key={id}
            icon={icon}
            label={id === "get-rooftops" && isLoadingBuildings ? "A carregar…" : label}
            active={active === id}
            disabled={id === "get-rooftops" && isLoadingBuildings}
            onClick={() => handleNav(id)}
          />
        ))}

        <div className="my-2 border-t border-[#1e1f30]" />

        <NavButton
          icon={<Settings size={16} />}
          label="Settings"
          active={false}
          onClick={() => handleNav("settings")}
        />
      </nav>

      <div className="px-1.5 pb-3 pt-1 border-t border-[#1e1f30] space-y-px">
        <NavButton
          icon={<Download size={16} />}
          label="Exportar Excel"
          active={false}
          onClick={handleExportExcel}
        />
      </div>
    </aside>
  );
}

function NavButton({
  icon, label, active, disabled, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-all duration-100 ${
        active
          ? "bg-[#f97316]/15 text-[#f97316]"
          : "text-[#8892a4] hover:bg-[#1e1f30] hover:text-[#c8d0df]"
      } ${disabled ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      <span className="truncate font-medium">{label}</span>
    </button>
  );
}
