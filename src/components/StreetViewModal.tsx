import { useEffect, useState } from "react";
import { useAppStore } from "../store/appStore";
import { findNearestImage, mapillaryEmbedUrl } from "../lib/mapillary";
import { openExternal, streetViewUrl } from "../lib/openExternal";

export default function StreetViewModal() {
  const selectedBuildingId = useAppStore((s) => s.selectedBuildingId);
  const buildings = useAppStore((s) => s.buildings);
  const setShowStreetView = useAppStore((s) => s.setShowStreetView);

  const building = buildings.find((b) => b.id === selectedBuildingId);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!building) return;
    setLoading(true);
    findNearestImage(building.centroidLat, building.centroidLon).then((key) => {
      setEmbedUrl(key ? mapillaryEmbedUrl(key) : null);
      setLoading(false);
    });
  }, [building]);

  if (!building) return null;

  const svUrl = streetViewUrl(building.centroidLat, building.centroidLon);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
      <div className="relative w-[720px] h-[440px] bg-[#1e1e2e] rounded-xl shadow-2xl border border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a2e] border-b border-slate-700">
          <span className="text-sm font-medium">Street View</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => openExternal(svUrl)}
              className="text-xs text-brand-400 hover:text-brand-300"
            >
              Abrir no Google Maps ↗
            </button>
            <button
              type="button"
              onClick={() => setShowStreetView(false)}
              className="text-slate-400 hover:text-white text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
        <div className="w-full h-[calc(100%-40px)]">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              A carregar Street View…
            </div>
          ) : embedUrl ? (
            <iframe src={embedUrl} className="w-full h-full border-0" title="Street View" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
              <span className="text-sm">Sem imagens Mapillary para esta localização.</span>
              <button
                type="button"
                onClick={() => openExternal(svUrl)}
                className="px-4 py-2 rounded bg-brand-500 hover:bg-brand-400 text-slate-950 text-sm font-semibold"
              >
                Abrir Google Maps Street View
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
