/**
 * Template fields — named, typed slots on a design.
 *
 * Any Fabric object carrying a `fieldName` becomes a fill point: text objects
 * take a string, image objects take a URL. The name is deliberately not unique.
 * The same name on several objects, or on several pages, fills all of them —
 * that is how a logo or a campaign headline repeats across a carousel.
 *
 * Everything here is plain JSON walking with no Fabric dependency, so it runs
 * on the server (Workers have no canvas) as well as in the browser.
 */

export type FieldType = "text" | "image";

export interface Field {
  name: string;
  type: FieldType;
  /** Current value in the design — the default a caller gets if it fills nothing. */
  value: string;
  /** Every page carrying this field, in page order. */
  page_ids: string[];
}

export interface PageJSON {
  id: string;
  canvas_json: string;
}

export interface FillResult<P extends PageJSON> {
  /** The input pages with values substituted — every other column preserved. */
  pages: P[];
  /** Field names that matched at least one object. */
  filled: string[];
  /** Supplied names that matched nothing — a typo, not an error. */
  unmatched: string[];
}

/** Fabric serializes text as one of three type names depending on the class. */
const TEXT_TYPES = new Set(["text", "i-text", "itext", "textbox"]);

type FabricNode = Record<string, unknown>;

function fieldTypeOf(obj: FabricNode): FieldType | null {
  const type = String(obj.type ?? "").toLowerCase();
  if (TEXT_TYPES.has(type)) return "text";
  if (type === "image") return "image";
  return null;
}

function fieldNameOf(obj: FabricNode): string | null {
  const raw = obj.fieldName;
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  return name.length > 0 ? name : null;
}

/**
 * Visit every object in a parsed canvas, descending into groups.
 *
 * Breadth-first over a growing array rather than recursion, so a deeply nested
 * group can't blow the stack.
 */
function eachObject(canvas: FabricNode, visit: (obj: FabricNode) => void): void {
  const queue: FabricNode[] = Array.isArray(canvas.objects) ? [...(canvas.objects as FabricNode[])] : [];
  for (let i = 0; i < queue.length; i++) {
    const obj = queue[i];
    if (!obj || typeof obj !== "object") continue;
    visit(obj);
    if (Array.isArray(obj.objects)) queue.push(...(obj.objects as FabricNode[]));
  }
}

/** Parse a stored canvas blob. Returns null for the empty/corrupt cases. */
function parseCanvas(canvasJson: string): FabricNode | null {
  try {
    const parsed = JSON.parse(canvasJson || "{}");
    return parsed && typeof parsed === "object" ? (parsed as FabricNode) : null;
  } catch {
    return null;
  }
}

/**
 * The fill schema for a design: one entry per distinct field name.
 *
 * First occurrence wins for `type` and `value`, so a name reused across pages
 * reports the value the author most likely thinks of as canonical.
 */
export function collectFields(pages: PageJSON[]): Field[] {
  const byName = new Map<string, Field>();

  for (const page of pages) {
    const canvas = parseCanvas(page.canvas_json);
    if (!canvas) continue;

    eachObject(canvas, (obj) => {
      const name = fieldNameOf(obj);
      const type = name ? fieldTypeOf(obj) : null;
      if (!name || !type) return;

      const existing = byName.get(name);
      if (existing) {
        if (!existing.page_ids.includes(page.id)) existing.page_ids.push(page.id);
        return;
      }

      const value = type === "text" ? String(obj.text ?? "") : String(obj.src ?? "");
      byName.set(name, { name, type, value, page_ids: [page.id] });
    });
  }

  return [...byName.values()];
}

/**
 * Substitute values into a design's pages without touching the stored copy.
 *
 * The object's own type decides what gets written, not the schema — so a name
 * accidentally shared by a textbox and an image still does the right thing on
 * each. Swapping an image only replaces `src`; the object keeps its stored box,
 * so a replacement of a different aspect ratio will be stretched to fit.
 */
export function fillPages<P extends PageJSON>(pages: P[], values: Record<string, string>): FillResult<P> {
  const filled = new Set<string>();

  const out = pages.map((page) => {
    const canvas = parseCanvas(page.canvas_json);
    if (!canvas) return page;

    let touched = false;
    eachObject(canvas, (obj) => {
      const name = fieldNameOf(obj);
      if (!name || !Object.prototype.hasOwnProperty.call(values, name)) return;

      const type = fieldTypeOf(obj);
      if (!type) return;

      if (type === "text") obj.text = values[name];
      else obj.src = values[name];

      filled.add(name);
      touched = true;
    });

    return touched ? { ...page, canvas_json: JSON.stringify(canvas) } : page;
  });

  return {
    pages: out,
    filled: [...filled],
    unmatched: Object.keys(values).filter((name) => !filled.has(name)),
  };
}
