import Database from "@tauri-apps/plugin-sql";
import type { BuildingFeature, Lead, LeadNote, SolarStatus, PipelineStage, BuildingUse, DropReason } from "../types/building";

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

export async function saveBuildingsBatch(buildings: BuildingFeature[]): Promise<void> {
  if (buildings.length === 0) return;
  const db = await getDB();
  // Wrap in a transaction: atomic + dramatically faster than N autocommits
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
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function saveLead(lead: Lead): Promise<void> {
  const db = await getDB();
  await db.execute(
    `INSERT OR REPLACE INTO leads
       (id, building_id, address, solar_status, pipeline_stage,
        estimated_kwh_per_year, estimated_kwp, monthly_kwh,
        company, telephone, website, email, notes, tags, owner,
        nif, building_use, has_existing_pv,
        flagged, drop_reason,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,  datetime('now'))`,
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
      lead.flagged ? 1 : 0, lead.dropReason ?? null,
      lead.createdAt,
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

  const lines = rows.map((r) =>
    [
      r.id, `"${r.address ?? ""}"`,
      r.centroid_lat, r.centroid_lon, r.area_sqm, r.building_tag ?? "",
      `"${r.company ?? ""}"`, `"${r.nif ?? ""}"`,
      `"${r.telephone ?? ""}"`, `"${r.website ?? ""}"`, `"${r.email ?? ""}"`,
      r.solar_status, r.pipeline_stage, r.flagged ? "sim" : "",
      r.estimated_kwh_per_year ?? "", r.estimated_kwp ?? "",
      `"${(r.notes ?? "").replace(/"/g, "'")}"`, r.updated_at,
    ].join(","),
  );

  return [header, ...lines].join("\n");
}
