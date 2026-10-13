import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Offline checks only. Everything here runs without a network, a dev server
 * or an API key, so it can gate every PR and every bot commit in CI.
 *
 * The browser checks (flag queue, moves filters) need a running app and live
 * in scripts/e2e-*.mjs instead — `npm run e2e:flags`, `npm run e2e:filters`.
 */
export default defineConfig({
  resolve: {
    // Mirrors tsconfig's "@/*" so tests import the app's real modules.
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
