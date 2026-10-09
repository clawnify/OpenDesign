// Canvas fonts, bundled with the app (latin subset) so designs render the same
// wherever the app runs, with no request to a third-party font CDN.
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/playfair-display/latin-400.css";
import "@fontsource/playfair-display/latin-500.css";
import "@fontsource/playfair-display/latin-600.css";
import "@fontsource/playfair-display/latin-700.css";
import "@fontsource/playfair-display/latin-800.css";
import "@fontsource/playfair-display/latin-900.css";
import "@fontsource/montserrat/latin-400.css";
import "@fontsource/montserrat/latin-500.css";
import "@fontsource/montserrat/latin-600.css";
import "@fontsource/montserrat/latin-700.css";
import "@fontsource/montserrat/latin-800.css";
import "@fontsource/montserrat/latin-900.css";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import "@fontsource/roboto/latin-700.css";
import "@fontsource/open-sans/latin-400.css";
import "@fontsource/open-sans/latin-600.css";
import "@fontsource/open-sans/latin-700.css";
import "@fontsource/lora/latin-400.css";
import "@fontsource/lora/latin-700.css";
import "@fontsource/raleway/latin-400.css";
import "@fontsource/raleway/latin-500.css";
import "@fontsource/raleway/latin-600.css";
import "@fontsource/source-sans-pro/latin-400.css";
import "@fontsource/source-sans-pro/latin-600.css";
import "@fontsource/source-sans-pro/latin-700.css";
import "@fontsource/merriweather/latin-400.css";
import "@fontsource/merriweather/latin-700.css";
import { useEffect, useState } from "preact/hooks";
import { api } from "./api";
import type { CustomFont } from "./types";

const FAMILIES: Record<string, number[]> = {
  Inter: [400, 500, 600, 700],
  "Playfair Display": [400, 500, 600, 700, 800, 900],
  Montserrat: [400, 500, 600, 700, 800, 900],
  Poppins: [400, 500, 600, 700],
  Roboto: [400, 500, 700],
  "Open Sans": [400, 600, 700],
  Lora: [400, 700],
  Raleway: [400, 500, 600],
  "Source Sans Pro": [400, 600, 700],
  Merriweather: [400, 700],
};

/** The bundled canvas fonts. Imported fonts are offered alongside these. */
export const FONT_FAMILIES = Object.keys(FAMILIES);

/** Start loading every canvas font. The canvas draws text with whatever is loaded. */
export async function loadFonts(): Promise<void> {
  const pending: Promise<FontFace[]>[] = [];
  for (const [family, weights] of Object.entries(FAMILIES)) {
    for (const weight of weights) {
      pending.push(document.fonts.load(`${weight} 16px "${family}"`));
    }
  }
  await Promise.all(pending);
}

export async function loadCustomFont(font: CustomFont) {
  const face = await new FontFace(font.family, `url("${font.url}")`).load();
  document.fonts.add(face);
}

export async function importCustomFont(file: File): Promise<CustomFont> {
  if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) throw new Error("Choose a TTF, OTF, WOFF or WOFF2 font file.");
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error("Fonts must be between 1 byte and 10 MB.");
  // Decode before saving, so a broken font never enters the shared library.
  let face: FontFace;
  try {
    face = await new FontFace("Custom-preview", await file.arrayBuffer()).load();
  } catch {
    throw new Error("That file could not be decoded as a font.");
  }
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/fonts", { method: "POST", body: form });
  const font = await response.json();
  if (!response.ok) throw new Error(font.error || "Could not save the font.");
  face.family = font.family;
  document.fonts.add(face);
  return font;
}

export function useFonts() {
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [fontsLoading, setFontsLoading] = useState(true);
  const [fontsError, setFontsError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [, fonts] = await Promise.all([loadFonts(), api<CustomFont[]>("GET", "/api/fonts")]);
        // ponytail: preload the library; load by design if large font libraries slow startup.
        // A font that fails to decode is left out rather than blocking the app:
        // the API only checks the file signature, so a corrupt upload can get in.
        const loaded = await Promise.allSettled(fonts.map(loadCustomFont));
        setCustomFonts(fonts.filter((_, i) => loaded[i].status === "fulfilled"));
      } catch {
        setFontsError("Could not load the fonts. Reload to try again.");
      } finally {
        setFontsLoading(false);
      }
    })();
  }, []);

  const importFont = async (file: File) => {
    const font = await importCustomFont(file);
    setCustomFonts((prev) => [...prev, font]);
    return font.family;
  };

  return { customFonts, importFont, fontsLoading, fontsError };
}
