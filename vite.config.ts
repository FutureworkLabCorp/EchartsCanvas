import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

// Storybook's builder runs Vite in build mode against this same config, so `command`
// alone cannot tell a library build from a Storybook build. Storybook sets this.
const isStorybook = process.env["STORYBOOK"] === "true";

// One config serves two roots: `pnpm dev` boots the demo app from demo/index.html,
// `pnpm build` emits the library bundle from src/index.ts.
export default defineConfig(({ command, mode }) => ({
  root:
    command === "serve"
      ? resolve(import.meta.dirname, "demo")
      : import.meta.dirname,
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  server: {
    proxy: {
      // Same-origin for the browser, so the demo issues no cross-origin request and the
      // host needs no CORS grant. The path passes through unrewritten: the MCP host
      // serves these tools under /mcpapi itself. Auth rides on the demo's headers.
      // Only the dev server does this; the published library never reaches the network.
      "/mcpapi": {
        target:
          loadEnv(mode, import.meta.dirname, "").VITE_MCP_API_PROXY_TARGET ||
          "https://ncpapidev.linkbrain.ai.kr",
        changeOrigin: true,
        secure: true,
      },
    },
  },
  plugins: [
    react(),
    ...(command === "build" && !isStorybook
      ? [dts({ include: ["src"], insertTypesEntry: true })]
      : []),
  ],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      name: "AxVizKit",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
      // Pinned because Vite names the lib stylesheet after the package by default,
      // which would move the "./styles.css" export target on any rename.
      cssFileName: "style",
    },
    sourcemap: true,
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
  },
}));
