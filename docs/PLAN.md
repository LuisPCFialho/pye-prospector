# Plano de Implementação — PYE Prospector MVP

Plano executável por fases, com critérios de sucesso verificáveis por fase. Cada fase deve ficar `dev`-funcional antes de passar à seguinte.

## Resumo executivo

| | |
|---|---|
| **Produto** | Aplicação desktop (Tauri 2) para prospeção solar C&I |
| **Inspiração** | [planno.io](https://planno.io) (versão manual, sem ML) |
| **Região piloto** | Lisboa AML (Área Metropolitana) |
| **Orçamento** | 0 € (free-tier ou local) |
| **Stack** | Tauri 2 + React 19 + MapLibre + SQLite |
| **Distribuição** | Binário Windows `.exe` (`~15 MB`) |
| **Timeline MVP** | 4–6 semanas |

---

## Fase 0 — Setup (concluída)

- [x] Repositório GitHub público
- [x] Scaffold Tauri 2 + React + TypeScript + Tailwind
- [x] MapLibre integrado com fallback OSM
- [x] Schema SQLite inicial (buildings, leads, territories)
- [x] Clientes de API: Overpass, PVGIS, Nominatim

**Falta para fechar Fase 0:**
- [ ] Instalar Rust + MSVC Build Tools (utilizador)
- [ ] `npm install`
- [ ] `npm run tauri dev` — janela abre com mapa de Lisboa

**Critério de sucesso:** Janela Tauri abre, mostra mapa centrado em Lisboa, sem erros.

---

## Fase 1 — Importar edifícios C&I por bbox

**Objetivo:** Utilizador vê edifícios industriais/comerciais filtrados no mapa.

- [ ] Chamada a Overpass via `useQuery` quando o utilizador clica "Carregar zona visível"
- [ ] Renderizar polígonos no mapa como GeoJSON source + fill layer (cor por tag)
- [ ] Persistir em SQLite `buildings`
- [ ] Mostrar contagem por categoria na sidebar
- [ ] Cache local por bbox (não voltar a chamar Overpass para mesma zona)

**Critério de sucesso:** Em qualquer zona de Lisboa visível, clico "Carregar zona" e vejo polígonos coloridos dos C&I, persistidos entre restarts.

---

## Fase 2 — Ficha de edifício + PVGIS + Street View

**Objetivo:** Clicar num edifício revela informação completa para qualificação.

- [ ] Sidebar lateral direita aparece on-click do polígono
- [ ] Mostrar: nome, tag, área, morada (Nominatim, throttled)
- [ ] Botão "Calcular potencial solar" → PVGIS com tilt 30°, sul, perdas 14%
- [ ] Mostrar gráfico mensal de geração estimada (Recharts)
- [ ] Embed Mapillary; fallback botão "Abrir no Google Maps" (deep-link)
- [ ] Atalho: abrir POI OSM correspondente se existir

**Critério de sucesso:** Click num edifício → ficha completa em < 3 segundos, com geração anual realista para a área.

---

## Fase 3 — Classificação + Pipeline de leads

**Objetivo:** Utilizador qualifica e gere o pipeline.

- [ ] Campo `solar_status` (4 valores) editável na ficha
- [ ] Campo `pipeline_stage` (6 valores) editável
- [ ] Notas livres por lead
- [ ] Lista de leads na sidebar esquerda (filtros: estado, status, área min)
- [ ] Persistência em SQLite `leads`
- [ ] Atalho: click num lead → centra no mapa + abre ficha

**Critério de sucesso:** Classifico 10 edifícios, fecho a app, reabro, vejo todos os 10 com estado correto.

---

## Fase 4 — Importação por polígono + Dashboard

**Objetivo:** Produtividade e visão geral.

- [ ] Modo "Desenhar polígono" no mapa (maplibre-gl-draw)
- [ ] "Importar todos os C&I do polígono" → cria leads como `to_contact`
- [ ] Dashboard view com: total leads, por estado, área agregada, kWh agregado, % com painéis
- [ ] Gráficos: barras por estado, pizza por status solar

**Critério de sucesso:** Desenho polígono numa zona industrial, importo 50+ leads numa ação, vejo agregados no dashboard.

---

## Fase 5 — Export CSV + Polimento

**Objetivo:** MVP entregável.

- [ ] Export CSV com colunas: id, morada, lat, lon, área, kWh/ano, status solar, estado, notas, data
- [ ] File save dialog (`tauri-plugin-dialog`)
- [ ] Tratamento de erros visíveis (toast)
- [ ] Camada DGT WMS (ortofotos 25 cm Portugal) toggle on/off
- [ ] Empty states e mensagens de carregamento
- [ ] Tests unitários para área, PVGIS estimate, formatação CSV

**Critério de sucesso:** Compilo binário `pye-prospector.exe`, instalo numa máquina limpa, classifico zona, exporto CSV utilizável.

---

## Fora do MVP (Fase 6+)

- Deteção AI automática de painéis (treino com dados manuais)
- Multi-utilizador / sync para Turso ou Supabase
- App móvel (Tauri Mobile)
- Integração paga de dados de empresa
- Roteamento otimizado para visitas em campo

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Overpass devolver muitos elementos numa bbox grande | Limitar área visível, paginação por sub-bboxes |
| Nominatim rate limit (1 req/s) | Queue client-side + cache em SQLite por (lat,lon) |
| MapTiler free tier esgotado | Fallback automático para OSM raster |
| Build Tauri falha por falta de MSVC | Pré-flight check no README + script `scripts/check-deps.ps1` |
| Mapillary cobertura fraca em industrial | Fallback Google Maps deep-link (já planeado) |
