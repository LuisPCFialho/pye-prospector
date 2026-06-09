import { describe, it, expect } from "vitest";
import {
  sanitizeUrl, googleMapsUrl, streetViewUrl, googleVerifyUrl, directionsUrl,
} from "./openExternal";

describe("sanitizeUrl — scheme allow-list (command-injection guard)", () => {
  it("rejects dangerous schemes", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeUrl("file:///etc/passwd")).toBeNull();
    expect(sanitizeUrl("data:text/html,<script>")).toBeNull();
    expect(sanitizeUrl("httpx://evil")).toBeNull();
  });

  it("accepts http/https and normalizes bare hosts to https", () => {
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com/");
    expect(sanitizeUrl("http://x.org/p")).toBe("http://x.org/p");
    expect(sanitizeUrl("example.com")).toBe("https://example.com/");
  });

  it("returns null for malformed input", () => {
    expect(sanitizeUrl("")).toBeNull();
    expect(sanitizeUrl("   ")).toBeNull();
  });
});

describe("Google Maps URL builders (api=1, no key)", () => {
  const lat = 38.7223, lon = -9.1393;
  it("encodes the comma as %2C and targets satellite", () => {
    const u = googleMapsUrl(lat, lon);
    expect(u).toContain("%2C");
    expect(u).toContain("basemap=satellite");
    expect(u).toContain(`${lat}%2C${lon}`);
  });
  it("street view uses the pano action", () => {
    expect(streetViewUrl(lat, lon)).toContain("map_action=pano");
  });
  it("verify URL uses the company name when provided", () => {
    expect(googleVerifyUrl(lat, lon, "Acme Lda")).toContain("Acme%20Lda");
  });
  it("verify URL falls back to coordinates without a name", () => {
    const u = googleVerifyUrl(lat, lon);
    expect(u).toContain(`${lat}%2C${lon}`);
  });
  it("directions target driving mode", () => {
    expect(directionsUrl(lat, lon)).toContain("travelmode=driving");
  });
});
