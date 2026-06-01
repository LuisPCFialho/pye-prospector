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
  const viewMode = useAppStore((s) => s.viewMode);
  const showLocationDetails = useAppStore((s) => s.showLocationDetails);
  const showStreetView = useAppStore((s) => s.showStreetView);
  const showSearchFilter = useAppStore((s) => s.showSearchFilter);
  const setBuildings = useAppStore((s) => s.setBuildings);
  const setLeads = useAppStore((s) => s.setLeads);

  useEffect(() => {
    getAllBuildings().then(setBuildings).catch(() => {});
    getAllLeads().then(setLeads).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
