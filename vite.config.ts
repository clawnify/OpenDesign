import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";

// An absolute file path: dev pre-bundling (esbuild) reads "/src/..." as a path
// from the filesystem root, so a root-relative alias only works in `vite build`.
const jspdfOptional = fileURLToPath(new URL("./src/client/lib/jspdf-optional.ts", import.meta.url));

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
      canvg: jspdfOptional,
      html2canvas: jspdfOptional,
      dompurify: jspdfOptional,
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
