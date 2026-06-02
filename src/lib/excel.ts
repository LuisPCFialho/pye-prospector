import * as XLSX from "xlsx";
import type { BuildingFeature, Lead, LeadNote } from "../types/building";
import { SOLAR_STATUS_LABELS, PIPELINE_LABELS } from "../types/building";

interface ExportData {
  buildings: BuildingFeature[];
  leads: Record<string, Lead>;
  notes?: Record<string, LeadNote[]>;
}

export function exportToExcel(data: ExportData): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1 — Leads
  const leadRows = data.buildings.map((b) => {
    const lead = data.leads[b.id];
    return {
      ID: b.id,
      "Nome / Operador": b.name ?? b.operator ?? "",
      Morada: lead?.address ?? "",
      Latitude: b.centroidLat.toFixed(6),
      Longitude: b.centroidLon.toFixed(6),
      "Área (m²)": Math.round(b.areaSqm),
      "Tipo OSM": b.buildingTag ?? "",
      Empresa: lead?.company ?? "",
      NIF: lead?.nif ?? "",
      Telefone: lead?.telephone ?? "",
      Website: lead?.website ?? "",
      Email: lead?.email ?? "",
      "Estado Solar": lead ? SOLAR_STATUS_LABELS[lead.solarStatus] : "",
      Pipeline: lead ? PIPELINE_LABELS[lead.pipelineStage] : "",
      "kWp Estimado": lead?.estimatedKwp ?? "",
      "kWh/ano": lead?.estimatedKwhPerYear ?? "",
      Notas: lead?.notes ?? "",
      Tags: lead?.tags ?? "",
      Owner: lead?.owner ?? "",
      Criado: lead?.createdAt ?? "",
      Atualizado: lead?.updatedAt ?? "",
    };
  });
  const wsLeads = XLSX.utils.json_to_sheet(leadRows);
  XLSX.utils.book_append_sheet(wb, wsLeads, "Leads");

  // Sheet 2 — Notes
  if (data.notes) {
    const noteRows: object[] = [];
    Object.entries(data.notes).forEach(([leadId, notes]) => {
      const lead = data.leads[leadId];
      const company = lead?.company || "—";
      notes.forEach((n) => {
        noteRows.push({
          Lead: company,
          Autor: n.author,
          Data: new Date(n.createdAt).toLocaleString("pt-PT"),
          Nota: n.body,
        });
      });
    });
    if (noteRows.length > 0) {
      const wsNotes = XLSX.utils.json_to_sheet(noteRows);
      XLSX.utils.book_append_sheet(wb, wsNotes, "Notas");
    }
  }

  const filename = `pye_prospector_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
