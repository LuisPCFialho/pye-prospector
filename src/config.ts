const env = import.meta.env;

export const config = {
  maptilerApiKey: env.VITE_MAPTILER_API_KEY ?? "",
  mapillaryClientToken: env.VITE_MAPILLARY_CLIENT_TOKEN ?? "",
  nominatimUrl: env.VITE_NOMINATIM_URL || "https://nominatim.openstreetmap.org",
  overpassUrl: env.VITE_OVERPASS_URL || "https://overpass-api.de/api/interpreter",
  dgtWmsUrl: env.VITE_DGT_WMS_URL || "https://cartografia.dgterritorio.gov.pt/wms/ortos2018",
  defaultCenter: {
    lon: Number(env.VITE_DEFAULT_CENTER_LON ?? -9.1393),
    lat: Number(env.VITE_DEFAULT_CENTER_LAT ?? 38.7223),
  },
  defaultZoom: Number(env.VITE_DEFAULT_ZOOM ?? 12),
  appName: "PYE Prospector",
  appVersion: "0.1.0",
  userAgent: "PYE-Prospector/0.1 (https://github.com/LuisPCFialho/pye-prospector)",
} as const;
