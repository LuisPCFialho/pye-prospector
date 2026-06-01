import Database from "@tauri-apps/plugin-sql";
import type { BuildingFeature, Lead, LeadNote, LeadTask } from "../types/building";

type DB = Awaited<ReturnType<typeof Database.load>>;
let _db: DB | null = null;

async function getDB(): Promise<DB> {
  if (!_db) _db = await Database.load("sqlite:pye_prospector.db");
  return _db;
}

// ── Buildings ────────────────────────────────────────────────────────────────

export async function saveBuilding(b: BuildingFeature): Promise<void> {
  const db = await getDB();
  await db.execute(
    `INSERT OR IGNORE INTO buildings
       (id, osm_id, source, geometry, centroid_lon, centroid_lat,
        area_sqm, building_tag, name, operator, raw_tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      b.id, b.osmId ?? null, b.source,
      JSON.stringify(b.geometryGeoJSON),
      b.centroidLon, b.centroidLat, b.areaSqm,
      b.buildingTag ?? null, b.name ?? null, b.operator ?? null,
      JSON.stringify(b.rawTags ?? {}),
    ],
  );
}

export async function saveBuildingsBatch(buildings: BuildingFeature[]): Promise<void> {
  for (const b of buildings) await saveBuilding(b);
}

interface DBBuilding {
  id: string; osm_id: number | null; source: string;
  geometry: string; centroid_lon: number; centroid_lat: number;
  area_sqm: number; building_tag: string | null;
  name: string | null; operator: string | null; raw_tags: string;
}

function rowToBuilding(r: DBBuilding): BuildingFeature {
  return {
    id: r.id, osmId: r.osm_id ?? undefined,
    source: r.source as BuildingFeature["source"],
    geometryGeoJSON: JSON.parse(r.geometry),
    centroidLon: r.centroid_lon, centroidLat: r.centroid_lat,
    areaSqm: r.area_sqm, buildingTag: r.building_tag ?? undefined,
    name: r.name ?? undefined, operator: r.operator ?? undefined,
    rawTags: JSON.parse(r.raw_tags),
  };
}

export async function getAllBuildings(): Promise<BuildingFeature[]> {
  const db = await getDB();
  const rows = await db.select<DBBuilding[]>("SELECT * FROM buildings ORDER BY area_sqm DESC");
  return rows.map(rowToBuilding);
}

// ── Leads ────────────────────────────────────────────────────────────────────

interface DBLead {
  id: string; building_id: string; address: string | null;
  solar_status: string; pipeline_stage: string;
  estimated_kwh_per_year: number | null; estimated_kwp: number | null;
  monthly_kwh: string | null; company: string | null;
  telephone: string | null; website: string | null;
  notes: string | null; tags: string | null; owner: string | null;
  score: number | null; score_explanations: string | null;
  nif: string | null; cae: string | null;
  estimated_value_eur: number | null; probability: number | null;
  industrial_park: string | null; building_use: string | null;
  has_existing_pv: string | null;
  created_at: string; updated_at: string;
}

function rowToLead(r: DBLead): Lead {
  return {
    id: r.id, buildingId: r.building_id, address: r.address ?? undefined,
    solarStatus: r.solar_status as Lead["solarStatus"],
    pipelineStage: r.pipeline_stage as Lead["pipelineStage"],
    estimatedKwhPerYear: r.estimated_kwh_per_year ?? undefined,
    estimatedKwp: r.estimated_kwp ?? undefined,
    monthlyKwh: r.monthly_kwh ? JSON.parse(r.monthly_kwh) : undefined,
    company: r.company ?? undefined, telephone: r.telephone ?? undefined,
    website: r.website ?? undefined, notes: r.notes ?? undefined,
    tags: r.tags ?? undefined, owner: r.owner ?? undefined,
    score: r.score ?? undefined,
    scoreExplanations: r.score_explanations ? JSON.parse(r.score_explanations) : undefined,
    nif: r.nif ?? undefined, cae: r.cae ?? undefined,
    estimatedValueEur: r.estimated_value_eur ?? undefined,
    probability: r.probability ?? undefined,
    industrialPark: r.industrial_park ?? undefined,
    buildingUse: r.building_use as Lead["buildingUse"] ?? undefined,
    hasExistingPv: r.has_existing_pv as Lead["hasExistingPv"] ?? undefined,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function saveLead(lead: Lead): Promise<void> {
  const db = await getDB();
  await db.execute(
    `INSERT OR REPLACE INTO leads
       (id, building_id, address, solar_status, pipeline_stage,
        estimated_kwh_per_year, estimated_kwp, monthly_kwh,
        company, telephone, website, notes, tags, owner,
        score, score_explanations, nif, cae, estimated_value_eur,
        probability, industrial_park, building_use, has_existing_pv,
        updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      lead.id, lead.buildingId, lead.address ?? null,
      lead.solarStatus, lead.pipelineStage,
      lead.estimatedKwhPerYear ?? null, lead.estimatedKwp ?? null,
      lead.monthlyKwh ? JSON.stringify(lead.monthlyKwh) : null,
      lead.company ?? null, lead.telephone ?? null,
      lead.website ?? null, lead.notes ?? null,
      lead.tags ?? null, lead.owner ?? null,
      lead.score ?? null,
      lead.scoreExplanations ? JSON.stringify(lead.scoreExplanations) : null,
      lead.nif ?? null, lead.cae ?? null,
      lead.estimatedValueEur ?? null, lead.probability ?? null,
      lead.industrialPark ?? null, lead.buildingUse ?? null,
      lead.hasExistingPv ?? null,
    ],
  );
}

export async function getAllLeads(): Promise<Lead[]> {
  const db = await getDB();
  const rows = await db.select<DBLead[]>("SELECT * FROM leads ORDER BY updated_at DESC");
  return rows.map(rowToLead);
}

export async function duplicateLead(leadId: string): Promise<Lead | null> {
  const db = await getDB();
  const rows = await db.select<DBLead[]>("SELECT * FROM leads WHERE id = ?", [leadId]);
  if (!rows.length) return null;
  const original = rowToLead(rows[0]);
  const copy: Lead = {
    ...original,
    id: crypto.randomUUID(),
    company: original.company ? `${original.company} (cópia)` : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveLead(copy);
  return copy;
}

// ── Notes ────────────────────────────────────────────────────────────────────

interface DBNote {
  id: string; lead_id: string; author: string;
  body: string; created_at: string;
}

function rowToNote(r: DBNote): LeadNote {
  return {
    id: r.id, leadId: r.lead_id, author: r.author,
    body: r.body, createdAt: r.created_at,
  };
}

export async function addNote(leadId: string, body: string, author = "Eu"): Promise<LeadNote> {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db.execute(
    "INSERT INTO lead_notes (id, lead_id, author, body) VALUES (?, ?, ?, ?)",
    [id, leadId, author, body],
  );
  return { id, leadId, author, body, createdAt: new Date().toISOString() };
}

export async function getNotesByLead(leadId: string): Promise<LeadNote[]> {
  const db = await getDB();
  const rows = await db.select<DBNote[]>(
    "SELECT * FROM lead_notes WHERE lead_id = ? ORDER BY created_at DESC", [leadId],
  );
  return rows.map(rowToNote);
}

export async function getAllNotes(): Promise<Record<string, LeadNote[]>> {
  const db = await getDB();
  const rows = await db.select<DBNote[]>(
    "SELECT * FROM lead_notes ORDER BY created_at DESC",
  );
  const grouped: Record<string, LeadNote[]> = {};
  for (const r of rows) {
    const n = rowToNote(r);
    if (!grouped[n.leadId]) grouped[n.leadId] = [];
    grouped[n.leadId].push(n);
  }
  return grouped;
}

export async function deleteNote(noteId: string): Promise<void> {
  const db = await getDB();
  await db.execute("DELETE FROM lead_notes WHERE id = ?", [noteId]);
}

// ── Tasks ────────────────────────────────────────────────────────────────────

interface DBTask {
  id: string; lead_id: string; title: string;
  done: number; due_date: string | null;
  created_at: string; completed_at: string | null;
}

function rowToTask(r: DBTask): LeadTask {
  return {
    id: r.id, leadId: r.lead_id, title: r.title,
    done: r.done === 1,
    dueDate: r.due_date ?? undefined,
    createdAt: r.created_at,
    completedAt: r.completed_at ?? undefined,
  };
}

export async function addTask(leadId: string, title: string, dueDate?: string): Promise<LeadTask> {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db.execute(
    "INSERT INTO lead_tasks (id, lead_id, title, due_date) VALUES (?, ?, ?, ?)",
    [id, leadId, title, dueDate ?? null],
  );
  return { id, leadId, title, done: false, dueDate, createdAt: new Date().toISOString() };
}

export async function toggleTaskDone(taskId: string, done: boolean): Promise<void> {
  const db = await getDB();
  await db.execute(
    "UPDATE lead_tasks SET done = ?, completed_at = ? WHERE id = ?",
    [done ? 1 : 0, done ? new Date().toISOString() : null, taskId],
  );
}

export async function getTasksByLead(leadId: string): Promise<LeadTask[]> {
  const db = await getDB();
  const rows = await db.select<DBTask[]>(
    "SELECT * FROM lead_tasks WHERE lead_id = ? ORDER BY done ASC, created_at DESC", [leadId],
  );
  return rows.map(rowToTask);
}

export async function getAllTasks(): Promise<Record<string, LeadTask[]>> {
  const db = await getDB();
  const rows = await db.select<DBTask[]>(
    "SELECT * FROM lead_tasks ORDER BY done ASC, created_at DESC",
  );
  const grouped: Record<string, LeadTask[]> = {};
  for (const r of rows) {
    const t = rowToTask(r);
    if (!grouped[t.leadId]) grouped[t.leadId] = [];
    grouped[t.leadId].push(t);
  }
  return grouped;
}

export async function deleteTask(taskId: string): Promise<void> {
  const db = await getDB();
  await db.execute("DELETE FROM lead_tasks WHERE id = ?", [taskId]);
}

// ── Export CSV ───────────────────────────────────────────────────────────────

export async function exportLeadsCSV(): Promise<string> {
  const db = await getDB();
  const rows = await db.select<(DBLead & DBBuilding)[]>(`
    SELECT l.*, b.centroid_lat, b.centroid_lon, b.area_sqm, b.name, b.building_tag
    FROM leads l JOIN buildings b ON l.building_id = b.id
    ORDER BY l.updated_at DESC`);

  const header = [
    "id","address","lat","lon","area_m2","building_type","company","nif","cae",
    "telephone","website","solar_status","pipeline_stage","score",
    "estimated_kwh_year","estimated_kwp","estimated_value_eur","probability",
    "industrial_park","notes","updated_at",
  ].join(",");

  const lines = rows.map((r) =>
    [
      r.id, `"${r.address ?? ""}"`,
      r.centroid_lat, r.centroid_lon, r.area_sqm, r.building_tag ?? "",
      `"${r.company ?? ""}"`, `"${r.nif ?? ""}"`, `"${r.cae ?? ""}"`,
      `"${r.telephone ?? ""}"`, `"${r.website ?? ""}"`,
      r.solar_status, r.pipeline_stage, r.score ?? "",
      r.estimated_kwh_per_year ?? "", r.estimated_kwp ?? "",
      r.estimated_value_eur ?? "", r.probability ?? "",
      r.industrial_park ?? "",
      `"${(r.notes ?? "").replace(/"/g, "'")}"`, r.updated_at,
    ].join(","),
  );

  return [header, ...lines].join("\n");
}

// ── Dashboard stats ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totalBuildings: number;
  totalLeads: number;
  totalAreaSqm: number;
  totalKwhPerYear: number;
  avgScore: number;
  totalEstimatedValueEur: number;
  bySolarStatus: Record<string, number>;
  byPipelineStage: Record<string, number>;
  topLeads: { id: string; company: string; score: number }[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = await getDB();

  const [{ cnt: totalBuildings }] = await db.select<[{ cnt: number }]>(
    "SELECT COUNT(*) as cnt FROM buildings");
  const [{ cnt: totalLeads }] = await db.select<[{ cnt: number }]>(
    "SELECT COUNT(*) as cnt FROM leads");
  const [{ total }] = await db.select<[{ total: number }]>(
    "SELECT COALESCE(SUM(area_sqm),0) as total FROM buildings");
  const [{ kwh }] = await db.select<[{ kwh: number }]>(
    "SELECT COALESCE(SUM(estimated_kwh_per_year),0) as kwh FROM leads");
  const [{ avg }] = await db.select<[{ avg: number }]>(
    "SELECT COALESCE(AVG(score),0) as avg FROM leads WHERE score IS NOT NULL");
  const [{ val }] = await db.select<[{ val: number }]>(
    "SELECT COALESCE(SUM(estimated_value_eur),0) as val FROM leads");

  const solarRows = await db.select<{ solar_status: string; cnt: number }[]>(
    "SELECT solar_status, COUNT(*) as cnt FROM leads GROUP BY solar_status");
  const pipelineRows = await db.select<{ pipeline_stage: string; cnt: number }[]>(
    "SELECT pipeline_stage, COUNT(*) as cnt FROM leads GROUP BY pipeline_stage");
  const topRows = await db.select<{ id: string; company: string | null; score: number }[]>(
    "SELECT id, company, score FROM leads WHERE score IS NOT NULL ORDER BY score DESC LIMIT 5");

  return {
    totalBuildings,
    totalLeads,
    totalAreaSqm: total,
    totalKwhPerYear: kwh,
    avgScore: Math.round(avg),
    totalEstimatedValueEur: val,
    bySolarStatus: Object.fromEntries(solarRows.map((r) => [r.solar_status, r.cnt])),
    byPipelineStage: Object.fromEntries(pipelineRows.map((r) => [r.pipeline_stage, r.cnt])),
    topLeads: topRows.map((r) => ({ id: r.id, company: r.company ?? "—", score: r.score })),
  };
}
