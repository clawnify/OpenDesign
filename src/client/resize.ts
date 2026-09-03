import * as fabric from "fabric";

export interface Dimensions {
  width: number;
  height: number;
}

// A backdrop has to sit within this fraction of the frame's edge, and reach
// this close to its far edge, to count as covering the canvas.
const COVER_TOLERANCE = 0.02;

function isTextbox(obj: fabric.FabricObject): obj is fabric.Textbox {
  // Fabric capitalises `type` once a canvas has round-tripped through JSON,
  // while hand-written seed templates use the lowercase spelling.
  return obj instanceof fabric.Textbox || String(obj.type).toLowerCase() === "textbox";
}

/**
 * A backdrop is the object a design is built on top of — a template's
 * full-bleed rectangle, or an image added through the background picker.
 * It has to stretch to the new frame rather than scale with the artwork,
 * otherwise resizing to a taller ratio leaves a band of bare canvas.
 */
export function isBackdrop(
  obj: fabric.FabricObject,
  index: number,
  from: Dimensions
): boolean {
  if ((obj as { _isBgImage?: boolean })._isBgImage) return true;
  // Only the bottom-most object can be a backdrop, so a large foreground
  // shape that happens to cover the frame is never mistaken for one.
  if (index !== 0) return false;
  if (obj.angle) return false;
  obj.setCoords();
  const r = obj.getBoundingRect();
  return (
    r.left <= from.width * COVER_TOLERANCE &&
    r.top <= from.height * COVER_TOLERANCE &&
    r.width >= from.width * (1 - COVER_TOLERANCE) &&
    r.height >= from.height * (1 - COVER_TOLERANCE)
  );
}

function stretchToFrame(obj: fabric.FabricObject, to: Dimensions): void {
  obj.set({
    left: 0,
    top: 0,
    scaleX: to.width / (obj.width || 1),
    scaleY: to.height / (obj.height || 1),
  });
  obj.setCoords();
}

function scaleAndReposition(
  obj: fabric.FabricObject,
  from: Dimensions,
  to: Dimensions,
  scale: number
): void {
  const centre = obj.getCenterPoint();
  const next = new fabric.Point(
    to.width / 2 + (centre.x - from.width / 2) * scale,
    to.height / 2 + (centre.y - from.height / 2) * scale
  );

  if (isTextbox(obj)) {
    // Scale the type rather than the transform: the font-size control reads
    // `fontSize` straight off the object, and a wider box has to re-wrap.
    const text = obj as fabric.Textbox;
    text.set({
      fontSize: (text.fontSize || 1) * scale,
      width: (text.width || 1) * scale,
    });
  } else {
    obj.set({
      scaleX: (obj.scaleX || 1) * scale,
      scaleY: (obj.scaleY || 1) * scale,
    });
  }

  obj.setXY(next, "center", "center");
  obj.setCoords();
}

/**
 * Refit every object on a canvas from one frame to another. Artwork scales
 * uniformly by the smaller of the two ratios, so nothing distorts and nothing
 * that fitted before is pushed outside the frame; positions are anchored to
 * the centre so the composition survives a change of aspect ratio.
 */
export function reflowCanvas(
  canvas: fabric.Canvas,
  from: Dimensions,
  to: Dimensions
): void {
  if (from.width === to.width && from.height === to.height) return;
  if (from.width <= 0 || from.height <= 0) return;

  const scale = Math.min(to.width / from.width, to.height / from.height);
  canvas.getObjects().forEach((obj, index) => {
    if (isBackdrop(obj, index, from)) {
      stretchToFrame(obj, to);
    } else {
      scaleAndReposition(obj, from, to, scale);
    }
  });
  canvas.requestRenderAll();
}
