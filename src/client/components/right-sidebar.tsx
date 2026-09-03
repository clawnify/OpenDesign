import { useState, useEffect } from "preact/hooks";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  FlipHorizontal,
  FlipVertical,
  Trash2,
  Copy,
} from "lucide-preact";
import * as fabric from "fabric";
import { useEditor } from "../context";

const FONT_FAMILIES = [
  "Inter",
  "Playfair Display",
  "Montserrat",
  "Poppins",
  "Roboto",
  "Open Sans",
  "Lora",
  "Raleway",
  "Source Sans Pro",
  "Merriweather",
];

/**
 * Names an object so `/api/designs/:id/fields` publishes it and
 * `/api/designs/:id/fill` can write to it. Committed on blur rather than per
 * keystroke, so naming a field costs one undo step instead of one per letter.
 */
function FieldNameInput({
  object,
  onCommit,
}: {
  object: fabric.FabricObject;
  onCommit: (name: string) => void;
}) {
  const saved = ((object as any).fieldName as string) || "";
  const [draft, setDraft] = useState(saved);

  // Re-seed when the selection moves to a different object.
  useEffect(() => setDraft(saved), [object]);

  const commit = () => {
    const next = draft.trim();
    if (next !== saved) onCommit(next);
    setDraft(next);
  };

  return (
    <div>
      <label class="text-[11px] text-zinc-400 mb-1 block">Field name</label>
      <input
        type="text"
        placeholder="e.g. headline"
        class="w-full bg-white border border-zinc-300 rounded-md text-xs text-zinc-700 px-2 py-1.5 outline-none focus:border-accent font-mono"
        value={draft}
        onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <p class="text-[10px] text-zinc-400 mt-1 leading-snug">
        {saved
          ? "Fillable through the design's /fill endpoint."
          : "Name it to fill it from data or an agent."}
      </p>
    </div>
  );
}

export function RightSidebar() {
  const { selectedObject, updateSelectedObject, deleteSelected, canvas, setBackground, canvasWidth, canvasHeight } =
    useEditor();

  const isText = selectedObject instanceof fabric.Textbox || selectedObject instanceof fabric.IText;
  const isImage = selectedObject instanceof fabric.FabricImage;
  const isShape = selectedObject && !isText && !isImage;

  if (!selectedObject) {
    return (
      <aside class="w-[280px] bg-white border-l border-zinc-200 flex flex-col shrink-0">
        <div class="p-4 border-b border-zinc-200">
          <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Canvas</h2>
        </div>
        <div class="p-4 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-[11px] text-zinc-400">Dimensions</span>
            <span class="text-[11px] text-zinc-600 font-mono">{canvasWidth} x {canvasHeight}</span>
          </div>
          <label class="text-[11px] text-zinc-400">Background color</label>
          <input
            type="color"
            class="w-full h-8 rounded-md border border-zinc-300 cursor-pointer bg-transparent"
            onChange={(e) => setBackground("color", (e.target as HTMLInputElement).value)}
          />
        </div>
      </aside>
    );
  }

  return (
    <aside class="w-[280px] bg-white border-l border-zinc-200 flex flex-col shrink-0 overflow-y-auto">
      {/* Header */}
      <div class="p-4 border-b border-zinc-200 flex items-center justify-between">
        <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          {isText ? "Text" : isImage ? "Image" : "Shape"}
        </h2>
        <div class="flex gap-1">
          <button
            class="p-1 rounded text-zinc-400 bg-transparent border-none cursor-pointer hover:text-zinc-800 hover:bg-zinc-100 transition-all"
            onClick={async () => {
              if (!canvas || !selectedObject) return;
              const clone = await selectedObject.clone();
              clone.set({ left: (selectedObject.left || 0) + 20, top: (selectedObject.top || 0) + 20 });
              canvas.add(clone);
              canvas.setActiveObject(clone);
            }}
            title="Duplicate"
          >
            <Copy size={14} />
          </button>
          <button
            class="p-1 rounded text-zinc-400 bg-transparent border-none cursor-pointer hover:text-red-400 hover:bg-red-500/10 transition-all"
            onClick={deleteSelected}
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div class="p-4 flex flex-col gap-4">
        {/* ── Template field ────────────────────────────────────────── */}
        {(isText || isImage) && (
          <FieldNameInput
            object={selectedObject}
            onCommit={(fieldName) => updateSelectedObject({ fieldName })}
          />
        )}

        {/* ── Text properties ───────────────────────────────────────── */}
        {isText && (
          <>
            {/* Font family */}
            <div>
              <label class="text-[11px] text-zinc-400 mb-1 block">Font family</label>
              <select
                class="w-full bg-white border border-zinc-300 rounded-md text-xs text-zinc-700 px-2 py-1.5 outline-none cursor-pointer focus:border-accent"
                value={(selectedObject as any).fontFamily || "Inter"}
                onChange={(e) =>
                  updateSelectedObject({ fontFamily: (e.target as HTMLSelectElement).value })
                }
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {/* Font size */}
            <div>
              <label class="text-[11px] text-zinc-400 mb-1 block">Font size</label>
              <input
                type="number"
                class="w-full bg-white border border-zinc-300 rounded-md text-xs text-zinc-700 px-2 py-1.5 outline-none focus:border-accent"
                value={(selectedObject as any).fontSize || 18}
                onInput={(e) =>
                  updateSelectedObject({
                    fontSize: parseInt((e.target as HTMLInputElement).value) || 18,
                  })
                }
              />
            </div>

            {/* Bold / Italic / Underline */}
            <div>
              <label class="text-[11px] text-zinc-400 mb-1 block">Style</label>
              <div class="flex gap-1">
                <button
                  class={`p-1.5 rounded-md border cursor-pointer transition-all ${
                    (selectedObject as any).fontWeight === "700" || (selectedObject as any).fontWeight === "bold"
                      ? "bg-accent/20 border-accent text-accent"
                      : "bg-transparent border-zinc-300 text-zinc-400 hover:text-zinc-900"
                  }`}
                  onClick={() =>
                    updateSelectedObject({
                      fontWeight:
                        (selectedObject as any).fontWeight === "700" || (selectedObject as any).fontWeight === "bold"
                          ? "400"
                          : "700",
                    })
                  }
                >
                  <Bold size={14} />
                </button>
                <button
                  class={`p-1.5 rounded-md border cursor-pointer transition-all ${
                    (selectedObject as any).fontStyle === "italic"
                      ? "bg-accent/20 border-accent text-accent"
                      : "bg-transparent border-zinc-300 text-zinc-400 hover:text-zinc-900"
                  }`}
                  onClick={() =>
                    updateSelectedObject({
                      fontStyle: (selectedObject as any).fontStyle === "italic" ? "normal" : "italic",
                    })
                  }
                >
                  <Italic size={14} />
                </button>
                <button
                  class={`p-1.5 rounded-md border cursor-pointer transition-all ${
                    (selectedObject as any).underline
                      ? "bg-accent/20 border-accent text-accent"
                      : "bg-transparent border-zinc-300 text-zinc-400 hover:text-zinc-900"
                  }`}
                  onClick={() =>
                    updateSelectedObject({ underline: !(selectedObject as any).underline })
                  }
                >
                  <Underline size={14} />
                </button>
              </div>
            </div>

            {/* Text alignment */}
            <div>
              <label class="text-[11px] text-zinc-400 mb-1 block">Alignment</label>
              <div class="flex gap-1">
                {[
                  { align: "left", icon: AlignLeft },
                  { align: "center", icon: AlignCenter },
                  { align: "right", icon: AlignRight },
                ].map(({ align, icon: Icon }) => (
                  <button
                    key={align}
                    class={`p-1.5 rounded-md border cursor-pointer transition-all ${
                      (selectedObject as any).textAlign === align
                        ? "bg-accent/20 border-accent text-accent"
                        : "bg-transparent border-zinc-300 text-zinc-400 hover:text-zinc-900"
                    }`}
                    onClick={() => updateSelectedObject({ textAlign: align })}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </div>

            {/* Text color */}
            <div>
              <label class="text-[11px] text-zinc-400 mb-1 block">Color</label>
              <div class="flex items-center gap-2">
                <input
                  type="color"
                  class="w-8 h-8 rounded border border-zinc-300 cursor-pointer bg-transparent shrink-0"
                  value={((selectedObject as any).fill as string) || "#ffffff"}
                  onInput={(e) =>
                    updateSelectedObject({ fill: (e.target as HTMLInputElement).value })
                  }
                />
                <input
                  type="text"
                  class="flex-1 bg-white border border-zinc-300 rounded-md text-xs text-zinc-700 px-2 py-1.5 outline-none focus:border-accent font-mono"
                  value={((selectedObject as any).fill as string) || "#ffffff"}
                  onInput={(e) =>
                    updateSelectedObject({ fill: (e.target as HTMLInputElement).value })
                  }
                />
              </div>
            </div>

            {/* Line height */}
            <div>
              <label class="text-[11px] text-zinc-400 mb-1 flex justify-between">
                Line height
                <span class="text-zinc-400 font-mono">{((selectedObject as any).lineHeight || 1.2).toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="0.8"
                max="3"
                step="0.1"
                class="w-full accent-accent"
                value={(selectedObject as any).lineHeight || 1.2}
                onInput={(e) =>
                  updateSelectedObject({
                    lineHeight: parseFloat((e.target as HTMLInputElement).value),
                  })
                }
              />
            </div>

            {/* Letter spacing */}
            <div>
              <label class="text-[11px] text-zinc-400 mb-1 flex justify-between">
                Letter spacing
                <span class="text-zinc-400 font-mono">{(selectedObject as any).charSpacing || 0}</span>
              </label>
              <input
                type="range"
                min="-200"
                max="800"
                step="10"
                class="w-full accent-accent"
                value={(selectedObject as any).charSpacing || 0}
                onInput={(e) =>
                  updateSelectedObject({
                    charSpacing: parseInt((e.target as HTMLInputElement).value),
                  })
                }
              />
            </div>
          </>
        )}

        {/* ── Shape properties ──────────────────────────────────────── */}
        {isShape && (
          <>
            {/* Fill color */}
            <div>
              <label class="text-[11px] text-zinc-400 mb-1 block">Fill color</label>
              <div class="flex items-center gap-2">
                <input
                  type="color"
                  class="w-8 h-8 rounded border border-zinc-300 cursor-pointer bg-transparent shrink-0"
                  value={(selectedObject.fill as string) || "#6366f1"}
                  onInput={(e) =>
                    updateSelectedObject({ fill: (e.target as HTMLInputElement).value })
                  }
                />
                <input
                  type="text"
                  class="flex-1 bg-white border border-zinc-300 rounded-md text-xs text-zinc-700 px-2 py-1.5 outline-none focus:border-accent font-mono"
                  value={(selectedObject.fill as string) || "#6366f1"}
                  onInput={(e) =>
                    updateSelectedObject({ fill: (e.target as HTMLInputElement).value })
                  }
                />
              </div>
            </div>

            {/* Stroke */}
            <div>
              <label class="text-[11px] text-zinc-400 mb-1 block">Stroke color</label>
              <div class="flex items-center gap-2">
                <input
                  type="color"
                  class="w-8 h-8 rounded border border-zinc-300 cursor-pointer bg-transparent shrink-0"
                  value={(selectedObject.stroke as string) || "#000000"}
                  onInput={(e) =>
                    updateSelectedObject({ stroke: (e.target as HTMLInputElement).value })
                  }
                />
                <input
                  type="number"
                  class="w-16 bg-white border border-zinc-300 rounded-md text-xs text-zinc-700 px-2 py-1.5 outline-none focus:border-accent"
                  value={selectedObject.strokeWidth || 0}
                  min={0}
                  placeholder="Width"
                  onInput={(e) =>
                    updateSelectedObject({
                      strokeWidth: parseInt((e.target as HTMLInputElement).value) || 0,
                    })
                  }
                />
              </div>
            </div>

            {/* Border radius (for rect) */}
            {selectedObject instanceof fabric.Rect && (
              <div>
                <label class="text-[11px] text-zinc-400 mb-1 flex justify-between">
                  Border radius
                  <span class="text-zinc-400 font-mono">{(selectedObject as any).rx || 0}px</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  class="w-full accent-accent"
                  value={(selectedObject as any).rx || 0}
                  onInput={(e) => {
                    const val = parseInt((e.target as HTMLInputElement).value);
                    updateSelectedObject({ rx: val, ry: val });
                  }}
                />
              </div>
            )}
          </>
        )}

        {/* ── Image properties ──────────────────────────────────────── */}
        {isImage && (
          <>
            <div>
              <label class="text-[11px] text-zinc-400 mb-1 block">Flip</label>
              <div class="flex gap-1">
                <button
                  class={`p-1.5 rounded-md border cursor-pointer transition-all ${
                    selectedObject.flipX
                      ? "bg-accent/20 border-accent text-accent"
                      : "bg-transparent border-zinc-300 text-zinc-400 hover:text-zinc-900"
                  }`}
                  onClick={() => updateSelectedObject({ flipX: !selectedObject.flipX })}
                >
                  <FlipHorizontal size={14} />
                </button>
                <button
                  class={`p-1.5 rounded-md border cursor-pointer transition-all ${
                    selectedObject.flipY
                      ? "bg-accent/20 border-accent text-accent"
                      : "bg-transparent border-zinc-300 text-zinc-400 hover:text-zinc-900"
                  }`}
                  onClick={() => updateSelectedObject({ flipY: !selectedObject.flipY })}
                >
                  <FlipVertical size={14} />
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Common: Opacity ───────────────────────────────────────── */}
        <div>
          <label class="text-[11px] text-zinc-400 mb-1 flex justify-between">
            Opacity
            <span class="text-zinc-400 font-mono">{Math.round((selectedObject.opacity ?? 1) * 100)}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            class="w-full accent-accent"
            value={selectedObject.opacity ?? 1}
            onInput={(e) =>
              updateSelectedObject({
                opacity: parseFloat((e.target as HTMLInputElement).value),
              })
            }
          />
        </div>
      </div>
    </aside>
  );
}
