# Fontes de dados

Inventário de todas as APIs e datasets usados pelo PYE Prospector. **Todas são gratuitas.**

| Fonte | O quê | Uso | Limite free | Chave |
|---|---|---|---|---|
| **MapTiler** | Tiles raster/vetor (Hybrid Satellite) | Camada base do mapa | 100 000 tiles/mês | API key (free signup) |
| **DGT — Cartografia** | Ortofotos 25 cm Portugal (WMS) | Overlay alta-resolução PT | Sem limite documentado | Nenhuma |
| **OpenStreetMap (raster)** | Tiles `tile.openstreetmap.org` | Fallback sem MapTiler | Tile usage policy | Nenhuma |
| **Overpass API** | Geometrias de edifícios OSM | Importar C&I por bbox | Justo, sem hard limit | Nenhuma |
| **OSM Nominatim** | Reverse geocoding | lat,lon → morada | 1 req/seg (público) | User-Agent obrigatório |
| **PVGIS (Comissão Europeia)** | Estimativa solar | kWh/ano por edifício | Sem limite documentado | Nenhuma |
| **Mapillary** | Street-level imagery | Visualização da entrada | Generoso | Client token (free signup) |
| **Microsoft Building Footprints** | Polígonos de edifícios (dataset estático) | Backup quando OSM falha | Sem limite (download) | Nenhuma |

## Detalhes por fonte

### MapTiler — `https://api.maptiler.com`
- Estilo usado: `hybrid` (satellite + labels)
- Necessita criar conta em <https://maptiler.com/cloud/>
- Definir `VITE_MAPTILER_API_KEY` em `.env`
- Sem key, a app cai para OSM raster automaticamente (com aviso visível)

### DGT — Direção-Geral do Território
- WMS público: <https://cartografia.dgterritorio.gov.pt/wms/ortos2018>
- Camada: `Ortos2018-RGB` (ortofotos 2018 com 25 cm de resolução)
- Atribuição obrigatória: "© DGT - Direção-Geral do Território"
- Verificar disponibilidade do serviço antes de release: pode ter manutenção

### Overpass API — `https://overpass-api.de/api/interpreter`
- Query QL personalizada filtra `building` por tipos C&I
- Output `geom` traz geometria inline → não precisamos de second request por way
- Politeness: `[timeout:60]`, evitar bboxes enormes (> 0.1° lado)

### Nominatim — `https://nominatim.openstreetmap.org/reverse`
- **Obrigatório User-Agent identificável** (ver `src/config.ts > userAgent`)
- **Throttle 1 req/seg** — implementar queue antes da Fase 2
- Cachear resultados em SQLite indefinidamente

### PVGIS — `https://re.jrc.ec.europa.eu/api/v5_3/PVcalc`
- Cobertura: Europa, África, partes da Ásia/Américas
- Dataset `PVGIS-SARAH3` (default na v5_3)
- Parâmetros defaults usados: `angle=30`, `aspect=0` (sul), `loss=14%`, `pvtechchoice=crystSi`, `mountingplace=building`
- Resposta inclui geração mensal — guardar para gráfico

### Mapillary — `https://graph.mapillary.com`
- Criar conta em <https://www.mapillary.com/dashboard/developers>
- Definir `VITE_MAPILLARY_CLIENT_TOKEN` em `.env`
- Cobertura Lisboa boa em ruas principais, fraca em zonas industriais periféricas
- Fallback: gerar link `https://www.google.com/maps?q=&layer=c&cbll={lat},{lon}` para abrir Street View no browser do utilizador (sem API key)

### Microsoft Building Footprints
- Dataset estático (Bing Maps team) — <https://github.com/microsoft/GlobalMLBuildingFootprints>
- Portugal está coberto
- **Não é uma API:** é um dump GeoJSONL por tile (S2 cells)
- Considerar: importar uma vez para SQLite local; usar como fallback de Overpass em zonas com OSM fraco

## O que NÃO usamos (e porquê)

- **Google Maps Tiles / Street View Embed API:** exige conta de billing com cartão de crédito (mesmo a $0 de uso). Fora do orçamento 0 €.
- **Mapbox:** mesma razão (cartão obrigatório).
- **Sentinel-2 / Landsat:** resolução insuficiente (10 m/pixel) para deteção visual de painéis.
- **Racius, einforma, NIF.pt:** APIs pagas. Substituídas por OSM POIs (cobertura limitada) e pesquisa manual Google.
