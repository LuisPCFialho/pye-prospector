# Arquitetura — PYE Prospector

## Princípio

**Local-first, sem servidor.** Toda a aplicação corre na máquina do utilizador. Os dados ficam em SQLite local. As APIs externas (apenas leitura) são chamadas diretamente do frontend.

## Diagrama de componentes

```
+----------------------------------------------------------+
| pye-prospector.exe (Tauri 2)                             |
|                                                          |
|  +------------------+    +-----------------------------+ |
|  |  React 19        |    |  Rust (src-tauri)           | |
|  |  Vite + TS       |    |                             | |
|  |                  |    |  - tauri-plugin-sql         | |
|  |  - MapLibre      |    |  - tauri-plugin-dialog      | |
|  |  - Turf.js       |    |                             | |
|  |  - React Query   |    +-------------+---------------+ |
|  |  - Zustand       |                  |                 |
|  +--------+---------+                  v                 |
|           |              +-----------------------------+ |
|           |              |  SQLite (pye_prospector.db) | |
|           |              |  - buildings                | |
|           |              |  - leads                    | |
|           |              |  - territories              | |
|           |              +-----------------------------+ |
+-----------|----------------------------------------------+
            |
            v (https, somente leitura)
   +-----------------------------------------+
   | APIs externas (todas gratis)            |
   |  - MapTiler        (tiles satelite)     |
   |  - DGT WMS         (ortofotos PT 25 cm) |
   |  - Overpass        (edificios OSM)      |
   |  - Nominatim       (reverse geocoding)  |
   |  - PVGIS           (potencial solar)    |
   |  - Mapillary       (street view)        |
   +-----------------------------------------+
```

## Decisões-chave

### Porquê Tauri (e não Electron)
- Binário 10-20× mais pequeno (15 MB vs 200 MB)
- Memória: ~50 MB vs ~400 MB
- Usa WebView2 (já no Windows 11) em vez de bundle Chromium
- Frontend continua React: mesma stack que web app eventual

### Porquê SQLite em vez de SpatiaLite/PostGIS
- Setup zero — sem extensões nativas para compilar
- O nosso caso de uso são milhares (não milhões) de polígonos: cabe em memória
- Operações espaciais via Turf.js no frontend (point-in-polygon, intersect, area)
- bbox queries via columns indexed (`centroid_lon`, `centroid_lat`)
- Geometrias armazenadas como GeoJSON em coluna TEXT

### Porquê sem backend
- 0 € de infraestrutura (sem servidor a manter)
- APIs externas são todas CORS-friendly e gratuitas
- Sem latência extra de proxy
- Trade-off aceite: API keys (MapTiler, Mapillary) ficam embebidas no binário — para uso pessoal não é problema; para distribuição pública seria

### Porquê React Query
- Cache automático de respostas Overpass/PVGIS (evita refetch ao navegar)
- `staleTime` longo (10 min) — dados geográficos não mudam frequentemente
- Devtools para debug

## Fluxo de dados típico

**Importar zona →**

1. Utilizador desenha polígono no mapa (maplibre-gl-draw)
2. Calcula-se bbox do polígono
3. `useQuery` dispara `fetchBuildingsInBBox(bbox)` (Overpass)
4. Cada elemento é convertido para `BuildingFeature` (centroid, area via Turf)
5. Filtragem client-side: dentro do polígono (não só da bbox) e área ≥ 300 m²
6. INSERT em batch no SQLite (`buildings` + `leads` como `to_contact`)
7. Mapa atualiza com novos polígonos (re-fetch da DB)

**Calcular potencial solar →**

1. Utilizador clica "Calcular" na ficha do edifício
2. `useMutation` chama `fetchPVGIS({ lat, lon, peakPowerKwp: estimatePeakPower(area) })`
3. UPDATE no `leads` com `estimated_kwh_per_year` e `estimated_kwp`
4. UI atualiza com gráfico mensal

## Limites do MVP

- **Bbox grandes podem rebentar com timeout Overpass** — UI deve avisar e sugerir sub-divisão
- **Sem auth, sem multi-user** — explicitamente fora do MVP
- **Sem sync entre máquinas** — backup é tarefa manual (exportar `.db` ou CSV)
- **Imagens satélite têm marca de água MapTiler** no free tier (aceitável para uso pessoal)
