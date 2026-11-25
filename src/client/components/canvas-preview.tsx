import { useEffect, useState } from "preact/hooks";
import * as fabric from "fabric";
import { fitAll } from "../lib/fit-text";

interface Props {
  /** A page's saved canvas JSON. */
  json: string;
  width: number;
  height: number;
  alt: string;
}

/**
 * A design or template drawn as an image, inside a square frame so cards of
 * different page shapes line up in a grid: a landscape page sits letterboxed
 * instead of making its card shorter than its neighbours.
 */
export function CanvasPreview({ json, width, height, alt }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json || "{}");
    } catch {
      return;
    }
    let live = true;
    const el = document.createElement("canvas");
    const canvas = new fabric.StaticCanvas(el, { width, height });
    canvas
      .loadFromJSON(parsed as Record<string, unknown>)
      .then(() => {
        if (!live) return;
        fitAll(canvas);
        canvas.renderAll();
        // 400px on the long side: crisp on a retina display, light to hold.
        const multiplier = Math.min(400 / width, 400 / height, 1);
        setSrc(canvas.toDataURL({ format: "png", multiplier }));
      })
      .catch(() => {})
      .finally(() => canvas.dispose());
    return () => {
      live = false;
    };
  }, [json, width, height]);

  return (
    <div class="aspect-square w-full flex items-center justify-center bg-surface-sunken overflow-hidden">
      {src && <img src={src} alt={alt} class="max-w-full max-h-full object-contain" />}
    </div>
  );
}
