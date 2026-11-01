import { copyFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const base = process.env.GITHUB_PAGES === "true" ? "/WOP/" : "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["config.json", "icons/*.png"],
      manifest: {
        name: "Workout Planner",
        short_name: "Workout",
        description: "Personal workout planner. Videos play from your OneDrive.",
        theme_color: "#0c0f12",
        background_color: "#0c0f12",
        display: "standalone",
        orientation: "portrait",
        start_url: base,
        scope: base,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,png,svg,json,ico,webmanifest}"],
      },
    }),
    {
      name: "github-pages-spa-fallback",
      closeBundle() {
        try {
          copyFileSync("dist/index.html", "dist/404.html");
        } catch {
          /* dist may not exist during tests */
        }
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: [".", "/tmp"] },
  },
});
