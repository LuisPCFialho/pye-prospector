import { useState, useRef, useEffect, useCallback } from "react";
import { getMapInstance } from "../lib/mapInstance";
import { config } from "../config";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  boundingbox: [string, string, string, string];
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function MapSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const debouncedQuery = useDebounce(query, 350);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setOpen(false); return; }
    // Cancel any in-flight request so a slow earlier response can't overwrite a newer one
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setLoading(true);
    const timer = setTimeout(() => ctrl.abort(), 8_000);
    try {
      const params = new URLSearchParams({
        q, format: "json", limit: "8",
        addressdetails: "0",
        "accept-language": "pt",
        countrycodes: "pt",
      });
      const res = await fetch(`${config.nominatimUrl}/search?${params}`, {
        headers: { "User-Agent": config.userAgent },
        signal: ctrl.signal,
      });
      if (!res.ok) { setResults([]); return; }
      const data: NominatimResult[] = await res.json();
      setResults(data);
      setOpen(data.length > 0);
    } catch {
      // aborted or network error — ignore (a newer search will set state)
    } finally {
      clearTimeout(timer);
      if (ctrlRef.current === ctrl) setLoading(false);
    }
  }, []);

  useEffect(() => { search(debouncedQuery); }, [debouncedQuery, search]);

  function flyTo(result: NominatimResult) {
    const map = getMapInstance();
    if (!map) return;
    const bb = result.boundingbox;
    if (bb) {
      map.fitBounds(
        [[parseFloat(bb[2]), parseFloat(bb[0])], [parseFloat(bb[3]), parseFloat(bb[1])]],
        { padding: 40, maxZoom: 16, duration: 800 },
      );
    } else {
      map.flyTo({ center: [parseFloat(result.lon), parseFloat(result.lat)], zoom: 14, duration: 800 });
    }
    setQuery(result.display_name.split(",")[0]);
    setOpen(false);
    setResults([]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
    if (e.key === "Enter" && results.length > 0) flyTo(results[0]);
  }

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[420px] max-w-[calc(100vw-280px)]">
      {/* Input */}
      <div className="flex items-center bg-[#1a1a2e]/95 border border-slate-600 rounded-xl shadow-2xl overflow-hidden backdrop-blur-sm">
        <span className="pl-3 text-slate-400 text-sm shrink-0">🔍</span>
        <input
          ref={inputRef}
          type="text"
          aria-label="Pesquisar localização"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Pesquisar cidade, empresa, morada…  ( / )"
          className="flex-1 bg-transparent px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
        />
        {loading && <span className="pr-3 text-slate-500 text-xs animate-pulse">…</span>}
        {query && !loading && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            className="pr-3 text-slate-500 hover:text-slate-300 text-base"
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="mt-1 bg-[#1a1a2e]/98 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {results.map((r) => (
            <button
              key={r.place_id}
              type="button"
              onClick={() => flyTo(r)}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-700/60 transition-colors border-b border-slate-800 last:border-0"
            >
              <div className="text-sm text-slate-100 truncate">
                {r.display_name.split(",")[0]}
              </div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">
                {r.display_name.split(",").slice(1, 3).join(",")}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
