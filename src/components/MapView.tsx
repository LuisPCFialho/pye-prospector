import { useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { config } from "../config";
import { setMapInstance } from "../lib/mapInstance";
import { useAppStore } from "../store/appStore";
import { buildingsToGeoJSON } from "../lib/overpass";
import { saveBuildingsBatch, getAllLeads } from "../db/database";
import { fetchBuildingsInBBox } from "../lib/overpass";
import * as turf from "@turf/turf";

const SATELLITE_STYLE = (key: string) =>
  `https://api.maptiler.com/maps/hybrid/style.json?key=${key}`;

const OSM_STYLE: maplibregl.StyleSpecification = {
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
};

const BUILDINGS_SOURCE = "buildings";
const DRAW_SOURCE = "draw-polygon";

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const selectedIdRef = useRef<number | string | null>(null);
  const drawCoordsRef = useRef<[number, number][]>([]);

  const {
    buildings, drawMode, selectedBuildingId,
    selectBuilding, addBuildings, setLeads,
    setDrawMode, setLoadingBuildings, setLoadError, loadError,
  } = useAppStore((s) => ({
    buildings: s.buildings,
    drawMode: s.drawMode,
    selectedBuildingId: s.selectedBuildingId,
    selectBuilding: s.selectBuilding,
    addBuildings: s.addBuildings,
    setLeads: s.setLeads,
    setDrawMode: s.setDrawMode,
    setLoadingBuildings: s.setLoadingBuildings,
    setLoadError: s.setLoadError,
    loadError: s.loadError,
  }));

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: config.maptilerApiKey ? SATELLITE_STYLE(config.maptilerApiKey) : OSM_STYLE,
      center: [config.defaultCenter.lon, config.defaultCenter.lat],
      zoom: config.defaultZoom,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    map.on("load", () => {
      // Buildings source + layers
      map.addSource(BUILDINGS_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        generateId: true,
      });

      map.addLayer({
        id: "buildings-fill",
        type: "fill",
        source: BUILDINGS_SOURCE,
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false], "#00d4d4",
            "#ef4444",
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false], 0.45, 0.25,
          ],
        },
      });

      map.addLayer({
        id: "buildings-outline",
        type: "line",
        source: BUILDINGS_SOURCE,
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false], "#00d4d4",
            "#ef4444",
          ],
          "line-width": 1.5,
        },
      });

      // Draw polygon source + layers
      map.addSource(DRAW_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "draw-fill",
        type: "fill",
        source: DRAW_SOURCE,
        paint: { "fill-color": "#f97316", "fill-opacity": 0.15 },
      });

      map.addLayer({
        id: "draw-line",
        type: "line",
        source: DRAW_SOURCE,
        paint: { "line-color": "#f97316", "line-width": 2, "line-dasharray": [4, 2] },
      });
    });

    setMapInstance(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapInstance(null as unknown as maplibregl.Map);
    };
  }, []);

  // Click handler — building selection OR draw point
  const handleMapClick = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      const map = mapRef.current;
      if (!map) return;

      if (useAppStore.getState().drawMode === "polygon") {
        const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        drawCoordsRef.current = [...drawCoordsRef.current, pt];
        updateDrawLayer(map, drawCoordsRef.current);
        return;
      }

      // Building click
      const features = map.queryRenderedFeatures(e.point, { layers: ["buildings-fill"] });
      if (!features.length) {
        // Deselect
        if (selectedIdRef.current !== null) {
          map.setFeatureState({ source: BUILDINGS_SOURCE, id: selectedIdRef.current }, { selected: false });
          selectedIdRef.current = null;
        }
        selectBuilding(null);
        return;
      }

      const feat = features[0];
      if (feat.id === undefined) return;

      if (selectedIdRef.current !== null && selectedIdRef.current !== feat.id) {
        map.setFeatureState({ source: BUILDINGS_SOURCE, id: selectedIdRef.current }, { selected: false });
      }
      map.setFeatureState({ source: BUILDINGS_SOURCE, id: feat.id }, { selected: true });
      selectedIdRef.current = feat.id;

      const buildingId = feat.properties?.id as string;
      selectBuilding(buildingId);
    },
    [selectBuilding],
  );

  // Double-click: finish polygon draw
  const handleDblClick = useCallback(
    async (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      const map = mapRef.current;
      if (!map || useAppStore.getState().drawMode !== "polygon") return;

      const coords = drawCoordsRef.current;
      if (coords.length < 3) return;

      // Close polygon
      const closed = [...coords, coords[0]];
      const poly = turf.polygon([closed]);
      const bbox = turf.bbox(poly);

      // Clear draw
      clearDraw(map);
      setDrawMode("none");
      map.getCanvas().style.cursor = "";

      // Fetch buildings in bbox
      const bboxObj = { minLon: bbox[0], minLat: bbox[1], maxLon: bbox[2], maxLat: bbox[3] };
      setLoadingBuildings(true);
      setLoadError(null);
      try {
        const all = await fetchBuildingsInBBox(bboxObj);
        // Filter to buildings actually inside polygon
        const inside = all.filter((b) =>
          turf.booleanPointInPolygon(
            turf.point([b.centroidLon, b.centroidLat]),
            poly,
          ),
        );
        await saveBuildingsBatch(inside);
        addBuildings(inside);
        const leads = await getAllLeads();
        setLeads(leads);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Erro Overpass");
      } finally {
        setLoadingBuildings(false);
      }
    },
    [addBuildings, setLeads, setDrawMode, setLoadingBuildings, setLoadError],
  );

  // Key handler — ESC cancels draw
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && mapRef.current) {
        clearDraw(mapRef.current);
        setDrawMode("none");
        mapRef.current.getCanvas().style.cursor = "";
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setDrawMode]);

  // Register/unregister map click handlers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.on("click", handleMapClick);
    map.on("dblclick", handleDblClick);
    return () => {
      map.off("click", handleMapClick);
      map.off("dblclick", handleDblClick);
    };
  }, [handleMapClick, handleDblClick]);

  // Update draw cursor
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = drawMode === "polygon" ? "crosshair" : "";
    if (drawMode === "none") {
      clearDraw(map);
      drawCoordsRef.current = [];
    }
  }, [drawMode]);

  // Update buildings layer when buildings change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource(BUILDINGS_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(buildingsToGeoJSON(buildings));
  }, [buildings]);

  // Fly to selected building
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedBuildingId) return;
    const b = useAppStore.getState().buildings.find((x) => x.id === selectedBuildingId);
    if (b) map.easeTo({ center: [b.centroidLon, b.centroidLat], duration: 400 });
  }, [selectedBuildingId]);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />

      {/* No MapTiler key warning */}
      {!config.maptilerApiKey && (
        <div className="absolute top-3 left-3 max-w-xs rounded-lg bg-amber-900/90 border border-amber-700 text-amber-50 text-xs p-3 shadow-lg z-10">
          <strong>Vista satélite inativa.</strong> Define{" "}
          <code className="bg-amber-950 px-1 rounded">VITE_MAPTILER_API_KEY</code> em{" "}
          <code className="bg-amber-950 px-1 rounded">.env</code>
        </div>
      )}

      {/* Error toast */}
      {loadError && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 bg-red-900/95 border border-red-700 text-red-100 text-xs px-4 py-2.5 rounded-lg shadow-xl">
          ⚠️ {loadError}
        </div>
      )}

      {/* Draw mode banner */}
      {drawMode === "polygon" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-brand-500/95 text-slate-950 text-xs font-semibold px-5 py-2 rounded-full shadow-lg">
          ✏️ Clica para adicionar pontos · Duplo-clique para finalizar · ESC para cancelar
        </div>
      )}

      {/* Bottom toolbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        <MapBtn title="Camadas" icon="⊞" />
        <MapBtn title="A minha localização" icon="◎" />
        <MapBtn title="Split view" icon="⊟" />
      </div>
    </>
  );
}

function MapBtn({ title, icon }: { title: string; icon: string }) {
  return (
    <button
      title={title}
      className="w-10 h-10 rounded-xl bg-[#1a1a2e]/95 border border-slate-700 hover:bg-slate-700 text-slate-300 flex items-center justify-center shadow-lg text-base"
    >
      {icon}
    </button>
  );
}

function updateDrawLayer(map: maplibregl.Map, coords: [number, number][]) {
  const src = map.getSource(DRAW_SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (!src) return;
  if (coords.length < 2) {
    src.setData({ type: "FeatureCollection", features: [] });
    return;
  }
  const ring = coords.length >= 3 ? [...coords, coords[0]] : coords;
  src.setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: coords.length >= 3 ? "Polygon" : "LineString", coordinates: coords.length >= 3 ? [ring] : coords },
        properties: {},
      } as GeoJSON.Feature,
    ],
  });
}

function clearDraw(map: maplibregl.Map) {
  const src = map.getSource(DRAW_SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (src) src.setData({ type: "FeatureCollection", features: [] });
}
