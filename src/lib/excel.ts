import * as XLSX from "xlsx";
import type { BuildingFeature, Lead, LeadNote, LeadTask } from "../types/building";
import { SOLAR_STATUS_LABELS, PIPELINE_LABELS } from "../types/building";

interface ExportData {
  buildings: BuildingFeature[];
  leads: Record<string, Lead>;
  notes?: Record<string, LeadNote[]>;
  tasks?: Record<string, LeadTask[]>;
}

export function exportToExcel(data: ExportData): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1 — Leads (main view)
  const leadRows = data.buildings.map((b) => {
    const lead = data.leads[b.id];
    return {
      ID: b.id,
      "Nome / Operador": b.name ?? b.operator ?? "",
      Morada: lead?.address ?? "",
      "Latitude": b.centroidLat.toFixed(6),
      "Longitude": b.centroidLon.toFixed(6),
      "Área (m²)": Math.round(b.areaSqm),
      "Tipo OSM": b.buildingTag ?? "",
      "Empresa": lead?.company ?? "",
      "NIF": lead?.nif ?? "",
      "CAE": lead?.cae ?? "",
      "Telefone": lead?.telephone ?? "",
      "Website": lead?.website ?? "",
      "Estado Solar": lead ? SOLAR_STATUS_LABELS[lead.solarStatus] : "",
      "Pipeline": lead ? PIPELINE_LABELS[lead.pipelineStage] : "",
      "Score": lead?.score ?? "",
      "kWp Estimado": lead?.estimatedKwp ?? "",
      "kWh/ano": lead?.estimatedKwhPerYear ?? "",
      "Valor Estimado (€)": lead?.estimatedValueEur ?? "",
      "Probabilidade (%)": lead?.probability ?? "",
      "Parque Industrial": lead?.industrialPark ?? "",
      "Notas": lead?.notes ?? "",
      "Tags": lead?.tags ?? "",
      "Criado": lead?.createdAt ?? "",
      "Atualizado": lead?.updatedAt ?? "",
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
          "Lead": company,
          "Autor": n.author,
          "Data": new Date(n.createdAt).toLocaleString("pt-PT"),
          "Nota": n.body,
        });
      });
    });
    if (noteRows.length > 0) {
      const wsNotes = XLSX.utils.json_to_sheet(noteRows);
      XLSX.utils.book_append_sheet(wb, wsNotes, "Notas");
    }
  }

  // Sheet 3 — Tasks
  if (data.tasks) {
    const taskRows: object[] = [];
    Object.entries(data.tasks).forEach(([leadId, tasks]) => {
      const lead = data.leads[leadId];
      const company = lead?.company || "—";
      tasks.forEach((t) => {
        taskRows.push({
          "Lead": company,
          "Tarefa": t.title,
          "Estado": t.done ? "Concluída" : "Pendente",
          "Data prevista": t.dueDate ?? "",
          "Criada": new Date(t.createdAt).toLocaleDateString("pt-PT"),
          "Concluída em": t.completedAt ? new Date(t.completedAt).toLocaleDateString("pt-PT") : "",
        });
      });
    });
    if (taskRows.length > 0) {
      const wsTasks = XLSX.utils.json_to_sheet(taskRows);
      XLSX.utils.book_append_sheet(wb, wsTasks, "Tarefas");
    }
  }

  // Trigger download
  const filename = `pye_prospector_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
