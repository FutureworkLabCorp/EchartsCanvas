import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// vite.config.ts 는 dev(데모 앱) / build(라이브러리)에 따라 root 가 달라지므로
// 테스트 설정은 별도 파일로 분리해 항상 저장소 루트를 기준으로 실행한다.
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
