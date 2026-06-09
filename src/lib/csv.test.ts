import { describe, it, expect } from "vitest";
import { csvCell } from "./csv";

describe("csvCell — formula-injection neutralization", () => {
  it("prefixes a tab on cells starting with a formula trigger", () => {
    expect(csvCell("=1+1")).toBe('"\t=1+1"');
    expect(csvCell("=cmd|'/c calc'!A0")).toBe('"\t=cmd|\'/c calc\'!A0"');
    expect(csvCell("+1")).toBe('"\t+1"');
    expect(csvCell("-1")).toBe('"\t-1"');
    expect(csvCell("@SUM(A1)")).toBe('"\t@SUM(A1)"');
  });

  it("does not alter ordinary text", () => {
    expect(csvCell("Empresa XPTO")).toBe('"Empresa XPTO"');
    expect(csvCell("123 Main St")).toBe('"123 Main St"');
  });

  it("RFC-4180 escapes embedded quotes", () => {
    expect(csvCell('a"b')).toBe('"a""b"');
  });

  it("renders null/undefined as an empty quoted cell", () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });

  it("guards phone numbers that begin with +", () => {
    expect(csvCell("+351912345678")).toBe('"\t+351912345678"');
  });
});
