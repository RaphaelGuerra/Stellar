import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("html2canvas")) return "vendor-html2canvas";
          if (id.includes("jspdf")) return "vendor-jspdf";
          if (id.includes("@swisseph/browser")) return "vendor-swisseph";
          if (id.includes("react-dom") || id.includes("/react/")) return "vendor-react";
          if (id.includes("astronomy-engine")) return "vendor-astronomy";
          return undefined;
        },
      },
    },
  },
  worker: {
    format: "es",
  },
})
