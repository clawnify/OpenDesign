/**
 * Replacing part of a styled text without moving its styles onto the wrong
 * characters.
 *
 * Fabric stores the per-character styles of a text object as ranges:
 * `[{ start, end, style }]`, counted in graphemes over the whole text with the
 * line breaks left out (fabric's own `stylesToArray`, dist/index.mjs, v6.9).
 * Hand-written JSON may still use the older `{ line: { char: style } }` form,
 * which fabric reads as well. Swapping `text` and leaving `styles` alone keeps
 * every range at its old position, so a highlight ends up on whatever
 * characters now sit there.
 *
 * Here the text becomes a list of characters, each carrying its own style, the
 * replacement happens on that list, and the ranges are rebuilt from it. A
 * replacement takes the style of the first character it replaces, which is
 * what a person means when they colour a `{{name}}` blue: the value is blue.
 *
 * Plain JSON and Intl.Segmenter only, so it runs on the server (Workers have
 * no canvas) and in the browser alike.
 */

export type Style = Record<string, unknown>;
export interface StyleRange {
  start: number;
  end: number;
  style: Style;
}
type ObjectStyles = Record<string, Record<string, Style>>;

/** One character of a text: a grapheme with its style, or a line break. */
interface Char {
  ch: string;
  style: Style | null;
  newline: boolean;
}

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null;

/** Graphemes as fabric counts them: user-perceived characters, not UTF-16 units. */
export function graphemes(s: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(s), (x) => x.segment);
  return Array.from(s);
}

function hasStyle(s: unknown): s is Style {
  return Boolean(s && typeof s === "object" && Object.keys(s as object).length > 0);
}

/** Lines split the way fabric splits them, so indices agree with it. */
function toChars(text: string, styles: unknown): Char[] {
  const lines = text.split("\n");
  const chars: Char[] = [];
  const ranges = Array.isArray(styles) ? (styles as StyleRange[]) : null;
  const byLine = !ranges && styles && typeof styles === "object" ? (styles as ObjectStyles) : null;

  let index = 0;
  lines.forEach((line, l) => {
    if (l > 0) chars.push({ ch: "\n", style: null, newline: true });
    graphemes(line).forEach((ch, c) => {
      let style: Style | null = null;
      if (ranges) {
        const range = ranges.find((r) => r.start <= index && index < r.end);
        if (range && hasStyle(range.style)) style = { ...range.style };
      } else if (byLine) {
        const s = byLine[l]?.[c];
        if (hasStyle(s)) style = { ...s };
      }
      chars.push({ ch, style, newline: false });
      index++;
    });
  });
  return chars;
}

function sameStyle(a: Style | null, b: Style | null): boolean {
  if (!a || !b) return a === b;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
}

function fromChars(chars: Char[]): { text: string; styles: StyleRange[] } {
  const ranges: StyleRange[] = [];
  let index = 0;
  let prev: Style | null = null;
  for (const c of chars) {
    if (c.newline) continue;
    if (c.style) {
      const last = ranges[ranges.length - 1];
      if (last && last.end === index && sameStyle(prev, c.style)) last.end++;
      else ranges.push({ start: index, end: index + 1, style: { ...c.style } });
    }
    prev = c.style;
    index++;
  }
  return { text: chars.map((c) => c.ch).join(""), styles: ranges };
}

function charsOf(value: string, style: Style | null): Char[] {
  const out: Char[] = [];
  value.split("\n").forEach((line, l) => {
    if (l > 0) out.push({ ch: "\n", style: null, newline: true });
    for (const ch of graphemes(line)) out.push({ ch, style: style ? { ...style } : null, newline: false });
  });
  return out;
}

/**
 * `{{name}}`, `{{ name }}`, `{{client.name}}`: the grammar OpenSlides uses, so
 * one habit works in both apps. Never across a line break.
 */
export const TOKEN_RE = /\{\{[ \t]*([A-Za-z_][A-Za-z0-9_.]*)[ \t]*\}\}/g;

/** The variable names a text carries, in order of first appearance. */
export function tokensIn(text: string): string[] {
  const names: string[] = [];
  for (const m of text.matchAll(TOKEN_RE)) if (!names.includes(m[1])) names.push(m[1]);
  return names;
}

/**
 * Replace each `{{name}}` that has a value. A token with no value is left as
 * written, so a missing value shows instead of vanishing.
 */
export function fillTokens(
  text: string,
  styles: unknown,
  values: Record<string, string>,
): { text: string; styles: StyleRange[]; filled: string[] } | null {
  const matches = [...text.matchAll(TOKEN_RE)].filter((m) => Object.prototype.hasOwnProperty.call(values, m[1]));
  if (matches.length === 0) return null;

  const chars = toChars(text, styles);
  // UTF-16 offset of each char's start, to place the regex matches on the list.
  const offsets: number[] = [];
  let at = 0;
  for (const c of chars) {
    offsets.push(at);
    at += c.ch.length;
  }
  // The first char starting at or after an offset: a mark that combines with
  // the closing brace stays part of the token it closes.
  const charAt = (offset: number) => {
    const i = offsets.findIndex((o) => o >= offset);
    return i === -1 ? chars.length : i;
  };

  const filled: string[] = [];
  // From the end, so earlier matches keep their positions.
  for (const m of matches.reverse()) {
    const from = charAt(m.index!);
    const to = charAt(m.index! + m[0].length);
    const style = chars[from]?.style ?? null;
    chars.splice(from, to - from, ...charsOf(values[m[1]], style));
    if (!filled.includes(m[1])) filled.push(m[1]);
  }
  return { ...fromChars(chars), filled };
}

/** Replace the whole text, which takes the style of its first character. */
export function replaceText(text: string, styles: unknown, value: string): { text: string; styles: StyleRange[] } {
  const first = toChars(text, styles).find((c) => !c.newline)?.style ?? null;
  return fromChars(charsOf(value, first));
}
