import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { createMcpMiddleware } from "./demo/dev-mcp-proxy";

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
  plugins: [
    react(),
    // Dev only. Signs in server-side and forwards /mcpapi/* with the resulting headers,
    // so no credential is ever present in the browser.
    {
      name: "viz-kit:mcp-dev-auth",
      apply: "serve" as const,
      configureServer(server: {
        middlewares: { use: (handler: unknown) => void };
      }) {
        const env = loadEnv(mode, import.meta.dirname, "");
        server.middlewares.use(
          createMcpMiddleware({
            apiTarget:
              env.VITE_DEV_API_PROXY_TARGET ??
              "https://ncpapidev.linkbrain.ai.kr",
            mcpTarget:
              env.VITE_MCP_API_PROXY_TARGET ??
              "https://ncpapidev.linkbrain.ai.kr",
            email: env.MCP_DEMO_EMAIL ?? "",
            password: env.MCP_DEMO_PASSWORD ?? "",
            orgUuid: env.MCP_DEMO_ORG_UUID ?? "",
          }),
        );
      },
    },
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
