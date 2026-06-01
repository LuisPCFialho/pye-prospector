import { create } from "zustand";
import type {
  BuildingFeature, Lead, LeadNote, LeadTask,
  SolarStatus, PipelineStage,
} from "../types/building";

export type ViewMode = "map" | "table" | "analytics" | "kanban";
export type DrawMode = "none" | "polygon";

interface AppState {
  viewMode: ViewMode;
  drawMode: DrawMode;

  buildings: BuildingFeature[];
  leads: Record<string, Lead>;             // keyed by buildingId
  notes: Record<string, LeadNote[]>;       // keyed by leadId
  tasks: Record<string, LeadTask[]>;       // keyed by leadId

  selectedBuildingId: string | null;

  showLocationSummary: boolean;
  showLocationDetails: boolean;
  showStreetView: boolean;
  showSearchFilter: boolean;
  showAIAssistant: boolean;
  showQuickJump: boolean;

  isLoadingBuildings: boolean;
  loadError: string | null;
  successMessage: string | null;

  filterSolarStatus: SolarStatus | "all";
  filterPipelineStage: PipelineStage | "all";
  filterMinAreaSqm: number;
  filterMinScore: number;

  // actions
  setViewMode: (v: ViewMode) => void;
  setDrawMode: (d: DrawMode) => void;

  setBuildings: (b: BuildingFeature[]) => void;
  addBuildings: (b: BuildingFeature[]) => void;

  setLeads: (leads: Lead[]) => void;
  upsertLead: (lead: Lead) => void;

  setNotes: (notes: Record<string, LeadNote[]>) => void;
  addNoteToStore: (note: LeadNote) => void;

  setTasks: (tasks: Record<string, LeadTask[]>) => void;
  addTaskToStore: (task: LeadTask) => void;
  updateTaskInStore: (task: LeadTask) => void;

  selectBuilding: (id: string | null) => void;

  setShowLocationDetails: (v: boolean) => void;
  setShowStreetView: (v: boolean) => void;
  setShowSearchFilter: (v: boolean) => void;
  setShowAIAssistant: (v: boolean) => void;
  setShowQuickJump: (v: boolean) => void;

  setLoadingBuildings: (v: boolean) => void;
  setLoadError: (e: string | null) => void;
  setSuccessMessage: (m: string | null) => void;

  setFilterSolarStatus: (v: SolarStatus | "all") => void;
  setFilterPipelineStage: (v: PipelineStage | "all") => void;
  setFilterMinAreaSqm: (v: number) => void;
  setFilterMinScore: (v: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  viewMode: "map",
  drawMode: "none",

  buildings: [],
  leads: {},
  notes: {},
  tasks: {},

  selectedBuildingId: null,

  showLocationSummary: false,
  showLocationDetails: false,
  showStreetView: false,
  showSearchFilter: false,
  showAIAssistant: false,
  showQuickJump: false,

  isLoadingBuildings: false,
  loadError: null,
  successMessage: null,

  filterSolarStatus: "all",
  filterPipelineStage: "all",
  filterMinAreaSqm: 0,
  filterMinScore: 0,

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

  setTasks: (tasks) => set({ tasks }),
  addTaskToStore: (task) =>
    set((s) => ({
      tasks: { ...s.tasks, [task.leadId]: [task, ...(s.tasks[task.leadId] ?? [])] },
    })),
  updateTaskInStore: (task) =>
    set((s) => ({
      tasks: {
        ...s.tasks,
        [task.leadId]: (s.tasks[task.leadId] ?? []).map((t) => (t.id === task.id ? task : t)),
      },
    })),

  selectBuilding: (id) =>
    set({ selectedBuildingId: id, showLocationSummary: id !== null }),

  setShowLocationDetails: (v) => set({ showLocationDetails: v }),
  setShowStreetView: (v) => set({ showStreetView: v }),
  setShowSearchFilter: (v) => set({ showSearchFilter: v }),
  setShowAIAssistant: (v) => set({ showAIAssistant: v }),
  setShowQuickJump: (v) => set({ showQuickJump: v }),

  setLoadingBuildings: (v) => set({ isLoadingBuildings: v }),
  setLoadError: (e) => set({ loadError: e }),
  setSuccessMessage: (m) => set({ successMessage: m }),

  setFilterSolarStatus: (v) => set({ filterSolarStatus: v }),
  setFilterPipelineStage: (v) => set({ filterPipelineStage: v }),
  setFilterMinAreaSqm: (v) => set({ filterMinAreaSqm: v }),
  setFilterMinScore: (v) => set({ filterMinScore: v }),
}));
