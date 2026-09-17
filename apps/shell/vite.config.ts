import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves project sites under /<repo>/, so only scope the base path for production builds — the dev server should still serve at /.
export default defineConfig(({ command }) => {
  let base = "/";
  if (command === "build") {
    base = "/os-canvas-engine/";
  }
  return { base, plugins: [react()] };
});
