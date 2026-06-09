import { describe, it, expect } from "vitest";
import { createRateLimiter } from "./fetchUtils";

describe("createRateLimiter", () => {
  it("runs tasks serially in submission order", async () => {
    const limit = createRateLimiter(10);
    const order: number[] = [];
    await Promise.all([1, 2, 3].map((n) => limit(async () => { order.push(n); })));
    expect(order).toEqual([1, 2, 3]);
  });

  it("enforces a minimum interval between calls", async () => {
    const interval = 40;
    const limit = createRateLimiter(interval);
    const stamps: number[] = [];
    await Promise.all(
      [0, 1, 2].map(() => limit(async () => { stamps.push(performance.now()); })),
    );
    // Gaps between consecutive starts must be at least ~the interval (with slack)
    for (let i = 1; i < stamps.length; i++) {
      expect(stamps[i] - stamps[i - 1]).toBeGreaterThanOrEqual(interval * 0.7);
    }
  });

  it("keeps the queue alive after a task rejects", async () => {
    const limit = createRateLimiter(5);
    const ran: string[] = [];
    const failing = limit(async () => { throw new Error("boom"); });
    await expect(failing).rejects.toThrow("boom");
    await limit(async () => { ran.push("after"); });
    expect(ran).toEqual(["after"]);
  });

  it("returns each task's resolved value", async () => {
    const limit = createRateLimiter(1);
    const a = await limit(async () => 42);
    const b = await limit(async () => "ok");
    expect(a).toBe(42);
    expect(b).toBe("ok");
  });
});
