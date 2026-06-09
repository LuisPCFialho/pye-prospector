import { defineConfig } from "vitest/config";

// Standalone test config — pure unit tests for the core engines (packing,
// finance, validation, exports). Node environment; no DOM/Tauri needed.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
