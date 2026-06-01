import type maplibregl from "maplibre-gl";

let _map: maplibregl.Map | null = null;

export function setMapInstance(map: maplibregl.Map) {
  _map = map;
}

export function getMapInstance(): maplibregl.Map | null {
  return _map;
}

export function getViewportBBox() {
  if (!_map) return null;
  const b = _map.getBounds();
  return {
    minLon: b.getWest(),
    minLat: b.getSouth(),
    maxLon: b.getEast(),
    maxLat: b.getNorth(),
  };
}
