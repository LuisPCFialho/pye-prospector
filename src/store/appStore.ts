import { create } from "zustand";
import type {
  BuildingFeature, Lead, LeadNote,
  SolarStatus, PipelineStage,
} from "../types/building";

export type ViewMode = "map" | "table";
export type DrawMode = "none" | "polygon" | "obstacle";
export type ToastSeverity = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  severity: ToastSeverity;
}

interface AppState {
  viewMode: ViewMode;
  drawMode: DrawMode;

  buildings: BuildingFeature[];
  leads: Record<string, Lead>;
  notes: Record<string, LeadNote[]>;

  selectedBuildingId: string | null;

  // Multi-selection
  selectionIds: string[];
  selectionCursor: number;

  // User-drawn obstacle exclusion zones (UTAs, skylights, walls) per building.
  // Subtracted from the roof before panel packing so kWp reflects real usable area.
  obstacles: Record<string, GeoJSON.Polygon[]>;

  showLocationSummary: boolean;
  showLocationDetails: boolean;
  showStreetView: boolean;
  showSearchFilter: boolean;
  showDropDialog: boolean;
  showLayersPanel: boolean;
  showSettings: boolean;

  isLoadingBuildings: boolean;
  loadError: string | null;
  successMessage: string | null;
  toasts: Toast[];

  filterSolarStatus: SolarStatus | "all";
  filterPipelineStage: PipelineStage | "all";
  filterMinAreaSqm: number;
  filterMaxAreaSqm: number;
  filterMinKwp: number;
  filterMaxKwp: number;
  filterKeyword: string;
  filterOnlyFlagged: boolean;
  filterOnlyDropped: boolean;
  filterExcludeDropped: boolean;

  // actions
  setViewMode: (v: ViewMode) => void;
  setDrawMode: (d: DrawMode) => void;

  setBuildings: (b: BuildingFeature[]) => void;
  addBuildings: (b: BuildingFeature[]) => void;

  setLeads: (leads: Lead[]) => void;
  upsertLead: (lead: Lead) => void;

  setNotes: (notes: Record<string, LeadNote[]>) => void;
  addNoteToStore: (note: LeadNote) => void;

  selectBuilding: (id: string | null) => void;
  setSelectionIds: (ids: string[]) => void;
  setSelectionCursor: (n: number) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;

  addObstacle: (buildingId: string, poly: GeoJSON.Polygon) => void;
  clearObstacles: (buildingId: string) => void;

  setShowLocationDetails: (v: boolean) => void;
  setShowStreetView: (v: boolean) => void;
  setShowSearchFilter: (v: boolean) => void;
  setShowDropDialog: (v: boolean) => void;
  setShowLayersPanel: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;

  setLoadingBuildings: (v: boolean) => void;
  setLoadError: (e: string | null) => void;
  setSuccessMessage: (m: string | null) => void;

  setFilterSolarStatus: (v: SolarStatus | "all") => void;
  setFilterPipelineStage: (v: PipelineStage | "all") => void;
  setFilterMinAreaSqm: (v: number) => void;
  setFilterMaxAreaSqm: (v: number) => void;
  setFilterMinKwp: (v: number) => void;
  setFilterMaxKwp: (v: number) => void;
  setFilterKeyword: (v: string) => void;
  setFilterOnlyFlagged: (v: boolean) => void;
  setFilterOnlyDropped: (v: boolean) => void;
  setFilterExcludeDropped: (v: boolean) => void;

  notify: (message: string, severity?: ToastSeverity) => void;
  dismissToast: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  viewMode: "map",
  drawMode: "none",

  buildings: [],
  leads: {},
  notes: {},

  selectedBuildingId: null,
  selectionIds: [],
  selectionCursor: 0,
  obstacles: {},

  showLocationSummary: false,
  showLocationDetails: false,
  showStreetView: false,
  showSearchFilter: false,
  showDropDialog: false,
  showLayersPanel: false,
  showSettings: false,

  isLoadingBuildings: false,
  loadError: null,
  successMessage: null,
  toasts: [],

  filterSolarStatus: "all",
  filterPipelineStage: "all",
  filterMinAreaSqm: 0,
  filterMaxAreaSqm: 0,
  filterMinKwp: 0,
  filterMaxKwp: 0,
  filterKeyword: "",
  filterOnlyFlagged: false,
  filterOnlyDropped: false,
  filterExcludeDropped: false,

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

  setNotes: (notes) => set({ notes }),
  addNoteToStore: (note) =>
    set((s) => ({
      notes: { ...s.notes, [note.leadId]: [note, ...(s.notes[note.leadId] ?? [])] },
    })),

  selectBuilding: (id) =>
    set({ selectedBuildingId: id, showLocationSummary: id !== null }),

  setSelectionIds: (ids) => set({ selectionIds: ids, selectionCursor: 0 }),
  setSelectionCursor: (n) => set({ selectionCursor: n }),
  toggleSelection: (id) =>
    set((s) => ({
      selectionIds: s.selectionIds.includes(id)
        ? s.selectionIds.filter((x) => x !== id)
        : [...s.selectionIds, id],
    })),
  clearSelection: () => set({ selectionIds: [] }),

  addObstacle: (buildingId, poly) =>
    set((s) => ({
      obstacles: {
        ...s.obstacles,
        [buildingId]: [...(s.obstacles[buildingId] ?? []), poly],
      },
    })),
  clearObstacles: (buildingId) =>
    set((s) => {
      if (!s.obstacles[buildingId]) return {};
      const next = { ...s.obstacles };
      delete next[buildingId];
      return { obstacles: next };
    }),

  setShowLocationDetails: (v) => set({ showLocationDetails: v }),
  setShowStreetView: (v) => set({ showStreetView: v }),
  setShowSearchFilter: (v) => set({ showSearchFilter: v }),
  setShowDropDialog: (v) => set({ showDropDialog: v }),
  setShowLayersPanel: (v) => set({ showLayersPanel: v }),
  setShowSettings: (v) => set({ showSettings: v }),

  setLoadingBuildings: (v) => set({ isLoadingBuildings: v }),
  setLoadError: (e) => set({ loadError: e }),
  setSuccessMessage: (m) => set({ successMessage: m }),

  setFilterSolarStatus: (v) => set({ filterSolarStatus: v }),
  setFilterPipelineStage: (v) => set({ filterPipelineStage: v }),
  setFilterMinAreaSqm: (v) => set({ filterMinAreaSqm: v }),
  setFilterMaxAreaSqm: (v) => set({ filterMaxAreaSqm: v }),
  setFilterMinKwp: (v) => set({ filterMinKwp: v }),
  setFilterMaxKwp: (v) => set({ filterMaxKwp: v }),
  setFilterKeyword: (v) => set({ filterKeyword: v }),
  setFilterOnlyFlagged: (v) => set({ filterOnlyFlagged: v }),
  setFilterOnlyDropped: (v) => set({ filterOnlyDropped: v }),
  setFilterExcludeDropped: (v) => set({ filterExcludeDropped: v }),

  notify: (message, severity = "info") =>
    set((s) => ({
      toasts: [...s.toasts, { id: crypto.randomUUID(), message, severity }].slice(-4),
    })),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
