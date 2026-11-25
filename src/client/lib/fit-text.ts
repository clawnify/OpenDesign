import type * as fabric from "fabric";

/**
 * Fit a text to a number of lines by shrinking it.
 *
 * A fabric Textbox has a width and no height of its own: its height is
 * whatever its text needs (`initDimensions` sets `height = calcTextHeight()`).
 * So "fits the box" can only mean "fits on so many lines". A text with
 * `maxLines` set is drawn at the largest size, up to the size it was designed
 * at (`fitFontSize`), that keeps it on that many lines. A template filled with
 * a longer value then shrinks instead of wrapping onto a line the layout has
 * no room for.
 *
 * The designed size is kept apart from the drawn one, so a value that gets
 * shorter again grows back. Runs in the browser only: the server has no canvas
 * to measure with, which is fine because every export is drawn here.
 */

type FitText = fabric.Textbox & { maxLines?: number; fitFontSize?: number };

/** Never below this share of the designed size: past it, the text needs editing, not shrinking. */
const MIN_SHARE = 0.4;

function lineCount(t: FitText): number {
  t.initDimensions();
  return t.textLines.length;
}

/** True when the object is a fitted text and was measured. */
export function fitText(obj: fabric.FabricObject): boolean {
  const t = obj as FitText;
  const max = Number(t.maxLines);
  if (!(max >= 1) || typeof t.initDimensions !== "function" || !Array.isArray(t.textLines)) return false;

  const designed = Number(t.fitFontSize) || t.fontSize;
  if (!t.fitFontSize) t.fitFontSize = designed;

  // The text shrinks from wherever its origin is: from the top edge by
  // default, around the middle when the object's originY is "center". Nothing
  // else is stored, so fitting again always lands in the same place. (Keeping
  // the middle by moving `top` was tried and dropped: measured after a fill,
  // the box is the long text already wrapped, so the line jumped down.)
  t.set({ fontSize: designed });
  if (lineCount(t) <= max) return true;

  // The largest size that fits, by halving the gap: a handful of measures, not one per pixel.
  let lo = Math.max(6, Math.floor(designed * MIN_SHARE));
  let hi = designed;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    t.set({ fontSize: mid });
    if (lineCount(t) <= max) lo = mid;
    else hi = mid;
  }
  t.set({ fontSize: lo });
  t.initDimensions();
  t.setCoords();
  return true;
}

/** Fit every fitted text on a canvas, groups included. */
export function fitAll(canvas: fabric.StaticCanvas): void {
  const queue = [...canvas.getObjects()];
  let changed = false;
  for (let i = 0; i < queue.length; i++) {
    const o = queue[i] as fabric.FabricObject & { _objects?: fabric.FabricObject[] };
    if (fitText(o)) changed = true;
    if (Array.isArray(o._objects)) queue.push(...o._objects);
  }
  if (changed) canvas.requestRenderAll();
}
