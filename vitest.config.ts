import { defineConfig } from "vitest/config";

// Standalone test config. Most tests run in node; tests that need localStorage
// (safeLocalStorage) are annotated with @vitest-environment jsdom inline.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    environmentOptions: {},
  },
});
