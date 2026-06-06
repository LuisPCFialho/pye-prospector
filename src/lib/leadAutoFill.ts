import type { BuildingFeature, Lead } from "../types/building";

/** Cascade through OSM tags to find the best company-name guess. */
export function pickCompany(b: BuildingFeature): string | undefined {
  const t = b.rawTags ?? {};
  return (
    t.operator ||
    t.brand ||
    t.owner ||
    t["operator:short"] ||
    t["brand:short"] ||
    b.operator ||
    b.name ||
    undefined
  );
}

/** Pick best website from OSM tags. */
export function pickWebsite(b: BuildingFeature): string | undefined {
  const t = b.rawTags ?? {};
  return (
    t["contact:website"] ||
    t.website ||
    t.url ||
    t["brand:website"] ||
    t["operator:website"] ||
    undefined
  );
}

/** Pick best telephone from OSM tags. */
export function pickPhone(b: BuildingFeature): string | undefined {
  const t = b.rawTags ?? {};
  return (
    t["contact:phone"] ||
    t.phone ||
    t["contact:mobile"] ||
    t.mobile ||
    undefined
  );
}

/** Pick best email from OSM tags. */
export function pickEmail(b: BuildingFeature): string | undefined {
  const t = b.rawTags ?? {};
  return t["contact:email"] || t.email || undefined;
}

/** Pick NIF (Portuguese VAT) — uses ref:vatin tag if present. */
export function pickNIF(b: BuildingFeature): string | undefined {
  const t = b.rawTags ?? {};
  const raw = t["ref:vatin"] || t["ref:vatin:PT"] || t["ref:VATIN"] || t.nif;
  if (!raw) return undefined;
  // Strip PT prefix if present, keep digits only
  return raw.replace(/^PT/i, "").replace(/\D/g, "") || undefined;
}

/** Build an OSM-derived address string. */
export function pickAddress(b: BuildingFeature): string | undefined {
  const t = b.rawTags ?? {};
  const parts: string[] = [];
  if (t["addr:street"]) {
    parts.push(
      [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" "),
    );
  }
  if (t["addr:postcode"]) parts.push(t["addr:postcode"]);
  if (t["addr:city"] || t["addr:town"] || t["addr:village"]) {
    parts.push(t["addr:city"] || t["addr:town"] || t["addr:village"]);
  }
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/** Returns true if OSM declares solar PV on this building. */
export function hasSolarOnOSM(b: BuildingFeature): boolean {
  const t = b.rawTags ?? {};
  return (
    t["generator:source"] === "solar" ||
    t["roof:material"] === "solar_panels" ||
    t["power"] === "generator" && t["generator:method"] === "photovoltaic"
  );
}

/**
 * Auto-fill an empty lead from OSM tags. NEVER overwrites existing values —
 * the user's manual edits always win. Returns the same lead unchanged when
 * nothing to fill.
 */
export function autoFillLeadFromOSM(b: BuildingFeature, lead: Lead): Lead {
  const out: Lead = { ...lead };
  let changed = false;

  if (!out.company) {
    const v = pickCompany(b);
    if (v) { out.company = v; changed = true; }
  }
  if (!out.website) {
    const v = pickWebsite(b);
    if (v) { out.website = v; changed = true; }
  }
  if (!out.telephone) {
    const v = pickPhone(b);
    if (v) { out.telephone = v; changed = true; }
  }
  if (!out.email) {
    const v = pickEmail(b);
    if (v) { out.email = v; changed = true; }
  }
  if (!out.nif) {
    const v = pickNIF(b);
    if (v) { out.nif = v; changed = true; }
  }
  if (!out.address) {
    const v = pickAddress(b);
    if (v) { out.address = v; changed = true; }
  }
  if (!out.buildingUse && b.inferredUse && b.inferredUse !== "other") {
    out.buildingUse = b.inferredUse;
    changed = true;
  }
  if (out.solarStatus === "unknown" && hasSolarOnOSM(b)) {
    out.solarStatus = "has_panels";
    changed = true;
  }

  if (changed) out.updatedAt = new Date().toISOString();
  return out;
}

/** Display fallback for company when lead has nothing — fall back to building tags. */
export function getDisplayCompany(b: BuildingFeature, lead?: Lead): string {
  return (
    lead?.company ||
    pickCompany(b) ||
    b.name ||
    b.operator ||
    "(sem nome — verificar)"
  );
}

/** Display fallback for website. */
export function getDisplayWebsite(b: BuildingFeature, lead?: Lead): string | undefined {
  return lead?.website || pickWebsite(b);
}

/** Display fallback for telephone. */
export function getDisplayPhone(b: BuildingFeature, lead?: Lead): string | undefined {
  return lead?.telephone || pickPhone(b);
}
