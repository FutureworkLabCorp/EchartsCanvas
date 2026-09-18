import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Benchmarks are slow by nature and compare against a dev-only dependency, so they stay
// out of the default `pnpm test` run and get their own entry point.
export default defineConfig({
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["bench/**/*.bench.test.ts"],
    testTimeout: 900_000,
  },
});
