import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function commitHash(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

// Base path debe coincidir con el nombre del repo para GitHub Pages
// (https://tomastamaki.github.io/C0n5157ency/).
export default defineConfig({
  plugins: [react()],
  base: "/C0n5157ency/",
  define: {
    // Para mostrar qué versión corre en cada dispositivo (Ajustes) — ver src/vite-env.d.ts.
    __APP_COMMIT__: JSON.stringify(commitHash()),
    __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
});
