import { useEffect, useRef } from "react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import { config } from "../config";

const SATELLITE_STYLE_URL = (key: string) =>
  `https://api.maptiler.com/maps/hybrid/style.json?key=${key}`;

const OSM_RASTER_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
} as const;

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const style = config.maptilerApiKey
      ? SATELLITE_STYLE_URL(config.maptilerApiKey)
      : (OSM_RASTER_STYLE as unknown as maplibregl.StyleSpecification);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [config.defaultCenter.lon, config.defaultCenter.lat],
      zoom: config.defaultZoom,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />
      {!config.maptilerApiKey && (
        <div className="absolute top-3 left-3 max-w-sm rounded-md bg-amber-900/90 border border-amber-700 text-amber-50 text-xs p-3 shadow-lg">
          <strong>Modo fallback (OSM):</strong> sem chave MapTiler. Define{" "}
          <code className="bg-amber-950 px-1 rounded">VITE_MAPTILER_API_KEY</code> em{" "}
          <code className="bg-amber-950 px-1 rounded">.env</code> para vista satélite.
        </div>
      )}
    </>
  );
}
