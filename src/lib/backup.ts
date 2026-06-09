/**
 * Full data backup / restore as a portable JSON file.
 * Avoids needing direct .db file access — works via Blob download + file input
 * in both the Tauri webview and the browser.
 */
import {
  getAllBuildings, getAllLeads, getAllNotes,
  saveBuildingsBatch, saveLead, addNote,
} from "../db/database";
import type { Lead } from "../types/building";

const BACKUP_VERSION = 1;

export interface BackupFile {
  version: number;
  exportedAt: string;
  buildings: unknown[];
  leads: Lead[];
  notes: Record<string, { author: string; body: string; createdAt: string }[]>;
}

/** Build a backup object from the current DB. */
export async function exportBackup(): Promise<BackupFile> {
  const [buildings, leads, notes] = await Promise.all([
    getAllBuildings(),
    getAllLeads(),
    getAllNotes(),
  ]);
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    buildings,
    leads,
    notes: Object.fromEntries(
      Object.entries(notes).map(([leadId, arr]) => [
        leadId,
        arr.map((n) => ({ author: n.author, body: n.body, createdAt: n.createdAt })),
      ]),
    ),
  };
}

/** Trigger a .json download of the full backup. */
export async function downloadBackup(): Promise<number> {
  const data = await exportBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pye_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return data.leads.length;
}

export interface RestoreResult { buildings: number; leads: number; notes: number; }

/** Restore from a parsed backup file. Upserts buildings + leads, appends notes. */
export async function restoreBackup(raw: unknown): Promise<RestoreResult> {
  const data = raw as Partial<BackupFile>;
  if (!data || typeof data !== "object" || !Array.isArray(data.leads)) {
    throw new Error("Ficheiro de backup inválido");
  }
  if (data.version && data.version > BACKUP_VERSION) {
    throw new Error(`Backup de versão ${data.version} mais recente que a app (${BACKUP_VERSION})`);
  }

  let buildingsN = 0, leadsN = 0, notesN = 0;

  if (Array.isArray(data.buildings) && data.buildings.length > 0) {
    // saveBuildingsBatch validates shape loosely; bad rows are ignored by INSERT OR IGNORE
    await saveBuildingsBatch(data.buildings as Parameters<typeof saveBuildingsBatch>[0]);
    buildingsN = data.buildings.length;
  }

  for (const lead of data.leads) {
    if (!lead?.id || !lead?.buildingId) continue;
    await saveLead(lead);
    leadsN++;
  }

  if (data.notes) {
    for (const [leadId, arr] of Object.entries(data.notes)) {
      for (const n of arr) {
        try { await addNote(leadId, n.body, n.author); notesN++; } catch { /* skip */ }
      }
    }
  }

  return { buildings: buildingsN, leads: leadsN, notes: notesN };
}

/** Read a File (from <input type=file>) as parsed JSON. */
export async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text);
}
