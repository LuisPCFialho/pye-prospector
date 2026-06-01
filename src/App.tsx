import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";

export default function App() {
  return (
    <div className="h-screen w-screen flex flex-col">
      <header className="h-12 shrink-0 border-b border-slate-800 bg-slate-900 flex items-center px-4 gap-3">
        <div className="w-7 h-7 rounded bg-brand-500 flex items-center justify-center font-bold text-slate-950">
          P
        </div>
        <h1 className="font-semibold tracking-tight">PYE Prospector</h1>
        <span className="text-xs text-slate-400">MVP · Lisboa AML</span>
      </header>
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <main className="flex-1 relative">
          <MapView />
        </main>
      </div>
    </div>
  );
}
