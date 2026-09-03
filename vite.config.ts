import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [preact(), tailwindcss()],
  build: { outDir: "dist" },
  resolve: {
    alias: {
      react: "preact/compat",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
      "react-dom/test-utils": "preact/test-utils",
      // See src/client/lib/jspdf-optional.ts
      canvg: "/src/client/lib/jspdf-optional.ts",
      html2canvas: "/src/client/lib/jspdf-optional.ts",
      dompurify: "/src/client/lib/jspdf-optional.ts",
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
