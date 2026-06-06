import { useEffect, useState, lazy, Suspense } from "react";
import { useAppStore } from "./store/appStore";
import {
  getAllBuildings, getAllLeads, getAllNotes,
} from "./db/database";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import LocationSummary from "./components/LocationSummary";
import MapSearch from "./components/MapSearch";
import ToastContainer from "./components/ToastContainer";

// Code-split heavy / conditionally-rendered views to shrink the initial bundle
const LocationDetails   = lazy(() => import("./components/LocationDetails"));
const StreetViewModal   = lazy(() => import("./components/StreetViewModal"));
const TableView         = lazy(() => import("./components/TableView"));
const SearchFilter      = lazy(() => import("./components/SearchFilter"));
const DropLocationDialog = lazy(() => import("./components/DropLocationDialog"));

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

  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    getAllBuildings()
      .then(setBuildings)
      .catch(() => { /* DB not available in browser — silently skip */ });
    getAllLeads()
      .then(setLeads)
      .catch(() => {});
    getAllNotes()
      .then(setNotes)
      .catch(() => {});
    const onUp   = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    return () => {
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0d0e1a] text-white">
      {!online && (
        <div className="bg-red-900/90 text-red-100 text-xs px-4 py-1.5 text-center border-b border-red-700">
          Sem ligação à internet — algumas funções (Get Rooftops, PVGIS, Gemini) estão desativadas.
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
      <Sidebar />

      <main className="flex-1 relative overflow-hidden">
        <div className={viewMode === "map" ? "block absolute inset-0" : "hidden absolute inset-0"}>
          <MapView />
          <MapSearch />
          <LocationSummary />
          <Suspense fallback={null}>
            {showSearchFilter && <SearchFilter />}
            {showLocationDetails && <LocationDetails />}
            {showStreetView && <StreetViewModal />}
            {showDropDialog && <DropLocationDialog />}
          </Suspense>
        </div>

        {viewMode === "table" && (
          <Suspense fallback={<div className="flex items-center justify-center h-full text-[#8892a4] text-sm">A carregar tabela…</div>}>
            <TableView />
          </Suspense>
        )}

        {successMessage && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 bg-green-900/95 border border-green-700 text-green-100 text-xs px-4 py-2 rounded-lg shadow-xl pointer-events-none">
            ✓ {successMessage}
          </div>
        )}
      </main>
      </div>
      <ToastContainer />
    </div>
  );
}
