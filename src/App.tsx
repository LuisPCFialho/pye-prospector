import { useEffect } from "react";
import { useAppStore } from "./store/appStore";
import { getAllBuildings, getAllLeads } from "./db/database";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import LocationSummary from "./components/LocationSummary";
import LocationDetails from "./components/LocationDetails";
import StreetViewModal from "./components/StreetViewModal";
import TableView from "./components/TableView";
import Dashboard from "./components/Dashboard";
import SearchFilter from "./components/SearchFilter";

export default function App() {
  const {
    viewMode,
    showLocationDetails,
    showStreetView,
    showSearchFilter,
    setBuildings,
    setLeads,
  } = useAppStore((s) => ({
    viewMode: s.viewMode,
    showLocationDetails: s.showLocationDetails,
    showStreetView: s.showStreetView,
    showSearchFilter: s.showSearchFilter,
    setBuildings: s.setBuildings,
    setLeads: s.setLeads,
  }));

  // Load persisted data from SQLite on startup
  useEffect(() => {
    getAllBuildings()
      .then(setBuildings)
      .catch(() => {});
    getAllLeads()
      .then(setLeads)
      .catch(() => {});
  }, [setBuildings, setLeads]);

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#0f0f1a] text-white">
      <Sidebar />
      <main className="flex-1 relative overflow-hidden">
        {viewMode === "map" && (
          <>
            <MapView />
            <LocationSummary />
            {showSearchFilter && <SearchFilter />}
            {showLocationDetails && <LocationDetails />}
            {showStreetView && <StreetViewModal />}
          </>
        )}
        {viewMode === "table" && <TableView />}
        {viewMode === "analytics" && <Dashboard />}
      </main>
    </div>
  );
}
