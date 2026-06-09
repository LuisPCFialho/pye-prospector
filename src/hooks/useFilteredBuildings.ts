import { useMemo } from "react";
import { useAppStore } from "../store/appStore";
import type { BuildingFeature, Lead } from "../types/building";
import { getRealKwp } from "../lib/roofPacking";

/**
 * Returns the subset of buildings that pass all active filters.
 * Single source of truth — used by MapView, TableView, and SearchFilter.
 * Memoized so the filter only re-runs when buildings, leads, or filter
 * values actually change.
 */
export function useFilteredBuildings(): BuildingFeature[] {
  const buildings           = useAppStore((s) => s.buildings);
  const leads               = useAppStore((s) => s.leads);
  const filterSolarStatus   = useAppStore((s) => s.filterSolarStatus);
  const filterPipelineStage = useAppStore((s) => s.filterPipelineStage);
  const filterMinAreaSqm    = useAppStore((s) => s.filterMinAreaSqm);
  const filterMaxAreaSqm    = useAppStore((s) => s.filterMaxAreaSqm);
  const filterMinKwp        = useAppStore((s) => s.filterMinKwp);
  const filterMaxKwp        = useAppStore((s) => s.filterMaxKwp);
  const filterKeyword       = useAppStore((s) => s.filterKeyword);
  const filterOnlyFlagged   = useAppStore((s) => s.filterOnlyFlagged);
  const filterOnlyDropped   = useAppStore((s) => s.filterOnlyDropped);
  const filterExcludeDropped = useAppStore((s) => s.filterExcludeDropped);

  const obstacles = useAppStore((s) => s.obstacles);

  return useMemo(() => {
    const kw = filterKeyword.toLowerCase();
    return buildings.filter((b) => {
      const lead: Lead | undefined = leads[b.id];

      if (filterSolarStatus !== "all" && lead?.solarStatus !== filterSolarStatus) return false;
      if (filterPipelineStage !== "all" && lead?.pipelineStage !== filterPipelineStage) return false;
      if (filterMinAreaSqm > 0 && b.areaSqm < filterMinAreaSqm) return false;
      if (filterMaxAreaSqm > 0 && b.areaSqm > filterMaxAreaSqm) return false;

      if (filterMinKwp > 0 || filterMaxKwp > 0) {
        const kwp = getRealKwp(b, obstacles[b.id]);
        if (filterMinKwp > 0 && kwp < filterMinKwp) return false;
        if (filterMaxKwp > 0 && kwp > filterMaxKwp) return false;
      }

      if (kw.length > 0) {
        const hit = [b.name, b.operator, lead?.company, lead?.tags, lead?.address]
          .some((v) => v?.toLowerCase().includes(kw));
        if (!hit) return false;
      }

      if (filterOnlyFlagged && !lead?.flagged) return false;
      if (filterOnlyDropped && lead?.pipelineStage !== "lost") return false;
      if (filterExcludeDropped && lead?.pipelineStage === "lost") return false;

      return true;
    });
  }, [
    buildings, leads,
    filterSolarStatus, filterPipelineStage,
    filterMinAreaSqm, filterMaxAreaSqm,
    filterMinKwp, filterMaxKwp,
    filterKeyword,
    filterOnlyFlagged, filterOnlyDropped, filterExcludeDropped,
    obstacles,
  ]);
}

/** Returns true if any filter is currently active (non-default). */
export function useIsFilterActive(): boolean {
  const filterSolarStatus   = useAppStore((s) => s.filterSolarStatus);
  const filterPipelineStage = useAppStore((s) => s.filterPipelineStage);
  const filterMinAreaSqm    = useAppStore((s) => s.filterMinAreaSqm);
  const filterMaxAreaSqm    = useAppStore((s) => s.filterMaxAreaSqm);
  const filterMinKwp        = useAppStore((s) => s.filterMinKwp);
  const filterMaxKwp        = useAppStore((s) => s.filterMaxKwp);
  const filterKeyword       = useAppStore((s) => s.filterKeyword);
  const filterOnlyFlagged   = useAppStore((s) => s.filterOnlyFlagged);
  const filterOnlyDropped   = useAppStore((s) => s.filterOnlyDropped);
  const filterExcludeDropped = useAppStore((s) => s.filterExcludeDropped);

  return (
    filterSolarStatus !== "all" ||
    filterPipelineStage !== "all" ||
    filterMinAreaSqm > 0 ||
    filterMaxAreaSqm > 0 ||
    filterMinKwp > 0 ||
    filterMaxKwp > 0 ||
    filterKeyword.length > 0 ||
    filterOnlyFlagged ||
    filterOnlyDropped ||
    filterExcludeDropped
  );
}
