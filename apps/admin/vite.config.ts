import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/admin/",
  plugins: [react()],
  server: {
    port: 5274,
    strictPort: true,
    proxy: { "/api": "http://localhost:3711" },
  },
});
