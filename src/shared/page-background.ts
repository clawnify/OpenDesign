export const WHITE_BACKGROUND = "#ffffff";

type Frame = { width: number; height: number };

/** Starter templates and older uploaded backgrounds use a frame-sized bottom layer. */
function fillsFrame(layer: Record<string, unknown>, frame: Frame) {
  return (layer.left ?? 0) === 0 && (layer.top ?? 0) === 0 &&
    (layer.originX ?? "left") === "left" && (layer.originY ?? "top") === "top" &&
    !layer.angle && !layer.skewX && !layer.skewY &&
    Math.abs(Number(layer.width) * Number(layer.scaleX ?? 1) - frame.width) < 1 &&
    Math.abs(Number(layer.height) * Number(layer.scaleY ?? 1) - frame.height) < 1;
}

export function newPageCanvas(previous?: string, frame?: Frame): string {
  const source = JSON.parse(previous || "{}");
  const bottom = source.objects?.[0];
  const type = String(bottom?.type).toLowerCase();
  const objects = [];
  let background = source.background || WHITE_BACKGROUND;
  const frameLayer = bottom && !bottom.fieldName && frame &&
    (type === "rect" || type === "image") && fillsFrame(bottom, frame);
  if (bottom?._isBgImage || frameLayer) {
    // A plain opaque template rectangle can become an editable page color.
    if (type === "rect" && /^#[0-9a-f]{6}$/i.test(bottom.fill) && (bottom.opacity ?? 1) === 1 &&
        bottom.visible !== false && !bottom.stroke && !bottom.rx && !bottom.ry && !bottom.clipPath && !bottom.shadow &&
        !source.backgroundImage && (!bottom.globalCompositeOperation || bottom.globalCompositeOperation === "source-over")) {
      background = bottom.fill;
    } else {
      const { layerId, fieldName, ...backdrop } = bottom;
      if (type === "image") Object.assign(backdrop, { _isBgImage: true, selectable: false, evented: false });
      objects.push(backdrop);
    }
  }
  return JSON.stringify({ background, backgroundImage: source.backgroundImage, objects });
}
