import Database from "@tauri-apps/plugin-sql";
import * as turf from "@turf/turf";
import type {
  BuildingFeature, Lead, LeadNote, SolarStatus, PipelineStage, BuildingUse, DropReason,
  Territory, LeadContact, LeadActivity, ActivityType,
} from "../types/building";
import { csvCell } from "../lib/csv";

type DB = Awaited<ReturnType<typeof Database.load>>;
let _db: DB | null = null;

async function getDB(): Promise<DB> {
  if (!_db) _db = await Database.load("sqlite:pye_prospector.db");
  return _db;
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; }
  catch { return fallback; }
}

const VALID_SOLAR: ReadonlySet<string> = new Set(["unknown","no_panels","has_panels","partial","inconclusive"]);
const VALID_PIPELINE: ReadonlySet<string> = new Set(["to_contact","contacted","meeting","proposal","won","lost"]);
const VALID_USE: ReadonlySet<string> = new Set(["food_beverage","metalwork","logistics","retail","hotels","agriculture","office","other"]);

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

// Serializes batch writes so concurrent calls can't nest BEGIN TRANSACTION
// (SQLite has no nested transactions — a second BEGIN would error and the
// ROLLBACK would discard the first batch).
let _batchLock: Promise<unknown> = Promise.resolve();

export function saveBuildingsBatch(buildings: BuildingFeature[]): Promise<void> {
  const run = _batchLock.then(() => _saveBuildingsBatch(buildings));
  _batchLock = run.then(() => undefined, () => undefined);
  return run;
}

async function _saveBuildingsBatch(buildings: BuildingFeature[]): Promise<void> {
  if (buildings.length === 0) return;
  const db = await getDB();
  // Use a SAVEPOINT (nestable) + transaction for atomicity and speed.
  try {
    await db.execute("BEGIN TRANSACTION");
    for (const b of buildings) {
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
    await db.execute("COMMIT");
  } catch (e) {
    try { await db.execute("ROLLBACK"); } catch { /* ignore */ }
    throw e;
  }
}

interface DBBuilding {
  id: string; osm_id: number | null; source: string;
  geometry: string; centroid_lon: number; centroid_lat: number;
  area_sqm: number; building_tag: string | null;
  name: string | null; operator: string | null; raw_tags: string;
}

function rowToBuilding(r: DBBuilding): BuildingFeature | null {
  try {
    return {
      id: r.id,
      osmId: r.osm_id ?? undefined,
      source: r.source as BuildingFeature["source"],
      geometryGeoJSON: JSON.parse(r.geometry),
      centroidLon: r.centroid_lon,
      centroidLat: r.centroid_lat,
      areaSqm: r.area_sqm,
      buildingTag: r.building_tag ?? undefined,
      name: r.name ?? undefined,
      operator: r.operator ?? undefined,
      rawTags: safeJsonParse<Record<string, string>>(r.raw_tags, {}),
    };
  } catch {
    return null;
  }
}

export async function getAllBuildings(): Promise<BuildingFeature[]> {
  const db = await getDB();
  const rows = await db.select<DBBuilding[]>("SELECT * FROM buildings ORDER BY area_sqm DESC");
  return rows.map(rowToBuilding).filter((b): b is BuildingFeature => b !== null);
}

// ── Leads ────────────────────────────────────────────────────────────────────

interface DBLead {
  id: string; building_id: string; address: string | null;
  solar_status: string; pipeline_stage: string;
  estimated_kwh_per_year: number | null; estimated_kwp: number | null;
  monthly_kwh: string | null; company: string | null;
  telephone: string | null; website: string | null; email: string | null;
  notes: string | null; tags: string | null; owner: string | null;
  nif: string | null; building_use: string | null;
  has_existing_pv: string | null;
  flagged: number | null; drop_reason: string | null;
  territory_id: string | null; next_action_date: string | null; next_action_note: string | null;
  score: number | null;
  created_at: string; updated_at: string;
}

function rowToLead(r: DBLead): Lead {
  return {
    id: r.id,
    buildingId: r.building_id,
    address: r.address ?? undefined,
    solarStatus: VALID_SOLAR.has(r.solar_status) ? r.solar_status as SolarStatus : "unknown",
    pipelineStage: VALID_PIPELINE.has(r.pipeline_stage) ? r.pipeline_stage as PipelineStage : "to_contact",
    estimatedKwhPerYear: r.estimated_kwh_per_year ?? undefined,
    estimatedKwp: r.estimated_kwp ?? undefined,
    monthlyKwh: safeJsonParse<number[]>(r.monthly_kwh, []) || undefined,
    company: r.company ?? undefined,
    telephone: r.telephone ?? undefined,
    website: r.website ?? undefined,
    email: r.email ?? undefined,
    notes: r.notes ?? undefined,
    tags: r.tags ?? undefined,
    owner: r.owner ?? undefined,
    nif: r.nif ?? undefined,
    buildingUse: VALID_USE.has(r.building_use ?? "") ? r.building_use as BuildingUse : undefined,
    hasExistingPv: r.has_existing_pv as Lead["hasExistingPv"] ?? undefined,
    flagged: r.flagged === 1 ? true : false,
    dropReason: r.drop_reason as DropReason ?? undefined,
    territoryId: r.territory_id ?? undefined,
    nextActionDate: r.next_action_date ?? undefined,
    nextActionNote: r.next_action_note ?? undefined,
    score: r.score ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function saveLead(lead: Lead): Promise<void> {
  const db = await getDB();
  // True upsert: ON CONFLICT DO UPDATE never deletes the row, so created_at is
  // preserved on existing leads (INSERT OR REPLACE would reset it).
  await db.execute(
    `INSERT INTO leads
       (id, building_id, address, solar_status, pipeline_stage,
        estimated_kwh_per_year, estimated_kwp, monthly_kwh,
        company, telephone, website, email, notes, tags, owner,
        nif, building_use, has_existing_pv,
        flagged, drop_reason,
        territory_id, next_action_date, next_action_note, score,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
        building_id = excluded.building_id,
        address = excluded.address,
        solar_status = excluded.solar_status,
        pipeline_stage = excluded.pipeline_stage,
        estimated_kwh_per_year = excluded.estimated_kwh_per_year,
        estimated_kwp = excluded.estimated_kwp,
        monthly_kwh = excluded.monthly_kwh,
        company = excluded.company,
        telephone = excluded.telephone,
        website = excluded.website,
        email = excluded.email,
        notes = excluded.notes,
        tags = excluded.tags,
        owner = excluded.owner,
        nif = excluded.nif,
        building_use = excluded.building_use,
        has_existing_pv = excluded.has_existing_pv,
        flagged = excluded.flagged,
        drop_reason = excluded.drop_reason,
        territory_id = excluded.territory_id,
        next_action_date = excluded.next_action_date,
        next_action_note = excluded.next_action_note,
        score = excluded.score,
        updated_at = datetime('now')`,
    [
      lead.id, lead.buildingId, lead.address ?? null,
      lead.solarStatus, lead.pipelineStage,
      lead.estimatedKwhPerYear ?? null, lead.estimatedKwp ?? null,
      lead.monthlyKwh && lead.monthlyKwh.length > 0 ? JSON.stringify(lead.monthlyKwh) : null,
      lead.company ?? null, lead.telephone ?? null,
      lead.website ?? null, lead.email ?? null,
      lead.notes ?? null, lead.tags ?? null, lead.owner ?? null,
      lead.nif ?? null, lead.buildingUse ?? null,
      lead.hasExistingPv ?? null,
      lead.flagged === true ? 1 : 0, lead.dropReason ?? null,
      lead.territoryId ?? null, lead.nextActionDate ?? null, lead.nextActionNote ?? null,
      lead.score ?? null,
      lead.createdAt ?? new Date().toISOString(),
    ],
  );
}

export async function getAllLeads(): Promise<Lead[]> {
  const db = await getDB();
  const rows = await db.select<DBLead[]>("SELECT * FROM leads ORDER BY updated_at DESC");
  return rows.map(rowToLead);
}

export async function deleteLead(leadId: string): Promise<void> {
  const db = await getDB();
  await db.execute("DELETE FROM leads WHERE id = ?", [leadId]);
}

// ── Territories ───────────────────────────────────────────────────────────────

interface DBTerritory {
  id: string; name: string; polygon: string; bbox: string;
  notes: string | null; created_at: string;
}

function rowToTerritory(r: DBTerritory): Territory | null {
  try {
    const bb = r.bbox.split(",").map(Number) as [number, number, number, number];
    return {
      id: r.id, name: r.name,
      polygonGeoJSON: JSON.parse(r.polygon),
      bbox: bb,
      notes: r.notes ?? undefined,
      createdAt: r.created_at,
    };
  } catch { return null; }
}

export async function saveTerritory(name: string, poly: GeoJSON.Polygon, notes?: string): Promise<Territory> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const bb = turf.bbox(poly);
  await db.execute(
    "INSERT INTO territories (id, name, polygon, bbox, notes) VALUES (?, ?, ?, ?, ?)",
    [id, name, JSON.stringify(poly), bb.join(","), notes ?? null],
  );
  return { id, name, polygonGeoJSON: poly, bbox: bb as [number, number, number, number], notes, createdAt: new Date().toISOString() };
}

export async function getAllTerritories(): Promise<Territory[]> {
  const db = await getDB();
  const rows = await db.select<DBTerritory[]>("SELECT * FROM territories ORDER BY created_at DESC");
  return rows.map(rowToTerritory).filter((t): t is Territory => t !== null);
}

export async function deleteTerritory(id: string): Promise<void> {
  const db = await getDB();
  await db.execute("UPDATE leads SET territory_id = NULL WHERE territory_id = ?", [id]);
  await db.execute("DELETE FROM territories WHERE id = ?", [id]);
}

// ── Bulk operations (driven by selectionIds) ──────────────────────────────────

async function bulkUpdate(buildingIds: string[], setSql: string, value: unknown): Promise<void> {
  if (buildingIds.length === 0) return;
  const db = await getDB();
  try {
    await db.execute("BEGIN TRANSACTION");
    for (const id of buildingIds) {
      await db.execute(
        `UPDATE leads SET ${setSql}, updated_at = datetime('now') WHERE building_id = ?`,
        [value, id],
      );
    }
    await db.execute("COMMIT");
  } catch (e) {
    try { await db.execute("ROLLBACK"); } catch { /* ignore */ }
    throw e;
  }
}

export const bulkSetStage = (ids: string[], stage: PipelineStage) =>
  bulkUpdate(ids, "pipeline_stage = ?", stage);
export const bulkSetFlag = (ids: string[], flagged: boolean) =>
  bulkUpdate(ids, "flagged = ?", flagged ? 1 : 0);
export const bulkSetTerritory = (ids: string[], territoryId: string | null) =>
  bulkUpdate(ids, "territory_id = ?", territoryId);

// ── Activities ────────────────────────────────────────────────────────────────

interface DBActivity { id: string; lead_id: string; type: string; body: string | null; meta: string | null; created_at: string; }

export async function addActivity(leadId: string, type: ActivityType, body?: string, meta?: string): Promise<void> {
  const db = await getDB();
  await db.execute(
    "INSERT INTO lead_activities (id, lead_id, type, body, meta) VALUES (?, ?, ?, ?, ?)",
    [crypto.randomUUID(), leadId, type, body ?? null, meta ?? null],
  );
}

export async function getActivities(leadId: string): Promise<LeadActivity[]> {
  const db = await getDB();
  const rows = await db.select<DBActivity[]>(
    "SELECT * FROM lead_activities WHERE lead_id = ? ORDER BY created_at DESC", [leadId],
  );
  return rows.map((r) => ({
    id: r.id, leadId: r.lead_id, type: r.type as ActivityType,
    body: r.body ?? undefined, meta: r.meta ?? undefined, createdAt: r.created_at,
  }));
}

// ── Contacts ──────────────────────────────────────────────────────────────────

interface DBContact { id: string; lead_id: string; name: string; role: string | null; phone: string | null; email: string | null; is_primary: number; }

export async function getContacts(leadId: string): Promise<LeadContact[]> {
  const db = await getDB();
  const rows = await db.select<DBContact[]>(
    "SELECT * FROM lead_contacts WHERE lead_id = ? ORDER BY is_primary DESC, name", [leadId],
  );
  return rows.map((r) => ({
    id: r.id, leadId: r.lead_id, name: r.name,
    role: r.role ?? undefined, phone: r.phone ?? undefined, email: r.email ?? undefined,
    isPrimary: r.is_primary === 1,
  }));
}

export async function addContact(c: Omit<LeadContact, "id">): Promise<LeadContact> {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db.execute(
    "INSERT INTO lead_contacts (id, lead_id, name, role, phone, email, is_primary) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, c.leadId, c.name, c.role ?? null, c.phone ?? null, c.email ?? null, c.isPrimary ? 1 : 0],
  );
  return { ...c, id };
}

export async function deleteContact(id: string): Promise<void> {
  const db = await getDB();
  await db.execute("DELETE FROM lead_contacts WHERE id = ?", [id]);
}

// ── Follow-ups & analytics ────────────────────────────────────────────────────

export async function getDueFollowUps(): Promise<Lead[]> {
  const db = await getDB();
  const rows = await db.select<DBLead[]>(
    `SELECT * FROM leads
       WHERE next_action_date IS NOT NULL
         AND date(next_action_date) <= date('now')
         AND pipeline_stage NOT IN ('won','lost')
       ORDER BY next_action_date ASC`,
  );
  return rows.map(rowToLead);
}

export interface FunnelRow { stage: string; n: number; kwp: number; }

export async function getFunnel(): Promise<FunnelRow[]> {
  const db = await getDB();
  return db.select<FunnelRow[]>(
    `SELECT pipeline_stage AS stage, COUNT(*) AS n, ROUND(COALESCE(SUM(estimated_kwp),0),1) AS kwp
       FROM leads GROUP BY pipeline_stage`,
  );
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
    grouped[n.leadId] ??= [];
    grouped[n.leadId].push(n);
  }
  return grouped;
}

export async function deleteNote(noteId: string): Promise<void> {
  const db = await getDB();
  await db.execute("DELETE FROM lead_notes WHERE id = ?", [noteId]);
}

// ── Export CSV ───────────────────────────────────────────────────────────────

export async function exportLeadsCSV(): Promise<string> {
  const db = await getDB();
  const rows = await db.select<(DBLead & DBBuilding)[]>(`
    SELECT l.*, b.centroid_lat, b.centroid_lon, b.area_sqm, b.name, b.building_tag
    FROM leads l JOIN buildings b ON l.building_id = b.id
    ORDER BY l.updated_at DESC`);

  const header = [
    "id","address","lat","lon","area_m2","building_type","company","nif",
    "telephone","website","email","solar_status","pipeline_stage","flagged",
    "estimated_kwh_year","estimated_kwp","notes","updated_at",
  ].join(",");

  // RFC 4180 quoting + formula-injection neutralization (prefix \t on = + - @).
  const cell = csvCell;

  const lines = rows.map((r) =>
    [
      cell(r.id), cell(r.address),
      r.centroid_lat, r.centroid_lon, r.area_sqm, cell(r.building_tag),
      cell(r.company), cell(r.nif),
      cell(r.telephone), cell(r.website), cell(r.email),
      cell(r.solar_status), cell(r.pipeline_stage), r.flagged ? "sim" : "",
      r.estimated_kwh_per_year ?? "", r.estimated_kwp ?? "",
      cell(r.notes), cell(r.updated_at),
    ].join(","),
  );

  return [header, ...lines].join("\n");
}
