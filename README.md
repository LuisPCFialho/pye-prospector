# PYE Prospector

Plataforma de prospeção de oportunidades **solar C&I** (Comercial & Industrial) baseada em mapa, inspirada em [planno.io](https://planno.io). Identifica coberturas de empresas com e sem painéis solares instalados a partir de imagens de satélite e ortofotos.

> **Estado:** 🚧 MVP em desenvolvimento — região piloto **Lisboa AML**.

## O que faz

- Mapa satélite + ortofotos DGT 25cm
- Filtro automático de edifícios Comerciais e Industriais (OSM + Microsoft Building Footprints)
- Ficha por edifício: morada, área, **estimativa solar (PVGIS)**, Street View (Mapillary), POI OSM
- Classificação manual: com/sem painéis / parcial / inconclusivo
- Pipeline de leads: Por contactar → Contactado → Reunião → Proposta → Ganho/Perdido
- Polígono no mapa → importação em massa de C&I de uma zona
- Dashboard analítico (totais, área agregada, potencial kWh, % adoção solar)
- Exportação CSV

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Python + FastAPI |
| Base de dados | Supabase (Postgres + PostGIS + Auth) |
| Frontend | React + Vite + MapLibre GL JS + Tailwind |
| Tiles satélite | MapTiler + DGT WMS (Portugal) |
| Dados edifícios | Overpass API (OSM) + Microsoft Building Footprints |
| Estimativa solar | PVGIS (Comissão Europeia) |
| Street View | Mapillary (com fallback Google Maps) |
| Hosting backend | Fly.io (free tier) |
| Hosting frontend | Vercel (free tier) |

**Custo de infra MVP: 0€** (totalmente em free-tiers).

## Roadmap

- **Fase 1 — MVP (atual):** Classificação manual end-to-end com pipeline e dashboard
- **Fase 2:** Deteção AI automática de painéis (modelo open-source fine-tuned com dados manuais da Fase 1)
- **Fase 3:** Multi-utilizador, equipas, integrações pagas de dados de empresas

## Licença

MIT — ver [LICENSE](LICENSE).
