import type { BrandKit, CustomFont } from "../types";
import { serializeKit, parseKitFile } from "./brand";

/**
 * Getting a kit out of one install and into another.
 *
 * Logos are stored as install-relative paths (`/api/uploads/x.png`), which mean
 * nothing anywhere else — export them as-is and the colours and fonts travel
 * while every logo 404s on arrival. So a kit *leaves* with its logos inlined as
 * data URIs, carrying nothing that points back here, and *arrives* by moving
 * those bytes into the receiving install's own storage.
 *
 * Storing the data URI directly would be less code, but it would push the whole
 * logo into every design's canvas JSON. Rehydrating keeps stored values short.
 */

async function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function inlineAsset(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return await blobToDataUrl(await resp.blob());
  } catch {
    return null;
  }
}

async function storeLogo(dataUrl: string): Promise<string | null> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    // The upload route keys the stored file off its extension, so derive one
    // from the MIME type rather than the (absent) original filename.
    const ext = (blob.type.split("/")[1] || "png").replace("svg+xml", "svg");
    const form = new FormData();
    form.append("file", new File([blob], `logo.${ext}`, { type: blob.type }));
    const resp = await fetch("/api/uploads", { method: "POST", body: form });
    const data = await resp.json();
    return typeof data.url === "string" ? data.url : null;
  } catch {
    return null;
  }
}

/**
 * A kit as a portable file. `missing` counts assets that could not be read, so
 * the caller can say so instead of silently shipping an incomplete kit.
 */
export async function exportKit(kit: BrandKit, customFonts: CustomFont[] = []): Promise<{ json: string; missing: number }> {
  const inlined = await Promise.all(kit.logos.map(inlineAsset));
  const logos = inlined.filter((l): l is string => l !== null);
  const families = [...new Set([kit.heading_font, kit.body_font])].filter((f) => f.startsWith("Custom-"));
  const inlinedFonts = await Promise.all(families.map(async (family) => {
    const font = customFonts.find((f) => f.family === family);
    if (!font) return null;
    const data = await inlineAsset(font.url);
    return data ? { family, filename: `${font.name}.${font.url.split(".").pop()}`, data } : null;
  }));
  const fonts = inlinedFonts.filter((font) => font !== null);
  return {
    json: JSON.stringify({ ...serializeKit(kit), logos, fonts }, null, 2),
    missing: kit.logos.length - logos.length + families.length - fonts.length,
  };
}

/**
 * Read a kit file, moving any inlined logo into this install's storage. Returns
 * null when the file is not a kit at all.
 */
export async function importKit(
  raw: string,
  importFont: (file: File) => Promise<string>,
): Promise<{ kit: Omit<BrandKit, "id" | "created_at" | "updated_at">; missing: number } | null> {
  const parsed = parseKitFile(raw);
  if (!parsed) return null;

  const logos: string[] = [];
  let missing = 0;
  const fonts = JSON.parse(raw).fonts;
  if (Array.isArray(fonts)) {
    for (const font of fonts.slice(0, 2)) {
      if (!font || typeof font.family !== "string" || ![parsed.heading_font, parsed.body_font].includes(font.family)) continue;
      try {
        if (typeof font.data !== "string" || !font.data.startsWith("data:") || typeof font.filename !== "string") throw new Error("Invalid font");
        const blob = await (await fetch(font.data)).blob();
        const family = await importFont(new File([blob], font.filename, { type: blob.type }));
        if (parsed.heading_font === font.family) parsed.heading_font = family;
        if (parsed.body_font === font.family) parsed.body_font = family;
      } catch {
        missing++;
      }
    }
  }
  for (const logo of parsed.logos) {
    // A path means the file came from this install, so it already resolves.
    if (!logo.startsWith("data:")) {
      logos.push(logo);
      continue;
    }
    const stored = await storeLogo(logo);
    if (stored) logos.push(stored);
    else missing++;
  }
  return { kit: { ...parsed, logos }, missing };
}
