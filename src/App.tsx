import { useEffect } from "react";
import { useAppStore } from "./store/appStore";
import {
  getAllBuildings, getAllLeads, getAllNotes, getAllTasks,
} from "./db/database";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import LocationSummary from "./components/LocationSummary";
import LocationDetails from "./components/LocationDetails";
import StreetViewModal from "./components/StreetViewModal";
import TableView from "./components/TableView";
import Dashboard from "./components/Dashboard";
import SearchFilter from "./components/SearchFilter";
import MapSearch from "./components/MapSearch";
import KanbanView from "./components/KanbanView";
import QuickJumpMenu from "./components/QuickJumpMenu";
import AIAssistant from "./components/AIAssistant";

export default function App() {
  const viewMode = useAppStore((s) => s.viewMode);
  const showLocationDetails = useAppStore((s) => s.showLocationDetails);
  const showStreetView = useAppStore((s) => s.showStreetView);
  const showSearchFilter = useAppStore((s) => s.showSearchFilter);
  const showQuickJump = useAppStore((s) => s.showQuickJump);
  const successMessage = useAppStore((s) => s.successMessage);
  const setBuildings = useAppStore((s) => s.setBuildings);
  const setLeads = useAppStore((s) => s.setLeads);
  const setNotes = useAppStore((s) => s.setNotes);
  const setTasks = useAppStore((s) => s.setTasks);

  useEffect(() => {
    getAllBuildings().then(setBuildings).catch(() => {});
    getAllLeads().then(setLeads).catch(() => {});
    getAllNotes().then(setNotes).catch(() => {});
    getAllTasks().then(setTasks).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#0f0f1a] text-white">
      <Sidebar />
      <main className="flex-1 relative">
        {viewMode === "map" && (
          <>
            <MapView />
            <MapSearch />
            <LocationSummary />
            {showSearchFilter && <SearchFilter />}
            {showLocationDetails && <LocationDetails />}
            {showStreetView && <StreetViewModal />}
            {showQuickJump && <QuickJumpMenu />}
            <AIAssistant />
          </>
        )}
        {viewMode === "table" && <TableView />}
        {viewMode === "analytics" && <Dashboard />}
        {viewMode === "kanban" && <KanbanView />}

        {/* Success toast */}
        {successMessage && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 bg-green-900/95 border border-green-700 text-green-100 text-xs px-4 py-2 rounded-lg shadow-xl">
            ✓ {successMessage}
          </div>
        )}
      </main>
    </div>
  );
}
