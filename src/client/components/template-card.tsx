import { useState, useEffect, useRef } from "preact/hooks";
import { fitAll } from "../lib/fit-text";
import * as fabric from "fabric";
import type { Template } from "../types";

interface Props {
  template: Template;
  onClick: () => void;
}

export function TemplateCard({ template, onClick }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const rendered = useRef(false);

  useEffect(() => {
    if (rendered.current) return;
    rendered.current = true;

    const el = document.createElement("canvas");
    const tempCanvas = new fabric.StaticCanvas(el, {
      width: template.width,
      height: template.height,
    });

    try {
      const parsed = JSON.parse(template.canvas_json);
      tempCanvas.loadFromJSON(parsed).then(() => {
        fitAll(tempCanvas);
        tempCanvas.renderAll();
        // Render at 400px wide for crisp retina thumbnails
        const targetPx = 400;
        const multiplier = Math.min(targetPx / template.width, targetPx / template.height, 1);
        const dataUrl = tempCanvas.toDataURL({
          format: "png",
          multiplier,
        });
        setPreview(dataUrl);
        tempCanvas.dispose();
      });
    } catch {
      tempCanvas.dispose();
    }
  }, [template]);

  return (
    <button
      class="group relative bg-white border border-zinc-200 rounded-lg overflow-hidden cursor-pointer transition-all hover:border-accent hover:shadow-lg hover:shadow-accent/10 p-0"
      onClick={onClick}
    >
      {/* Preview area */}
      <div
        class="w-full flex items-center justify-center bg-zinc-50 overflow-hidden"
        style={{ aspectRatio: `${template.width} / ${template.height}` }}
      >
        {preview ? (
          <img
            src={preview}
            alt={template.name}
            class="w-full h-full object-contain"
          />
        ) : (
          <span class="text-zinc-300 text-[10px] font-medium">Loading...</span>
        )}
      </div>
      {/* Label */}
      <div class="px-2 py-1.5 border-t border-zinc-200">
        <span class="text-[10px] text-zinc-600 font-medium truncate block">
          {template.name}
        </span>
        <span class="text-[9px] text-zinc-400">
          {template.width}&times;{template.height}
        </span>
      </div>
    </button>
  );
}
