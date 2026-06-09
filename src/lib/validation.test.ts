import { describe, it, expect } from "vitest";
import {
  isValidNif, isValidEmail, normalizeWebsite, cleanString, cleanPhone,
  clampNumber, validateField,
} from "./validation";

describe("isValidNif", () => {
  it("accepts a NIF with a correct check digit", () => {
    expect(isValidNif("123456789")).toBe(true); // check digit 9 is correct
  });
  it("rejects a wrong check digit", () => {
    expect(isValidNif("123456788")).toBe(false);
  });
  it("rejects non-9-digit input", () => {
    expect(isValidNif("12345678")).toBe(false);
    expect(isValidNif("1234567890")).toBe(false);
    expect(isValidNif("abcdefghi")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("accepts a normal address", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
  });
  it("rejects missing parts", () => {
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
  });
});

describe("normalizeWebsite", () => {
  it("prepends https when missing", () => {
    expect(normalizeWebsite("example.com")).toBe("https://example.com");
  });
  it("strips a trailing slash but keeps the scheme", () => {
    expect(normalizeWebsite("http://x.org/")).toBe("http://x.org");
  });
  it("rejects junk with no dot in the host", () => {
    expect(normalizeWebsite("nodot")).toBeNull();
    expect(normalizeWebsite("")).toBeNull();
  });
});

describe("cleanString / cleanPhone", () => {
  it("collapses whitespace and truncates", () => {
    expect(cleanString("  a   b  ")).toBe("a b");
    expect(cleanString("")).toBeNull();
    expect(cleanString("abcdef", 3)).toBe("abc");
  });
  it("keeps phone punctuation and rejects too-short input", () => {
    expect(cleanPhone("+351 912 345 678")).toBe("+351 912 345 678");
    expect(cleanPhone("abc")).toBeNull();
    expect(cleanPhone("12345")).toBeNull();
  });
});

describe("clampNumber", () => {
  it("clamps into range and zeroes NaN", () => {
    expect(clampNumber(5, 0, 10)).toBe(5);
    expect(clampNumber(-3, 0, 10)).toBe(0);
    expect(clampNumber(20, 0, 10)).toBe(10);
    expect(clampNumber(NaN, 0, 10)).toBe(0);
  });
});

describe("validateField", () => {
  it("clears the field on empty input", () => {
    expect(validateField("name", "")).toEqual({ value: undefined });
  });
  it("validates and normalizes by field type", () => {
    expect(validateField("email", "x@y.com")).toEqual({ value: "x@y.com" });
    expect(validateField("email", "bad")).toHaveProperty("error");
    expect(validateField("nif", "123456789")).toEqual({ value: "123456789" });
    expect(validateField("nif", "123")).toHaveProperty("error");
    expect(validateField("website", "example.com")).toEqual({ value: "https://example.com" });
  });
});
