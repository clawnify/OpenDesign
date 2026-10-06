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
    // wrangler dev keeps the local D1/R2 state in .wrangler/ inside this root.
    // Without this, every save writes the SQLite WAL, vite reloads the page,
    // and the editor loses its selection and any half-typed edit.
    watch: { ignored: ["**/.wrangler/**"] },
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
