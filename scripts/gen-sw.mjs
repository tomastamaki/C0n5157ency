// Genera public/sw.js antes de cada build, con el hash de commit embebido en
// el contenido. Así el archivo cambia de bytes en cada deploy y el navegador
// detecta la actualización por el mecanismo estándar de Service Worker
// (fetch periódico de su propia URL, sin caché HTTP) — ver src/lib/useAppUpdate.ts.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function commitHash() {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

const commit = commitHash();
const buildDate = new Date().toISOString();

const sw = `// Generado automáticamente por scripts/gen-sw.mjs en cada build — no editar a mano.
// Versión: ${commit} · ${buildDate}
// Este service worker no precachea nada a propósito: su único rol es dar
// pie al mecanismo estándar de detección de actualizaciones del navegador
// (el contenido de este archivo cambia en cada build, así que el navegador
// lo nota como "nuevo" y dispara el evento 'updatefound' en la página).
const BUILD_VERSION = ${JSON.stringify(`${commit}-${buildDate}`)};

self.addEventListener("install", () => {
  // No hace falta esperar nada: no hay assets para precachear.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
`;

const outPath = fileURLToPath(new URL("../public/sw.js", import.meta.url));
writeFileSync(outPath, sw);
console.log(`[gen-sw] public/sw.js generado (${commit})`);
