import { defineConfig } from "vitest/config";

// Config separada de vite.config.ts: los módulos bajo test (src/lib/**) son
// TS puro sin DOM, así que no hace falta el plugin de React ni jsdom.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
