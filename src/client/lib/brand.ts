import type { BrandKit } from "../types";

/**
 * Recoloring a finished design to a brand palette by "nearest colour" is the
 * obvious approach and the wrong one: a dark background and its white heading
 * can both land on the same swatch, and the design becomes unreadable.
 *
 * So we map by *rank in luminance* instead. Sort the design's distinct colours
 * darkest-to-lightest, sort the brand's the same way, and map position to
 * position. The darkest thing in the design stays the darkest thing in the
 * design; contrast survives even when the palettes look nothing alike.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHex(v: unknown): v is string {
  return typeof v === "string" && HEX.test(v);
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relative luminance, WCAG definition. */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Build a lookup from every colour used in a design to a brand colour,
 * preserving light/dark order. Returns an empty map when there is nothing
 * sensible to map (no brand colours, or no colours in the design).
 */
export function buildColorMap(designColors: string[], brandColors: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const brand = [...new Set(brandColors.filter(isHex))].sort((a, b) => luminance(a) - luminance(b));
  const source = [...new Set(designColors.filter(isHex))].sort((a, b) => luminance(a) - luminance(b));
  if (brand.length === 0 || source.length === 0) return map;

  source.forEach((color, i) => {
    // Single-colour source maps to the mid brand colour rather than the darkest.
    const ratio = source.length === 1 ? 0.5 : i / (source.length - 1);
    map.set(color.toLowerCase(), brand[Math.round(ratio * (brand.length - 1))]);
  });
  return map;
}

/**
 * Which brand font a text object should take. Mirrors the editor's own presets
 * (heading 48 / subheading 32 / body 18) so "Add a heading" and a heading in a
 * template are treated the same way.
 */
export function brandFontFor(fontSize: number, kit: BrandKit): string {
  return fontSize >= 32 ? kit.heading_font : kit.body_font;
}

/** The kit as it is written to disk by "Export kit". */
export function serializeKit(kit: BrandKit) {
  return {
    opendesign_brand_kit: 1,
    name: kit.name,
    colors: kit.colors,
    heading_font: kit.heading_font,
    body_font: kit.body_font,
    logos: kit.logos,
  };
}

/**
 * Read a kit file back. Returns null rather than throwing so the caller can
 * show one honest "that is not a brand kit file" message.
 */
export function parseKitFile(raw: string): Omit<BrandKit, "id" | "created_at" | "updated_at"> | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.name !== "string" || !d.name.trim()) return null;

  const colors = Array.isArray(d.colors) ? d.colors.filter(isHex).slice(0, 24) : [];
  const logos = Array.isArray(d.logos)
    ? d.logos.filter((l): l is string => typeof l === "string").slice(0, 12)
    : [];

  return {
    name: d.name.slice(0, 80),
    colors,
    logos,
    heading_font: typeof d.heading_font === "string" && d.heading_font ? d.heading_font : "Montserrat",
    body_font: typeof d.body_font === "string" && d.body_font ? d.body_font : "Inter",
  };
}
