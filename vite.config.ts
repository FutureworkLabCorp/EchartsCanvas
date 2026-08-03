import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

// 라이브러리 빌드(dist) + 데모 앱(dev server)을 동시에 지원하는 설정.
// `pnpm dev`  → demo/index.html 기반 개발 서버
// `pnpm build` → src/index.ts 기반 라이브러리 번들(ESM/CJS + d.ts)
export default defineConfig(({ command }) => ({
  root: command === "serve" ? resolve(__dirname, "demo") : __dirname,
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  plugins: [
    react(),
    ...(command === "build"
      ? [dts({ include: ["src"], rollupTypes: false, insertTypesEntry: true })]
      : []),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "AxVizKit",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
    },
    cssFileName: "viz-kit",
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
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
}));
