import Database from "@tauri-apps/plugin-sql";
import type { BuildingFeature, Lead } from "../types/building";

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

export async function getBuildingsInBBox(
  minLon: number, minLat: number, maxLon: number, maxLat: number,
): Promise<BuildingFeature[]> {
  const db = await getDB();
  const rows = await db.select<DBBuilding[]>(
    `SELECT * FROM buildings
     WHERE centroid_lon BETWEEN ? AND ?
       AND centroid_lat BETWEEN ? AND ?`,
    [minLon, maxLon, minLat, maxLat],
  );
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
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function saveLead(lead: Lead): Promise<void> {
  const db = await getDB();
  await db.execute(
    `INSERT OR REPLACE INTO leads
       (id, building_id, address, solar_status, pipeline_stage,
        estimated_kwh_per_year, estimated_kwp, monthly_kwh,
        company, telephone, website, notes, tags, owner, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      lead.id, lead.buildingId, lead.address ?? null,
      lead.solarStatus, lead.pipelineStage,
      lead.estimatedKwhPerYear ?? null, lead.estimatedKwp ?? null,
      lead.monthlyKwh ? JSON.stringify(lead.monthlyKwh) : null,
      lead.company ?? null, lead.telephone ?? null,
      lead.website ?? null, lead.notes ?? null,
      lead.tags ?? null, lead.owner ?? null,
    ],
  );
}

export async function getAllLeads(): Promise<Lead[]> {
  const db = await getDB();
  const rows = await db.select<DBLead[]>("SELECT * FROM leads ORDER BY updated_at DESC");
  return rows.map(rowToLead);
}

export async function getLeadByBuildingId(buildingId: string): Promise<Lead | null> {
  const db = await getDB();
  const rows = await db.select<DBLead[]>(
    "SELECT * FROM leads WHERE building_id = ? LIMIT 1", [buildingId],
  );
  return rows.length ? rowToLead(rows[0]) : null;
}

// ── Export CSV ───────────────────────────────────────────────────────────────

export async function exportLeadsCSV(): Promise<string> {
  const db = await getDB();
  const rows = await db.select<(DBLead & DBBuilding)[]>(`
    SELECT l.*, b.centroid_lat, b.centroid_lon, b.area_sqm, b.name, b.building_tag
    FROM leads l JOIN buildings b ON l.building_id = b.id
    ORDER BY l.updated_at DESC`);

  const header = [
    "id","address","lat","lon","area_m2","building_type","company",
    "telephone","website","solar_status","pipeline_stage",
    "estimated_kwh_year","estimated_kwp","notes","updated_at",
  ].join(",");

  const lines = rows.map((r) =>
    [
      r.id, `"${r.address ?? ""}"`,
      r.centroid_lat, r.centroid_lon, r.area_sqm, r.building_tag ?? "",
      `"${r.company ?? ""}"`, `"${r.telephone ?? ""}"`,
      `"${r.website ?? ""}"`, r.solar_status, r.pipeline_stage,
      r.estimated_kwh_per_year ?? "", r.estimated_kwp ?? "",
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
  bySolarStatus: Record<string, number>;
  byPipelineStage: Record<string, number>;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = await getDB();

  const [{ cnt: totalBuildings }] = await db.select<[{ cnt: number }]>(
    "SELECT COUNT(*) as cnt FROM buildings",
  );
  const [{ cnt: totalLeads }] = await db.select<[{ cnt: number }]>(
    "SELECT COUNT(*) as cnt FROM leads",
  );
  const [{ total }] = await db.select<[{ total: number }]>(
    "SELECT COALESCE(SUM(area_sqm),0) as total FROM buildings",
  );
  const [{ kwh }] = await db.select<[{ kwh: number }]>(
    "SELECT COALESCE(SUM(estimated_kwh_per_year),0) as kwh FROM leads",
  );

  const solarRows = await db.select<{ solar_status: string; cnt: number }[]>(
    "SELECT solar_status, COUNT(*) as cnt FROM leads GROUP BY solar_status",
  );
  const pipelineRows = await db.select<{ pipeline_stage: string; cnt: number }[]>(
    "SELECT pipeline_stage, COUNT(*) as cnt FROM leads GROUP BY pipeline_stage",
  );

  return {
    totalBuildings,
    totalLeads,
    totalAreaSqm: total,
    totalKwhPerYear: kwh,
    bySolarStatus: Object.fromEntries(solarRows.map((r) => [r.solar_status, r.cnt])),
    byPipelineStage: Object.fromEntries(pipelineRows.map((r) => [r.pipeline_stage, r.cnt])),
  };
}
