import { useAppStore } from "../store/appStore";
import { INDUSTRIAL_PARKS } from "../lib/industrialParks";
import { getMapInstance } from "../lib/mapInstance";

export default function QuickJumpMenu() {
  const setShowQuickJump = useAppStore((s) => s.setShowQuickJump);

  function jumpTo(lat: number, lon: number, zoom: number) {
    const map = getMapInstance();
    if (!map) return;
    map.flyTo({ center: [lon, lat], zoom, duration: 1200 });
    setShowQuickJump(false);
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
      <div className="w-[640px] max-h-[80vh] bg-[#1a1a2e] border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 bg-[#12121e] border-b border-slate-700">
          <div>
            <h2 className="font-semibold">Parques Industriais — Hotspots</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Salta diretamente para zonas com alto potencial solar C&amp;I
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowQuickJump(false)}
            className="w-7 h-7 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-4 grid grid-cols-2 gap-3">
          {INDUSTRIAL_PARKS.map((park) => (
            <button
              key={park.slug}
              type="button"
              onClick={() => jumpTo(park.lat, park.lon, park.zoom)}
              className="text-left bg-[#12121e] hover:bg-slate-800 border border-slate-700 hover:border-brand-500 rounded-lg p-3 transition group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase tracking-wide text-brand-400 font-semibold">
                  {park.region}
                </span>
                <span className="text-[10px] text-slate-500">
                  ~{park.estimatedBuildings} edifícios
                </span>
              </div>
              <h3 className="text-sm font-semibold text-slate-100 group-hover:text-brand-400 transition">
                {park.name}
              </h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{park.description}</p>
              <p className="text-[10px] text-slate-500 mt-2">
                {park.district} · {park.lat.toFixed(3)}, {park.lon.toFixed(3)}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
