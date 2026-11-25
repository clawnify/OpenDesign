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
  ArrowUp,
  ArrowDown,
  ArrowUpToLine,
  ArrowDownToLine,
} from "lucide-preact";
import * as fabric from "fabric";
import { useEditor } from "../context";
import { FontPicker } from "./font-picker";

/**
 * The active kit's colours, offered wherever a colour is chosen. This is what
 * "on brand" means day to day: the brand palette is one click away at the
 * moment of picking, not a page you have to remember to visit.
 */
function BrandSwatches({ onPick }: { onPick: (color: string) => void }) {
  const { activeBrandKit } = useEditor();
  if (!activeBrandKit || activeBrandKit.colors.length === 0) return null;
  return (
    <div class="flex flex-wrap gap-1 mt-1.5">
      {activeBrandKit.colors.map((color, i) => (
        <button
          key={`${color}-${i}`}
          class="swatch w-5 h-5"
          style={{ background: color }}
          title={`${activeBrandKit.name} — ${color}`}
          aria-label={`Use brand color ${color}`}
          onClick={() => onPick(color)}
        />
      ))}
    </div>
  );
}

/**
 * Shrink a text so it stays on this many lines (lib/fit-text.ts). Empty is
 * off, which puts the text back at the size it was designed at.
 */
function FitLinesInput({
  object,
  onCommit,
}: {
  object: fabric.FabricObject;
  onCommit: (lines: number | null) => void;
}) {
  const saved = Number((object as any).maxLines) || 0;
  const [draft, setDraft] = useState(saved ? String(saved) : "");

  useEffect(() => setDraft(saved ? String(saved) : ""), [object]);

  const commit = () => {
    const n = Math.floor(Number(draft));
    const next = n >= 1 && n <= 20 ? n : 0;
    if (next !== saved) onCommit(next || null);
    setDraft(next ? String(next) : "");
  };

  return (
    <div>
      <label class="field-label">Shrink to fit</label>
      <input
        type="number"
        min={1}
        max={20}
        placeholder="Off"
        aria-label="Shrink to fit: most lines"
        class="field"
        value={draft}
        onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <p class="text-fine text-muted mt-1.5">
        The most lines this text may take. Longer text gets smaller instead of wrapping.
      </p>
    </div>
  );
}

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
      <label class="field-label">Field name</label>
      <input
        type="text"
        placeholder="e.g. headline"
        class="field font-mono"
        value={draft}
        onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <p class="text-fine text-muted mt-1.5">
        {saved
          ? "Fillable through the design's /fill endpoint."
          : "Name it to fill it from data or an agent."}
      </p>
    </div>
  );
}

export function RightSidebar() {
  const { selectedObject, updateSelectedObject, changeLayer, deleteSelected, canvas, setBackground, canvasWidth, canvasHeight } =
    useEditor();

  const isText = selectedObject instanceof fabric.Textbox || selectedObject instanceof fabric.IText;
  const isImage = selectedObject instanceof fabric.FabricImage;
  const isShape = selectedObject && !isText && !isImage;
  const objects = canvas?.getObjects() ?? [];
  const layerIndex = selectedObject ? objects.indexOf(selectedObject) : -1;
  const layerCount = objects.length;
  const backgroundHex =
    typeof canvas?.backgroundColor === "string" && /^#[0-9a-f]{6}$/i.test(canvas.backgroundColor)
      ? canvas.backgroundColor.toLowerCase()
      : "#ffffff";

  if (!selectedObject) {
    return (
      <aside class="w-[17.5rem] bg-surface border-l border-border flex flex-col shrink-0">
        <div class="h-12 px-4 flex items-center shrink-0">
          <h2 class="text-heading-3 text-foreground m-0">Canvas</h2>
        </div>
        <div class="px-4 pb-4 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-label text-muted">Dimensions</span>
            <span class="text-label text-foreground tabular-nums">{canvasWidth} x {canvasHeight}</span>
          </div>
          <span class="field-label mb-0">Background color</span>
          <div class="flex items-center gap-2">
            <input
              type="color"
              class="swatch w-8 h-8 shrink-0"
              aria-label="Background color"
              value={backgroundHex}
              onChange={(e) => setBackground("color", (e.target as HTMLInputElement).value)}
            />
            <input
              type="text"
              class="field flex-1 font-mono"
              aria-label="Background color, hex"
              value={backgroundHex}
              onChange={(e) => {
                const v = (e.target as HTMLInputElement).value.trim();
                if (/^#[0-9a-f]{6}$/i.test(v)) setBackground("color", v);
              }}
            />
          </div>
          <BrandSwatches onPick={(color) => setBackground("color", color)} />
        </div>
      </aside>
    );
  }

  return (
    <aside class="w-[17.5rem] bg-surface border-l border-border flex flex-col shrink-0 overflow-y-auto">
      {/* Header */}
      <div class="h-12 px-4 flex items-center justify-between shrink-0">
        <h2 class="text-heading-3 text-foreground m-0">
          {isText ? "Text" : isImage ? "Image" : "Shape"}
        </h2>
        <div class="flex gap-1">
          <button
            class="btn btn-ghost btn-icon"
            aria-label="Duplicate"
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
            class="btn btn-ghost btn-icon is-danger"
            aria-label="Delete"
            onClick={deleteSelected}
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div class="px-4 pb-4 flex flex-col gap-4">
        {/* ── Template field ────────────────────────────────────────── */}
        {(isText || isImage) && (
          <FieldNameInput
            object={selectedObject}
            onCommit={(fieldName) => updateSelectedObject({ fieldName })}
          />
        )}
        {isText && (
          <FitLinesInput
            object={selectedObject}
            onCommit={(lines) => {
              const o = selectedObject as any;
              updateSelectedObject(
                lines
                  ? { maxLines: lines }
                  : { maxLines: undefined, fitFontSize: undefined, fontSize: o.fitFontSize ?? o.fontSize },
              );
            }}
          />
        )}

        <div>
          <label class="field-label">Layer order</label>
          <div class="grid grid-cols-2 gap-1.5">
            {([
              ["forward", ArrowUp, "Forward", layerIndex === layerCount - 1],
              ["backward", ArrowDown, "Backward", layerIndex <= 0],
              ["front", ArrowUpToLine, "To front", layerIndex === layerCount - 1],
              ["back", ArrowDownToLine, "To back", layerIndex <= 0],
            ] as const).map(([action, Icon, label, disabled]) => (
              <button
                key={action}
                type="button"
                class="btn btn-secondary w-full"
                disabled={layerIndex < 0 || disabled}
                onClick={() => changeLayer(action)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Text properties ───────────────────────────────────────── */}
        {isText && (
          <>
            {/* Font family */}
            <FontPicker
              label="Font family"
              value={(selectedObject as fabric.IText).fontFamily || "Inter"}
              onChange={(fontFamily) => updateSelectedObject({ fontFamily })}
            />

            {/* Font size */}
            <div>
              <label class="field-label">Font size</label>
              <input
                type="number"
                class="field"
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
              <label class="field-label">Style</label>
              <div class="segmented">
                <button
                  class="segmented-item"
                  aria-pressed={Boolean((selectedObject as any).fontWeight === "700" || (selectedObject as any).fontWeight === "bold")}
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
                  <span class="sr-only">Bold</span>
                </button>
                <button
                  class="segmented-item"
                  aria-pressed={Boolean((selectedObject as any).fontStyle === "italic")}
                  onClick={() =>
                    updateSelectedObject({
                      fontStyle: (selectedObject as any).fontStyle === "italic" ? "normal" : "italic",
                    })
                  }
                >
                  <Italic size={14} />
                  <span class="sr-only">Italic</span>
                </button>
                <button
                  class="segmented-item"
                  aria-pressed={Boolean((selectedObject as any).underline)}
                  onClick={() =>
                    updateSelectedObject({ underline: !(selectedObject as any).underline })
                  }
                >
                  <Underline size={14} />
                  <span class="sr-only">Underline</span>
                </button>
              </div>
            </div>

            {/* Text alignment */}
            <div>
              <label class="field-label">Alignment</label>
              <div class="segmented">
                {[
                  { align: "left", icon: AlignLeft },
                  { align: "center", icon: AlignCenter },
                  { align: "right", icon: AlignRight },
                ].map(({ align, icon: Icon }) => (
                  <button
                    key={align}
                    class="segmented-item"
                  aria-pressed={Boolean((selectedObject as any).textAlign === align)}
                    onClick={() => updateSelectedObject({ textAlign: align })}
                  >
                    <Icon size={14} />
                    <span class="sr-only">{`Align ${align}`}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Text color */}
            <div>
              <label class="field-label">Color</label>
              <div class="flex items-center gap-2">
                <input
                  type="color"
                  class="swatch w-8 h-8 shrink-0"
                  value={((selectedObject as any).fill as string) || "#ffffff"}
                  onInput={(e) =>
                    updateSelectedObject({ fill: (e.target as HTMLInputElement).value })
                  }
                />
                <input
                  type="text"
                  class="field flex-1 font-mono"
                  value={((selectedObject as any).fill as string) || "#ffffff"}
                  onInput={(e) =>
                    updateSelectedObject({ fill: (e.target as HTMLInputElement).value })
                  }
                />
              </div>
              <BrandSwatches onPick={(color) => updateSelectedObject({ fill: color })} />
            </div>

            {/* Line height */}
            <div>
              <label class="field-label flex justify-between">
                Line height
                <span class="font-normal text-muted tabular-nums">{((selectedObject as any).lineHeight || 1.2).toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="0.8"
                max="3"
                step="0.1"
                class="w-full"
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
              <label class="field-label flex justify-between">
                Letter spacing
                <span class="font-normal text-muted tabular-nums">{(selectedObject as any).charSpacing || 0}</span>
              </label>
              <input
                type="range"
                min="-200"
                max="800"
                step="10"
                class="w-full"
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
              <label class="field-label">Fill color</label>
              <div class="flex items-center gap-2">
                <input
                  type="color"
                  class="swatch w-8 h-8 shrink-0"
                  value={(selectedObject.fill as string) || "#9a9893"}
                  onInput={(e) =>
                    updateSelectedObject({ fill: (e.target as HTMLInputElement).value })
                  }
                />
                <input
                  type="text"
                  class="field flex-1 font-mono"
                  value={(selectedObject.fill as string) || "#9a9893"}
                  onInput={(e) =>
                    updateSelectedObject({ fill: (e.target as HTMLInputElement).value })
                  }
                />
              </div>
              <BrandSwatches onPick={(color) => updateSelectedObject({ fill: color })} />
            </div>

            {/* Stroke */}
            <div>
              <label class="field-label">Stroke color</label>
              <div class="flex items-center gap-2">
                <input
                  type="color"
                  class="swatch w-8 h-8 shrink-0"
                  value={(selectedObject.stroke as string) || "#000000"}
                  onInput={(e) =>
                    updateSelectedObject({ stroke: (e.target as HTMLInputElement).value })
                  }
                />
                <input
                  type="number"
                  class="field w-20 tabular-nums"
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
                <label class="field-label flex justify-between">
                  Border radius
                  <span class="font-normal text-muted tabular-nums">{(selectedObject as any).rx || 0}px</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  class="w-full"
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
              <label class="field-label">Flip</label>
              <div class="segmented">
                <button
                  class="segmented-item"
                  aria-pressed={Boolean(selectedObject.flipX)}
                  onClick={() => updateSelectedObject({ flipX: !selectedObject.flipX })}
                >
                  <FlipHorizontal size={14} />
                  <span class="sr-only">Flip horizontally</span>
                </button>
                <button
                  class="segmented-item"
                  aria-pressed={Boolean(selectedObject.flipY)}
                  onClick={() => updateSelectedObject({ flipY: !selectedObject.flipY })}
                >
                  <FlipVertical size={14} />
                  <span class="sr-only">Flip vertically</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Common: Opacity ───────────────────────────────────────── */}
        <div>
          <label class="field-label flex justify-between">
            Opacity
            <span class="font-normal text-muted tabular-nums">{Math.round((selectedObject.opacity ?? 1) * 100)}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            class="w-full"
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
