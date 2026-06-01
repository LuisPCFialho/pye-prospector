# PYE Prospector

Aplicação desktop para **prospeção de oportunidades solar C&I** (Comercial & Industrial) baseada em mapa, inspirada em [planno.io](https://planno.io). Identifica coberturas de empresas com e sem painéis solares a partir de imagens de satélite e ortofotos DGT, calcula o potencial solar com PVGIS, e gere o pipeline de leads — tudo numa app local em **Tauri** com binário de ~15MB.

> **Estado:** 🚧 MVP em desenvolvimento — região piloto **Lisboa AML** · binário Windows.

## O que faz

- Mapa satélite (MapTiler) + ortofotos DGT 25cm para Portugal
- Filtro automático de edifícios C&I (OSM + Microsoft Building Footprints)
- Ficha por edifício: morada, área, **estimativa solar (PVGIS)**, Street View (Mapillary + fallback Google Maps deep-link), POI OSM
- Classificação manual: com painéis / sem painéis / parcial / inconclusivo
- Pipeline de leads: Por contactar → Contactado → Reunião → Proposta → Ganho/Perdido
- Desenhar polígono no mapa → importação em massa dos C&I da zona
- Dashboard analítico (totais, área agregada, kWh potencial, % adoção solar)
- Exportação CSV
- Armazenamento local em SQLite — **zero servidor, zero hosting, zero conta na cloud**

## Stack

| Camada | Tecnologia |
|---|---|
| Shell desktop | **Tauri 2** (Rust) — binário Windows ~15MB |
| Frontend | React 19 + Vite 6 + TypeScript + Tailwind |
| Mapa | MapLibre GL JS |
| BD local | SQLite (via `tauri-plugin-sql`) |
| Spatial ops | Turf.js (cliente) |
| Tiles satélite | MapTiler free tier + DGT WMS (Portugal) |
| Dados edifícios | Overpass API (OSM) + Microsoft Building Footprints |
| Estimativa solar | PVGIS (Comissão Europeia, grátis) |
| Street View | Mapillary (com fallback Google Maps deep-link) |
| Geocoding | Nominatim OSM |

**Custo total: 0€** (sem infraestrutura, sem subscrições).

## Requisitos para desenvolvimento

- **Rust** (via `rustup`)
- **Node.js** ≥ 20
- **Microsoft Visual Studio Build Tools** (Windows) — para compilar Tauri
- **WebView2** (já incluído no Windows 11)

```bash
# Instalar dependências
npm install

# Correr em modo de desenvolvimento (com hot-reload)
npm run tauri dev

# Compilar binário de produção
npm run tauri build
```

O `.exe` final fica em `src-tauri/target/release/`.

## Roadmap

- **Fase 1 — MVP (atual):** Classificação manual end-to-end, pipeline, dashboard, export CSV
- **Fase 2:** Deteção AI automática de painéis solares (modelo open-source fine-tuned com dados manuais da Fase 1, treino em ortofotos DGT)
- **Fase 3:** Sync opcional para cloud (Turso/Supabase) para multi-device e partilha; modo web

## Licença

MIT — ver [LICENSE](LICENSE).
