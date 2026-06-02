import { useState, useEffect } from "react";
import { X, ChevronRight, Building2, Globe, Phone, RefreshCw, ExternalLink, Link2, Info, Zap, MapPin } from "lucide-react";
import { useAppStore } from "../store/appStore";
import { fetchPVGIS, estimatePeakPower } from "../lib/pvgis";
import { saveLead } from "../db/database";
import { autoFillLeadFromOSM, getDisplayCompany, getDisplayWebsite, getDisplayPhone, hasSolarOnOSM } from "../lib/leadAutoFill";
import { openExternal, streetViewUrl, googleMapsUrl } from "../lib/openExternal";

type Tab = "flag" | "solar" | "drop";

export default function LocationSummary() {
  const selectedBuildingId  = useAppStore((s) => s.selectedBuildingId);
  const buildings           = useAppStore((s) => s.buildings);
  const leads               = useAppStore((s) => s.leads);
  const showLocationSummary = useAppStore((s) => s.showLocationSummary);
  const selectBuilding      = useAppStore((s) => s.selectBuilding);
  const setShowLocationDetails = useAppStore((s) => s.setShowLocationDetails);
  const setShowDropDialog   = useAppStore((s) => s.setShowDropDialog);
  const upsertLead          = useAppStore((s) => s.upsertLead);

  const [tab, setTab]             = useState<Tab>("flag");
  const [calcingSolar, setCalcing] = useState(false);
  const [editingField, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue]  = useState("");

  const building = buildings.find((b) => b.id === selectedBuildingId);
  const lead     = selectedBuildingId ? leads[selectedBuildingId] : undefined;

  // Auto-fill lead from OSM tags whenever a building is opened
  useEffect(() => {
    if (!building) return;
    const base: import("../types/building").Lead = lead ?? {
      id: crypto.randomUUID(),
      buildingId: building.id,
      solarStatus: "unknown",
      pipelineStage: "to_contact",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const filled = autoFillLeadFromOSM(building, base);
    if (filled !== base && (
      filled.company !== base.company ||
      filled.website !== base.website ||
      filled.telephone !== base.telephone ||
      filled.email !== base.email ||
      filled.nif !== base.nif ||
      filled.address !== base.address ||
      filled.solarStatus !== base.solarStatus
    )) {
      saveLead(filled).catch(() => {});
      upsertLead(filled);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building?.id]);

  if (!showLocationSummary || !building) return null;

  const kwp = lead?.estimatedKwp ?? estimatePeakPower(building.areaSqm);

  function ensureLead() {
    return lead ?? {
      id: crypto.randomUUID(),
      buildingId: building!.id,
      solarStatus: "unknown" as const,
      pipelineStage: "to_contact" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async function saveField(field: string, value: string) {
    const updated = { ...ensureLead(), [field]: value, updatedAt: new Date().toISOString() };
    try { await saveLead(updated as Parameters<typeof saveLead>[0]); } catch { /* no tauri */ }
    upsertLead(updated as Parameters<typeof saveLead>[0]);
    setEditing(null);
  }

  async function handleCalcSolar() {
    if (!building) return;
    setCalcing(true);
    try {
      const result = await fetchPVGIS({ lat: building.centroidLat, lon: building.centroidLon, peakPowerKwp: kwp });
      const updated = {
        ...ensureLead(),
        estimatedKwhPerYear: result.yearlyEnergyKwh,
        estimatedKwp: kwp,
        monthlyKwh: result.monthlyAverageKwh,
        updatedAt: new Date().toISOString(),
      };
      try { await saveLead(updated); } catch { /* no tauri */ }
      upsertLead(updated);
    } finally {
      setCalcing(false);
    }
  }

  const locationName = building.name ?? building.operator ?? lead?.address ?? `Way ${building.osmId ?? building.id.slice(0, 8)}`;
  const displayCompany = getDisplayCompany(building, lead);
  const displayWebsite = getDisplayWebsite(building, lead);
  const displayPhone   = getDisplayPhone(building, lead);
  const addedDate    = lead?.createdAt ? new Date(lead.createdAt).toLocaleDateString("pt-PT") : "Hoje";
  const updatedDate  = lead?.updatedAt ? new Date(lead.updatedAt).toLocaleDateString("pt-PT") : "Hoje";

  return (
    <div className="absolute top-4 right-4 z-20 w-[300px] bg-[#13131f] border border-[#1e1f30] rounded-xl shadow-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1f30]">
        <span className="text-sm font-semibold text-white">Location Summary</span>
        <button
          onClick={() => selectBuilding(null)}
          className="w-6 h-6 rounded flex items-center justify-center text-[#8892a4] hover:text-white hover:bg-[#1e1f30] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-1 px-3 pt-2.5 pb-1">
        <TabBtn label="🚩 Flag"       active={tab === "flag"}  onClick={() => setTab("flag")} />
        <TabBtn label="☀️ Solar"      active={tab === "solar"} onClick={() => setTab("solar")} />
        <TabBtn label="👤 Individual" active={tab === "drop"}  onClick={() => { setTab("drop"); setShowDropDialog(true); }} />
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3 overflow-y-auto flex-1">
        {tab === "flag" && (
          <>
            {/* Type */}
            <FieldRow
              label="Location Type"
              icon={<Info size={12} className="text-[#8892a4]" />}
              value="Rooftop"
            />

            {/* Area */}
            <FieldRow
              label="Area"
              prefix="m²"
              value={building.areaSqm.toLocaleString("pt-PT")}
            />

            {/* Solar potential */}
            <FieldRow
              label="Solar Potential"
              prefix="kWp"
              value={kwp.toFixed(1)}
              accent
            />

            {/* Existing PV detection badge */}
            {hasSolarOnOSM(building) && (
              <div className="flex items-center gap-1.5 text-[11px] text-green-400 bg-green-900/20 border border-green-700/40 rounded px-2 py-1">
                <span>☀️</span>
                <span>PV detetado no OSM — edifício já tem painéis</span>
              </div>
            )}

            <div className="border-t border-[#1e1f30] my-1" />

            {/* Location Name */}
            <EditableFieldRow
              label="Location Name"
              icon={<Building2 size={13} className="text-[#8892a4]" />}
              value={locationName}
              editing={editingField === "address"}
              editValue={editValue}
              onEdit={() => { setEditing("address"); setEditValue(locationName); }}
              onChange={setEditValue}
              onSave={() => saveField("address", editValue)}
              onCancel={() => setEditing(null)}
            />

            {/* Company Name */}
            <EditableFieldRow
              label="Company Name"
              icon={<Building2 size={13} className="text-[#8892a4]" />}
              value={displayCompany}
              editing={editingField === "company"}
              editValue={editValue}
              onEdit={() => { setEditing("company"); setEditValue(displayCompany === "(sem nome — verificar)" ? "" : displayCompany); }}
              onChange={setEditValue}
              onSave={() => saveField("company", editValue)}
              onCancel={() => setEditing(null)}
            />

            {/* Website */}
            <EditableFieldRow
              label="Website"
              icon={<Globe size={13} className="text-[#8892a4]" />}
              value={displayWebsite ?? "—"}
              editing={editingField === "website"}
              editValue={editValue}
              onEdit={() => { setEditing("website"); setEditValue(displayWebsite ?? ""); }}
              onChange={setEditValue}
              onSave={() => saveField("website", editValue)}
              onCancel={() => setEditing(null)}
            />

            {/* Telephone — show from OSM or lead */}
            {displayPhone && (
              <EditableFieldRow
                label="Telephone"
                icon={<Phone size={13} className="text-[#8892a4]" />}
                value={displayPhone}
                editing={editingField === "telephone"}
                editValue={editValue}
                onEdit={() => { setEditing("telephone"); setEditValue(displayPhone); }}
                onChange={setEditValue}
                onSave={() => saveField("telephone", editValue)}
                onCancel={() => setEditing(null)}
              />
            )}

            {/* Action row */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                title="Pesquisar empresa no Google"
                onClick={() => {
                  const name = displayCompany !== "(sem nome — verificar)" ? displayCompany : locationName;
                  openExternal(`https://www.google.com/search?q=${encodeURIComponent(name + " empresa contactos Portugal")}`);
                }}
                className="flex-1 h-7 bg-[#1e1f30] hover:bg-[#252637] border border-[#2a2b3d] rounded text-[11px] text-[#c8d0df] transition-colors"
              >
                Get Metadata
              </button>
              {displayWebsite && (
                <button
                  type="button"
                  title={`Abrir website: ${displayWebsite}`}
                  onClick={() => openExternal(displayWebsite.startsWith("http") ? displayWebsite : `https://${displayWebsite}`)}
                  className="w-7 h-7 bg-[#1e1f30] hover:bg-[#252637] border border-[#2a2b3d] rounded flex items-center justify-center text-[#8892a4] hover:text-white transition-colors"
                >
                  <Link2 size={13} />
                </button>
              )}
              <button
                type="button"
                title="Abrir no Google Maps"
                onClick={() => openExternal(googleMapsUrl(building.centroidLat, building.centroidLon))}
                className="w-7 h-7 bg-[#1e1f30] hover:bg-[#252637] border border-[#2a2b3d] rounded flex items-center justify-center text-[#8892a4] hover:text-white transition-colors"
              >
                <MapPin size={13} />
              </button>
              {building.osmId && (
                <button
                  type="button"
                  title="Abrir no OpenStreetMap"
                  onClick={() => openExternal(`https://www.openstreetmap.org/way/${building.osmId}`)}
                  className="w-7 h-7 bg-[#1e1f30] hover:bg-[#252637] border border-[#2a2b3d] rounded flex items-center justify-center text-[#8892a4] hover:text-white transition-colors"
                >
                  <ExternalLink size={13} />
                </button>
              )}
              <button
                type="button"
                title="Recalcular solar"
                onClick={handleCalcSolar}
                disabled={calcingSolar}
                className="w-7 h-7 bg-[#1e1f30] hover:bg-[#252637] border border-[#2a2b3d] rounded flex items-center justify-center text-[#8892a4] hover:text-white transition-colors disabled:opacity-40"
              >
                <RefreshCw size={13} className={calcingSolar ? "animate-spin" : ""} />
              </button>
            </div>
          </>
        )}

        {tab === "solar" && (
          <>
            <FieldRow label="Area" prefix="m²" value={building.areaSqm.toLocaleString("pt-PT")} />
            <FieldRow label="Solar Potential" prefix="kWp" value={kwp.toFixed(1)} accent />
            {lead?.estimatedKwhPerYear ? (
              <>
                <FieldRow
                  label="Annual Estimated Solar"
                  prefix="MWh/year"
                  value={(lead.estimatedKwhPerYear / 1000).toFixed(1)}
                  accent
                />
                <FieldRow
                  label="Solar Density Ratio"
                  prefix="kWp/m²"
                  value={(kwp / building.areaSqm).toFixed(3)}
                />
              </>
            ) : (
              <button
                onClick={handleCalcSolar}
                disabled={calcingSolar}
                className="w-full h-8 bg-[#f97316] hover:bg-[#ea6d0e] disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
              >
                <Zap size={13} />
                {calcingSolar ? "A calcular…" : "Calculate Solar (PVGIS)"}
              </button>
            )}
          </>
        )}

        {tab === "drop" && (
          <div className="text-xs text-[#8892a4] py-2 text-center">
            Selecciona um motivo de exclusão
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 pt-1 border-t border-[#1e1f30] space-y-1">
        <button
          onClick={() => setShowLocationDetails(true)}
          className="w-full flex items-center justify-between text-[12px] text-[#8892a4] hover:text-white py-1 transition-colors"
        >
          <span>More Location Details</span>
          <ChevronRight size={14} />
        </button>
        <button
          type="button"
          onClick={() => openExternal(streetViewUrl(building.centroidLat, building.centroidLon))}
          className="w-full flex items-center justify-between text-[12px] text-[#8892a4] hover:text-white py-1 transition-colors"
        >
          <span>Street View</span>
          <ExternalLink size={12} />
        </button>
        <div className="text-[10px] text-[#4a5160] pt-1">
          Added: {addedDate} · Last change: {updatedDate}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all ${
        active
          ? "bg-[#f97316]/15 text-[#f97316] border border-[#f97316]/25"
          : "text-[#8892a4] hover:text-[#c8d0df] hover:bg-[#1e1f30]"
      }`}
    >
      {label}
    </button>
  );
}

function FieldRow({
  label, prefix, value, accent, icon,
}: {
  label: string;
  prefix?: string;
  value: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] text-[#4a5160] uppercase tracking-wide mb-0.5">
        {icon}
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        {prefix && <span className="text-[11px] text-[#8892a4]">{prefix}</span>}
        <span className={`text-sm font-medium ${accent ? "text-[#f97316]" : "text-white"}`}>{value}</span>
      </div>
    </div>
  );
}

function EditableFieldRow({
  label, icon, value, editing, editValue,
  onEdit, onChange, onSave, onCancel,
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  editing: boolean;
  editValue: string;
  onEdit: () => void;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] text-[#4a5160] uppercase tracking-wide mb-0.5">
        {icon}
        {label}
      </div>
      {editing ? (
        <div className="flex gap-1">
          <input
            autoFocus
            className="flex-1 bg-[#1e1f30] border border-[#f97316]/50 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
            value={editValue}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
          />
          <button onClick={onSave} className="px-2 py-0.5 bg-[#f97316] text-white text-xs rounded hover:bg-[#ea6d0e]">✓</button>
        </div>
      ) : (
        <div className="flex items-center gap-2 group">
          <span className="flex-1 text-sm text-white truncate">{value}</span>
          <button
            onClick={onEdit}
            className="opacity-0 group-hover:opacity-100 w-5 h-5 bg-[#f97316] hover:bg-[#ea6d0e] rounded flex items-center justify-center transition-all shrink-0"
          >
            <span className="text-white text-[10px]">✎</span>
          </button>
        </div>
      )}
    </div>
  );
}
