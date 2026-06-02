import { useState } from "react";
import { X } from "lucide-react";
import { useAppStore } from "../store/appStore";
import { saveLead } from "../db/database";
import { DROP_REASON_LABELS, type DropReason } from "../types/building";

const REASONS = Object.entries(DROP_REASON_LABELS) as [DropReason, string][];

export default function DropLocationDialog() {
  const showDropDialog      = useAppStore((s) => s.showDropDialog);
  const selectedBuildingId  = useAppStore((s) => s.selectedBuildingId);
  const buildings           = useAppStore((s) => s.buildings);
  const leads               = useAppStore((s) => s.leads);
  const upsertLead          = useAppStore((s) => s.upsertLead);
  const setShowDropDialog   = useAppStore((s) => s.setShowDropDialog);
  const setSuccessMessage   = useAppStore((s) => s.setSuccessMessage);

  const [selected, setSelected] = useState<DropReason | null>(null);

  if (!showDropDialog) return null;

  const building = buildings.find((b) => b.id === selectedBuildingId);
  const lead     = selectedBuildingId ? leads[selectedBuildingId] : undefined;

  async function handleDrop() {
    if (!selected || !building) return;
    const base = lead ?? {
      id: crypto.randomUUID(),
      buildingId: building.id,
      solarStatus: "unknown" as const,
      pipelineStage: "lost" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = {
      ...base,
      pipelineStage: "lost" as const,
      dropReason: selected,
      updatedAt: new Date().toISOString(),
    };
    try { await saveLead(updated); } catch { /* no tauri */ }
    upsertLead(updated);
    setSuccessMessage("Location dropped");
    setTimeout(() => setSuccessMessage(null), 2500);
    setSelected(null);
    setShowDropDialog(false);
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
      <div className="w-[400px] bg-[#13131f] border border-[#1e1f30] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e1f30]">
          <span className="font-semibold text-sm text-white">Drop Location</span>
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => { setSelected(null); setShowDropDialog(false); }}
            className="w-6 h-6 rounded flex items-center justify-center text-[#8892a4] hover:text-white hover:bg-[#1e1f30] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Reasons list */}
        <div className="p-3 max-h-[60vh] overflow-y-auto space-y-px">
          {REASONS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-left transition-colors ${
                selected === key
                  ? "bg-[#f97316]/15 text-[#f97316]"
                  : "text-[#c8d0df] hover:bg-[#1e1f30] hover:text-white"
              }`}
            >
              <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                selected === key ? "border-[#f97316] bg-[#f97316]" : "border-[#3a3b4d]"
              }`}>
                {selected === key && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </span>
              {label}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#1e1f30]">
          <button
            type="button"
            onClick={handleDrop}
            disabled={!selected}
            className="w-full py-2.5 rounded-lg bg-[#f97316] hover:bg-[#ea6d0e] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
          >
            Drop Location
          </button>
        </div>
      </div>
    </div>
  );
}
