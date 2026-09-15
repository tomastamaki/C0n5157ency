import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Base path debe coincidir con el nombre del repo para GitHub Pages
// (https://tomastamaki.github.io/C0n5157ency/).
export default defineConfig({
  plugins: [react()],
  base: "/C0n5157ency/",
});
