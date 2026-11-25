import type { Template } from "../types";
import { CanvasPreview } from "./canvas-preview";

interface Props {
  template: Template;
  onClick: () => void;
}

export function TemplateCard({ template, onClick }: Props) {
  return (
    <button
      class="card is-interactive group flex flex-col w-full text-left border-none cursor-pointer p-0"
      onClick={onClick}
    >
      <CanvasPreview json={template.canvas_json} width={template.width} height={template.height} alt={template.name} />
      {/* The name gets two lines before it is cut, so a narrow card shows a
          whole word rather than half of one. */}
      <div class="flex-1 px-2.5 py-2 border-t border-border">
        <span class="text-label text-foreground line-clamp-2 hyphens-auto break-words">{template.name}</span>
        <span class="block mt-0.5 text-fine text-muted tabular-nums">
          {template.width}&times;{template.height}
        </span>
      </div>
    </button>
  );
}
