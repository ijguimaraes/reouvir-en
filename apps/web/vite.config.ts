import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/sw",
      filename: "sw.ts",
      registerType: "autoUpdate",
      manifest: {
        name: "Reouvir EN",
        short_name: "Reouvir",
        description: "Treino de escuta em inglês. Hear it again.",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#3b5bdb",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      injectManifest: { globPatterns: ["**/*.{js,css,html,png,svg}"] },
    }),
  ],
  server: {
    port: 5273,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3711",
      "/audio": "http://localhost:3711",
    },
  },
});
