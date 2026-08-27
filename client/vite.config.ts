import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Precache do app shell (JS/CSS/HTML) — sem isso, abrir o app offline sem
    // visita prévia (ou reload numa aba deep-linked) falha com
    // net::ERR_INTERNET_DISCONNECTED, porque não tem nada servindo o HTML/JS
    // localmente. Não mexe em /api/* — dado offline continua 100% por conta
    // da fundação (IndexedDB + fila), ver docs/design/offline/OFFLINE_STRATEGY.md.
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 41875,
    proxy: {
      "/api": "http://localhost:41873",
    },
  },
});
