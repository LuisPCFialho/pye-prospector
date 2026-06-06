/**
 * Input validation + normalization helpers for lead data entry.
 * Used at the system boundary (before saving) to keep bad data out of the DB.
 */

/** Validate a Portuguese NIF (9 digits, valid check digit). */
export function isValidNif(nif: string): boolean {
  const n = nif.replace(/\s/g, "");
  if (!/^\d{9}$/.test(n)) return false;
  // First digit must be a valid NIF prefix
  if (!"125689".includes(n[0])) {
    // 3 and 45 etc. also valid in some cases; be lenient but reject obvious garbage
    if (!["3", "4", "7"].includes(n[0])) return false;
  }
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(n[i]) * (9 - i);
  const mod = sum % 11;
  const check = mod < 2 ? 0 : 11 - mod;
  return check === Number(n[8]);
}

/** Lightly validate an email address. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Normalize a website to a fully-qualified https URL, or return null if junk. */
export function normalizeWebsite(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withProto);
    if (!u.hostname.includes(".")) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** Trim + collapse whitespace; return null if empty after cleaning. */
export function cleanString(raw: string, maxLen = 200): string | null {
  const v = raw.trim().replace(/\s+/g, " ").slice(0, maxLen);
  return v.length > 0 ? v : null;
}

/** Normalize a phone: keep digits, +, spaces, parens, dashes. */
export function cleanPhone(raw: string): string | null {
  const v = raw.trim().replace(/[^\d+()\s-]/g, "").trim();
  return v.length >= 6 ? v : null;
}

/** Clamp a number into a sane range; returns 0 for NaN. */
export function clampNumber(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(min, Math.min(max, v));
}

/**
 * Validate + normalize a single lead field. Returns the cleaned value, or an
 * { error } if invalid. Empty input clears the field (returns null value).
 */
export function validateField(
  field: string,
  raw: string,
): { value: string | undefined } | { error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: undefined };

  switch (field) {
    case "nif": {
      const digits = trimmed.replace(/\D/g, "");
      if (!/^\d{9}$/.test(digits)) return { error: "NIF deve ter 9 dígitos" };
      return { value: digits };
    }
    case "email":
      if (!isValidEmail(trimmed)) return { error: "Email inválido" };
      return { value: trimmed };
    case "website": {
      const norm = normalizeWebsite(trimmed);
      if (!norm) return { error: "Website inválido" };
      return { value: norm };
    }
    case "telephone": {
      const phone = cleanPhone(trimmed);
      if (!phone) return { error: "Telefone inválido" };
      return { value: phone };
    }
    default: {
      const clean = cleanString(trimmed);
      return { value: clean ?? undefined };
    }
  }
}
