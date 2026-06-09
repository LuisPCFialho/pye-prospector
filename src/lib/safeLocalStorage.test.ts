// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { safeLocalStorage } from "./safeLocalStorage";

describe("safeLocalStorage", () => {
  it("get returns fallback when key absent", () => {
    expect(safeLocalStorage.get("__no_such_key__", "default")).toBe("default");
  });

  it("set then get round-trips a value", () => {
    safeLocalStorage.set("__test_key__", "hello");
    expect(safeLocalStorage.get("__test_key__")).toBe("hello");
  });

  it("remove clears a key", () => {
    safeLocalStorage.set("__rm_key__", "gone");
    safeLocalStorage.remove("__rm_key__");
    expect(safeLocalStorage.get("__rm_key__", "absent")).toBe("absent");
  });
});
