/**
 * CSV cell encoding with formula-injection neutralization.
 *
 * Spreadsheet apps (Excel, Sheets, LibreOffice) execute cell content that starts
 * with = + - @ (or tab/CR) as a formula — a CSV with `=cmd|...` can run commands
 * on open. We prefix a tab so the cell is treated as text, then RFC-4180 quote.
 */
export function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `\t${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
