import { useEffect, useRef, useCallback, useMemo, useState, type RefObject } from "react";
import maplibregl from "maplibre-gl";
import { Layers, Maximize2, Filter } from "lucide-react";
import { config } from "../config";
import { setMapInstance } from "../lib/mapInstance";
import { useAppStore } from "../store/appStore";
import { buildingsToGeoJSON } from "../lib/overpass";
import { saveBuildingsBatch, getAllLeads } from "../db/database";
import { fetchBuildingsInBBox } from "../lib/overpass";
import { useFilteredBuildings, useIsFilterActive } from "../hooks/useFilteredBuildings";
import * as turf from "@turf/turf";

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© <a href='https://openstreetmap.org'>OpenStreetMap</a> contributors",
      maxzoom: 19,
    },
  },
  layers: [{ id: "osm-tiles", type: "raster", source: "osm" }],
};

const MAPTILER_STYLE = (key: string) =>
  `https://api.maptiler.com/maps/hybrid/style.json?key=${key}`;

const BUILDINGS_SOURCE = "buildings";
const DRAW_SOURCE = "draw-polygon";

function addAppLayers(map: maplibregl.Map) {
  if (map.getSource(BUILDINGS_SOURCE)) return;

  const existingData = buildingsToGeoJSON(
    useAppStore.getState().buildings,
    useAppStore.getState().leads,
  );

  map.addSource(BUILDINGS_SOURCE, {
    type: "geojson",
    data: existingData,
    generateId: true,
  });

  // Fill — color driven by feature property 'fillColor', cyan when selected
  map.addLayer({
    id: "buildings-fill",
    type: "fill",
    source: BUILDINGS_SOURCE,
    paint: {
      "fill-color": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        "#06b6d4",
        ["get", "fillColor"],
      ],
      "fill-opacity": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        0.40,
        0.22,
      ],
    },
  });

  // Outline
  map.addLayer({
    id: "buildings-outline",
    type: "line",
    source: BUILDINGS_SOURCE,
    paint: {
      "line-color": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        "#06b6d4",
        ["get", "fillColor"],
      ],
      "line-width": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        2,
        1.5,
      ],
    },
  });

  // Draw polygon source
  map.addSource(DRAW_SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer({
    id: "draw-fill",
    type: "fill",
    source: DRAW_SOURCE,
    paint: { "fill-color": "#f97316", "fill-opacity": 0.12 },
  });
  map.addLayer({
    id: "draw-line",
    type: "line",
    source: DRAW_SOURCE,
    paint: { "line-color": "#f97316", "line-width": 2, "line-dasharray": [4, 2] },
  });
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);
  const selectedIdRef = useRef<number | string | null>(null);
  const drawCoordsRef = useRef<[number, number][]>([]);

  const leads               = useAppStore((s) => s.leads);
  const drawMode            = useAppStore((s) => s.drawMode);
  const selectedBuildingId  = useAppStore((s) => s.selectedBuildingId);
  const loadError           = useAppStore((s) => s.loadError);
  const selectBuilding      = useAppStore((s) => s.selectBuilding);
  const addBuildings        = useAppStore((s) => s.addBuildings);
  const setLeads            = useAppStore((s) => s.setLeads);
  const setDrawMode         = useAppStore((s) => s.setDrawMode);
  const setLoadingBuildings = useAppStore((s) => s.setLoadingBuildings);
  const setLoadError        = useAppStore((s) => s.setLoadError);
  const setShowSearchFilter = useAppStore((s) => s.setShowSearchFilter);
  const notify              = useAppStore((s) => s.notify);
  const isLoadingBuildings  = useAppStore((s) => s.isLoadingBuildings);

  // Filtered buildings from shared hook (memoized, single source of truth)
  const visibleBuildings = useFilteredBuildings();
  const isFilterActive   = useIsFilterActive();
  const totalBuildings   = useAppStore((s) => s.buildings.length);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Restore last view from localStorage
    let initialCenter: [number, number] = [config.defaultCenter.lon, config.defaultCenter.lat];
    let initialZoom = config.defaultZoom;
    try {
      const saved = localStorage.getItem("pye:mapview");
      if (saved) {
        const v = JSON.parse(saved) as { lon: number; lat: number; zoom: number };
        if (Number.isFinite(v.lon) && Number.isFinite(v.lat) && Number.isFinite(v.zoom)) {
          initialCenter = [v.lon, v.lat];
          initialZoom = v.zoom;
        }
      }
    } catch { /* ignore */ }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false,
    });

    // Persist view changes (debounced) — timer cleared on unmount to prevent stale writes
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const onMoveEnd = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const c = map.getCenter();
        try {
          localStorage.setItem("pye:mapview", JSON.stringify({ lon: c.lng, lat: c.lat, zoom: map.getZoom() }));
        } catch { /* quota exceeded */ }
        saveTimer = null;
      }, 500);
    };
    map.on("moveend", onMoveEnd);

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    // Re-add our sources/layers whenever the style changes.
    // map.on("style.load") does NOT fire on setStyle() in MapLibre — only on
    // initial map load. "styledata" fires after every style mutation; we guard
    // with getSource() so we only act when our source is actually missing.
    map.on("styledata", () => {
      if (!map.getSource(BUILDINGS_SOURCE)) {
        addAppLayers(map);
        const geojson = buildingsToGeoJSON(
          useAppStore.getState().buildings,
          useAppStore.getState().leads,
        );
        const src = map.getSource(BUILDINGS_SOURCE) as maplibregl.GeoJSONSource | undefined;
        if (src) src.setData(geojson);
      }
    });

    map.on("load", () => {
      if (config.maptilerApiKey) {
        fetch(MAPTILER_STYLE(config.maptilerApiKey))
          .then((r) => { if (!r.ok) throw new Error(`MapTiler ${r.status}`); return r.json(); })
          .then((style) => { map.setStyle(style); })
          .catch(() => {});
      }
    });

    setMapInstance(map);
    mapRef.current = map;

    return () => {
      if (saveTimer) clearTimeout(saveTimer);
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Click handler
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

      const features = map.queryRenderedFeatures(e.point, { layers: ["buildings-fill"] });
      if (!features.length) {
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
      selectBuilding(feat.properties?.id as string);
    },
    [selectBuilding],
  );

  // Double-click — finish polygon
  const handleDblClick = useCallback(
    async (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      const map = mapRef.current;
      if (!map || useAppStore.getState().drawMode !== "polygon") return;
      const coords = drawCoordsRef.current;
      if (coords.length < 3) return;
      const closed = [...coords, coords[0]];
      const poly   = turf.polygon([closed]);
      const bbox   = turf.bbox(poly);
      clearDraw(map);
      setDrawMode("none");
      map.getCanvas().style.cursor = "";
      setLoadingBuildings(true);
      setLoadError(null);
      try {
        const all    = await fetchBuildingsInBBox({ minLon: bbox[0], minLat: bbox[1], maxLon: bbox[2], maxLat: bbox[3] });
        const inside = all.filter((b) =>
          turf.booleanPointInPolygon(turf.point([b.centroidLon, b.centroidLat]), poly),
        );
        if (inside.length === 0) {
          notify("Nenhum edifício dentro da área desenhada.", "warning");
        } else {
          addBuildings(inside);
          notify(`${inside.length} edifícios na área desenhada`, "success");
          try { await saveBuildingsBatch(inside); setLeads(await getAllLeads()); } catch { /* browser */ }
        }
      } catch (err) {
        notify(`Erro ao carregar área: ${err instanceof Error ? err.message : "Overpass"}`, "error");
      } finally {
        setLoadingBuildings(false);
      }
    },
    [addBuildings, setLeads, setDrawMode, setLoadingBuildings, notify],
  );

  // ESC to cancel draw
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

  // Register click/dblclick
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.on("click", handleMapClick);
    map.on("dblclick", handleDblClick);
    return () => { map.off("click", handleMapClick); map.off("dblclick", handleDblClick); };
  }, [handleMapClick, handleDblClick]);

  // Cursor in draw mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = drawMode === "polygon" ? "crosshair" : "";
    if (drawMode === "none") { clearDraw(map); drawCoordsRef.current = []; }
  }, [drawMode]);

  // Re-render buildings whenever visibleBuildings or lead colors change.
  // visibleBuildings already memoized by useFilteredBuildings hook.
  const geojson = useMemo(
    () => buildingsToGeoJSON(visibleBuildings, leads),
    [visibleBuildings, leads],
  );
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(BUILDINGS_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(geojson);
  }, [geojson]);

  // Pan to selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedBuildingId) return;
    const b = useAppStore.getState().buildings.find((x) => x.id === selectedBuildingId);
    if (b) map.easeTo({ center: [b.centroidLon, b.centroidLat], duration: 400 });
  }, [selectedBuildingId]);

  return (
    <>
      <div className="map-container">
        <div ref={containerRef} className="map-inner" />
      </div>

      {loadError && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 bg-red-900/95 border border-red-700 text-red-100 text-xs px-4 py-2.5 rounded-lg shadow-xl max-w-md text-center">
          ⚠️ {loadError}
        </div>
      )}

      {drawMode === "polygon" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-[#f97316]/95 text-white text-xs font-semibold px-5 py-2 rounded-full shadow-lg pointer-events-none">
          Click para adicionar pontos · Double-click para terminar · ESC para cancelar
        </div>
      )}

      {/* Loading overlay */}
      {isLoadingBuildings && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2 bg-[#13131f]/95 border border-[#1e1f30] text-[#c8d0df] text-xs px-3 py-2 rounded-lg shadow-lg">
          <span className="w-3 h-3 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
          A carregar edifícios…
        </div>
      )}

      {/* Empty state: no buildings loaded yet */}
      {totalBuildings === 0 && !isLoadingBuildings && drawMode === "none" && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 bg-[#13131f]/90 border border-[#1e1f30] text-[#8892a4] text-xs px-4 py-2.5 rounded-lg shadow-lg text-center pointer-events-none max-w-xs">
          Aproxima o mapa de uma zona industrial e usa <span className="text-[#f97316] font-semibold">Get Rooftops</span> para carregar edifícios.
        </div>
      )}

      {/* Filter-active badge: shows how many buildings are hidden */}
      {isFilterActive && totalBuildings > 0 && (
        <button
          type="button"
          onClick={() => setShowSearchFilter(true)}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-[#f97316]/90 hover:bg-[#f97316] text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg transition-colors"
          title="Filtro activo — clica para editar"
        >
          <Filter size={11} />
          {visibleBuildings.length}/{totalBuildings} edifícios visíveis
        </button>
      )}

      <BottomToolbar mapRef={mapRef} />
    </>
  );
}

function BottomToolbar({ mapRef }: { mapRef: RefObject<maplibregl.Map | null> }) {
  const [satellite, setSatellite] = useState(!!config.maptilerApiKey);
  const [fullscreen, setFullscreen] = useState(false);

  function toggleLayers() {
    const map = mapRef.current;
    if (!map) return;
    if (satellite) {
      map.setStyle(OSM_STYLE);
      setSatellite(false);
    } else {
      if (!config.maptilerApiKey) return;
      fetch(MAPTILER_STYLE(config.maptilerApiKey))
        .then((r) => r.json())
        .then((style) => { map.setStyle(style); setSatellite(true); })
        .catch(() => {});
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  }

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex gap-2">
      <button
        type="button"
        title={satellite ? "Mapa de ruas" : "Vista satélite"}
        onClick={toggleLayers}
        className="w-10 h-10 rounded-xl bg-[#13131f]/95 border border-[#1e1f30] hover:bg-[#1e1f30] text-[#c8d0df] flex items-center justify-center shadow-lg transition-colors"
      >
        <Layers size={16} />
      </button>
      <button
        type="button"
        title={fullscreen ? "Sair de fullscreen" : "Fullscreen"}
        onClick={toggleFullscreen}
        className="w-10 h-10 rounded-xl bg-[#13131f]/95 border border-[#1e1f30] hover:bg-[#1e1f30] text-[#c8d0df] flex items-center justify-center shadow-lg transition-colors"
      >
        <Maximize2 size={16} />
      </button>
    </div>
  );
}

function updateDrawLayer(map: maplibregl.Map, coords: [number, number][]) {
  const src = map.getSource(DRAW_SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (!src) return;
  if (coords.length < 2) { src.setData({ type: "FeatureCollection", features: [] }); return; }
  const ring = coords.length >= 3 ? [...coords, coords[0]] : coords;
  src.setData({
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      geometry: {
        type: coords.length >= 3 ? "Polygon" : "LineString",
        coordinates: coords.length >= 3 ? [ring] : coords,
      },
      properties: {},
    } as GeoJSON.Feature],
  });
}

function clearDraw(map: maplibregl.Map) {
  const src = map.getSource(DRAW_SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (src) src.setData({ type: "FeatureCollection", features: [] });
}
