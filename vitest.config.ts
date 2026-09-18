import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts because that one switches `root` between the demo
// app and the library, so tests would resolve against whichever mode happened to load.
export default defineConfig({
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "demo/**/*.test.{ts,tsx}"],
  },
});
