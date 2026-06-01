import { useEffect, useRef, useCallback, useState, type RefObject } from "react";
import maplibregl from "maplibre-gl";
import { config } from "../config";
import { setMapInstance } from "../lib/mapInstance";
import { useAppStore } from "../store/appStore";
import { buildingsToGeoJSON } from "../lib/overpass";
import { saveBuildingsBatch, getAllLeads } from "../db/database";
import { fetchBuildingsInBBox } from "../lib/overpass";
import * as turf from "@turf/turf";

// OSM raster — always works, no key needed
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
  if (map.getSource(BUILDINGS_SOURCE)) return; // already added

  // Seed with any buildings already in the store (handles style swap race condition)
  const existingData = buildingsToGeoJSON(useAppStore.getState().buildings);

  map.addSource(BUILDINGS_SOURCE, {
    type: "geojson",
    data: existingData,
    generateId: true,
  });
  map.addLayer({
    id: "buildings-fill",
    type: "fill",
    source: BUILDINGS_SOURCE,
    paint: {
      "fill-color": ["case", ["boolean", ["feature-state", "selected"], false], "#00d4d4", "#ef4444"],
      "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.45, 0.25],
    },
  });
  map.addLayer({
    id: "buildings-outline",
    type: "line",
    source: BUILDINGS_SOURCE,
    paint: {
      "line-color": ["case", ["boolean", ["feature-state", "selected"], false], "#00d4d4", "#ef4444"],
      "line-width": 1.5,
    },
  });

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
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const selectedIdRef = useRef<number | string | null>(null);
  const drawCoordsRef = useRef<[number, number][]>([]);

  const buildings = useAppStore((s) => s.buildings);
  const drawMode = useAppStore((s) => s.drawMode);
  const selectedBuildingId = useAppStore((s) => s.selectedBuildingId);
  const loadError = useAppStore((s) => s.loadError);
  const selectBuilding = useAppStore((s) => s.selectBuilding);
  const addBuildings = useAppStore((s) => s.addBuildings);
  const setLeads = useAppStore((s) => s.setLeads);
  const setDrawMode = useAppStore((s) => s.setDrawMode);
  const setLoadingBuildings = useAppStore((s) => s.setLoadingBuildings);
  const setLoadError = useAppStore((s) => s.setLoadError);

  // Init map — OSM first, then upgrade to MapTiler if key present
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [config.defaultCenter.lon, config.defaultCenter.lat],
      zoom: config.defaultZoom,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    // Once OSM is loaded, add app layers (and optionally upgrade to satellite)
    map.on("load", () => {
      addAppLayers(map);

      // Try to upgrade to MapTiler satellite
      if (config.maptilerApiKey) {
        fetch(MAPTILER_STYLE(config.maptilerApiKey))
          .then((r) => {
            if (!r.ok) throw new Error(`MapTiler ${r.status}`);
            return r.json();
          })
          .then((style) => {
            map.setStyle(style);
            // Re-add app layers after style swap
            map.once("style.load", () => addAppLayers(map));
          })
          .catch((e) => {
            console.warn("MapTiler style unavailable, keeping OSM:", e.message);
          });
      }
    });

    setMapInstance(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Click: select building or add draw point
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

  // Double-click: finish polygon
  const handleDblClick = useCallback(
    async (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      const map = mapRef.current;
      if (!map || useAppStore.getState().drawMode !== "polygon") return;
      const coords = drawCoordsRef.current;
      if (coords.length < 3) return;
      const closed = [...coords, coords[0]];
      const poly = turf.polygon([closed]);
      const bbox = turf.bbox(poly);
      clearDraw(map);
      setDrawMode("none");
      map.getCanvas().style.cursor = "";
      setLoadingBuildings(true);
      setLoadError(null);
      try {
        const all = await fetchBuildingsInBBox({ minLon: bbox[0], minLat: bbox[1], maxLon: bbox[2], maxLat: bbox[3] });
        const inside = all.filter((b) =>
          turf.booleanPointInPolygon(turf.point([b.centroidLon, b.centroidLat]), poly),
        );
        await saveBuildingsBatch(inside);
        addBuildings(inside);
        setLeads(await getAllLeads());
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Erro Overpass");
      } finally {
        setLoadingBuildings(false);
      }
    },
    [addBuildings, setLeads, setDrawMode, setLoadingBuildings, setLoadError],
  );

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.on("click", handleMapClick);
    map.on("dblclick", handleDblClick);
    return () => { map.off("click", handleMapClick); map.off("dblclick", handleDblClick); };
  }, [handleMapClick, handleDblClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = drawMode === "polygon" ? "crosshair" : "";
    if (drawMode === "none") { clearDraw(map); drawCoordsRef.current = []; }
  }, [drawMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const geojson = buildingsToGeoJSON(buildings);
    const apply = () => {
      const src = map.getSource(BUILDINGS_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(geojson);
    };
    // If style is mid-load (e.g. MapTiler swap), defer until style.load fires
    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once("style.load", apply);
    }
  }, [buildings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedBuildingId) return;
    const b = useAppStore.getState().buildings.find((x) => x.id === selectedBuildingId);
    if (b) map.easeTo({ center: [b.centroidLon, b.centroidLat], duration: 400 });
  }, [selectedBuildingId]);

  return (
    <>
      {/* Wrapper keeps absolute positioning — MapLibre overrides position:relative on the inner div */}
      <div className="map-container">
        <div ref={containerRef} className="map-inner" />
      </div>

      {loadError && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 bg-red-900/95 border border-red-700 text-red-100 text-xs px-4 py-2.5 rounded-lg shadow-xl max-w-md text-center">
          ⚠️ {loadError}
        </div>
      )}

      {drawMode === "polygon" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-brand-500/95 text-slate-950 text-xs font-semibold px-5 py-2 rounded-full shadow-lg pointer-events-none">
          ✏️ Clica para pontos · Duplo-clique para finalizar · ESC cancela
        </div>
      )}

      <BottomToolbar mapRef={mapRef} />
    </>
  );
}

function BottomToolbar({ mapRef }: { mapRef: RefObject<maplibregl.Map | null> }) {
  const [satellite, setSatellite] = useState(!!config.maptilerApiKey);
  const [locating, setLocating] = useState(false);

  function toggleLayers() {
    const map = mapRef.current;
    if (!map) return;
    if (satellite) {
      // Switch to OSM
      map.setStyle(OSM_STYLE);
      map.once("style.load", () => addAppLayers(map));
      setSatellite(false);
    } else {
      // Switch to MapTiler satellite
      if (!config.maptilerApiKey) return;
      fetch(MAPTILER_STYLE(config.maptilerApiKey))
        .then((r) => r.json())
        .then((style) => {
          map.setStyle(style);
          map.once("style.load", () => addAppLayers(map));
          setSatellite(true);
        })
        .catch(() => {});
    }
  }

  function geolocate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 15,
          duration: 800,
        });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  }

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
      <button
        type="button"
        title={satellite ? "Mudar para mapa" : "Mudar para satélite"}
        onClick={toggleLayers}
        className={`w-10 h-10 rounded-xl border flex items-center justify-center shadow-lg text-base transition ${
          satellite
            ? "bg-brand-500/90 border-brand-600 text-slate-950"
            : "bg-[#1a1a2e]/95 border-slate-700 text-slate-300 hover:bg-slate-700"
        }`}
      >
        {satellite ? "🛰️" : "🗺️"}
      </button>
      <button
        type="button"
        title="A minha localização"
        onClick={geolocate}
        disabled={locating}
        className="w-10 h-10 rounded-xl bg-[#1a1a2e]/95 border border-slate-700 hover:bg-slate-700 text-slate-300 flex items-center justify-center shadow-lg text-base disabled:opacity-50"
      >
        {locating ? "⌛" : "◎"}
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
      geometry: { type: coords.length >= 3 ? "Polygon" : "LineString", coordinates: coords.length >= 3 ? [ring] : coords },
      properties: {},
    } as GeoJSON.Feature],
  });
}

function clearDraw(map: maplibregl.Map) {
  const src = map.getSource(DRAW_SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (src) src.setData({ type: "FeatureCollection", features: [] });
}
