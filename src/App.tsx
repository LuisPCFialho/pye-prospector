import { useEffect } from "react";
import { useAppStore } from "./store/appStore";
import {
  getAllBuildings, getAllLeads, getAllNotes,
} from "./db/database";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import LocationSummary from "./components/LocationSummary";
import LocationDetails from "./components/LocationDetails";
import StreetViewModal from "./components/StreetViewModal";
import TableView from "./components/TableView";
import SearchFilter from "./components/SearchFilter";
import MapSearch from "./components/MapSearch";
import DropLocationDialog from "./components/DropLocationDialog";

export default function App() {
  const viewMode            = useAppStore((s) => s.viewMode);
  const showLocationDetails = useAppStore((s) => s.showLocationDetails);
  const showStreetView      = useAppStore((s) => s.showStreetView);
  const showSearchFilter    = useAppStore((s) => s.showSearchFilter);
  const showDropDialog      = useAppStore((s) => s.showDropDialog);
  const successMessage      = useAppStore((s) => s.successMessage);

  const setBuildings = useAppStore((s) => s.setBuildings);
  const setLeads     = useAppStore((s) => s.setLeads);
  const setNotes     = useAppStore((s) => s.setNotes);

  useEffect(() => {
    getAllBuildings().then(setBuildings).catch(() => {});
    getAllLeads().then(setLeads).catch(() => {});
    getAllNotes().then(setNotes).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#0d0e1a] text-white">
      <Sidebar />

      <main className="flex-1 relative overflow-hidden">
        <div className={viewMode === "map" ? "block absolute inset-0" : "hidden absolute inset-0"}>
          <MapView />
          <MapSearch />
          <LocationSummary />
          {showSearchFilter && <SearchFilter />}
          {showLocationDetails && <LocationDetails />}
          {showStreetView && <StreetViewModal />}
          {showDropDialog && <DropLocationDialog />}
        </div>

        {viewMode === "table" && <TableView />}

        {successMessage && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 bg-green-900/95 border border-green-700 text-green-100 text-xs px-4 py-2 rounded-lg shadow-xl pointer-events-none">
            ✓ {successMessage}
          </div>
        )}
      </main>
    </div>
  );
}
