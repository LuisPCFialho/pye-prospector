import { create } from "zustand";
import type { BuildingFeature, Lead, SolarStatus, PipelineStage } from "../types/building";

export type ViewMode = "map" | "table" | "analytics";
export type DrawMode = "none" | "polygon";

interface AppState {
  viewMode: ViewMode;
  drawMode: DrawMode;

  buildings: BuildingFeature[];
  leads: Record<string, Lead>; // keyed by buildingId

  selectedBuildingId: string | null;

  showLocationSummary: boolean;
  showLocationDetails: boolean;
  showStreetView: boolean;
  showSearchFilter: boolean;

  isLoadingBuildings: boolean;
  loadError: string | null;

  filterSolarStatus: SolarStatus | "all";
  filterPipelineStage: PipelineStage | "all";
  filterMinAreaSqm: number;

  // actions
  setViewMode: (v: ViewMode) => void;
  setDrawMode: (d: DrawMode) => void;

  setBuildings: (b: BuildingFeature[]) => void;
  addBuildings: (b: BuildingFeature[]) => void;

  setLeads: (leads: Lead[]) => void;
  upsertLead: (lead: Lead) => void;

  selectBuilding: (id: string | null) => void;

  setShowLocationDetails: (v: boolean) => void;
  setShowStreetView: (v: boolean) => void;
  setShowSearchFilter: (v: boolean) => void;

  setLoadingBuildings: (v: boolean) => void;
  setLoadError: (e: string | null) => void;

  setFilterSolarStatus: (v: SolarStatus | "all") => void;
  setFilterPipelineStage: (v: PipelineStage | "all") => void;
  setFilterMinAreaSqm: (v: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  viewMode: "map",
  drawMode: "none",

  buildings: [],
  leads: {},

  selectedBuildingId: null,

  showLocationSummary: false,
  showLocationDetails: false,
  showStreetView: false,
  showSearchFilter: false,

  isLoadingBuildings: false,
  loadError: null,

  filterSolarStatus: "all",
  filterPipelineStage: "all",
  filterMinAreaSqm: 0,

  setViewMode: (v) => set({ viewMode: v }),
  setDrawMode: (d) => set({ drawMode: d }),

  setBuildings: (b) => set({ buildings: b }),
  addBuildings: (b) =>
    set((s) => {
      const existing = new Set(s.buildings.map((x) => x.id));
      return { buildings: [...s.buildings, ...b.filter((x) => !existing.has(x.id))] };
    }),

  setLeads: (leads) =>
    set({ leads: Object.fromEntries(leads.map((l) => [l.buildingId, l])) }),
  upsertLead: (lead) =>
    set((s) => ({ leads: { ...s.leads, [lead.buildingId]: lead } })),

  selectBuilding: (id) =>
    set({ selectedBuildingId: id, showLocationSummary: id !== null }),

  setShowLocationDetails: (v) => set({ showLocationDetails: v }),
  setShowStreetView: (v) => set({ showStreetView: v }),
  setShowSearchFilter: (v) => set({ showSearchFilter: v }),

  setLoadingBuildings: (v) => set({ isLoadingBuildings: v }),
  setLoadError: (e) => set({ loadError: e }),

  setFilterSolarStatus: (v) => set({ filterSolarStatus: v }),
  setFilterPipelineStage: (v) => set({ filterPipelineStage: v }),
  setFilterMinAreaSqm: (v) => set({ filterMinAreaSqm: v }),
}));
