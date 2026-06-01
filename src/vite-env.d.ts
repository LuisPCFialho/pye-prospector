/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPTILER_API_KEY: string;
  readonly VITE_MAPILLARY_CLIENT_TOKEN: string;
  readonly VITE_NOMINATIM_URL: string;
  readonly VITE_OVERPASS_URL: string;
  readonly VITE_DGT_WMS_URL: string;
  readonly VITE_DEFAULT_CENTER_LON: string;
  readonly VITE_DEFAULT_CENTER_LAT: string;
  readonly VITE_DEFAULT_ZOOM: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
