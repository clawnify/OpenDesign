import { useState } from "preact/hooks";
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Download,
  Save,
  ChevronDown,
  Home,
  RotateCcw,
} from "lucide-preact";
import {
  useEditor,
  CANVAS_SIZES,
  MIN_CANVAS_SIDE,
  MAX_CANVAS_SIDE,
} from "../context";

export function Toolbar() {
  const {
    canvasWidth,
    canvasHeight,
    setCanvasSize,
    undoResize,
    canUndoResize,
    undo,
    redo,
    canUndo,
    canRedo,
    zoom,
    fitScale,
    zoomToFit,
    zoomIn,
    zoomOut,
    exportPNG,
    saveDesign,
    saving,
    activeDesign,
    renameDesign,
    navigate,
  } = useEditor();

  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  const currentSize = CANVAS_SIZES.find(
    (s) => s.width === canvasWidth && s.height === canvasHeight
  );
  const sizeLabel = currentSize ? currentSize.label : `${canvasWidth} x ${canvasHeight}`;

  const groups = CANVAS_SIZES.reduce<Record<string, typeof CANVAS_SIZES>>((acc, size) => {
    (acc[size.group] ||= []).push(size);
    return acc;
  }, {});

  const clampSide = (raw: string) => {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.min(Math.max(n, MIN_CANVAS_SIDE), MAX_CANVAS_SIDE);
  };

  const openSizeMenu = () => {
    setCustomWidth(String(canvasWidth));
    setCustomHeight(String(canvasHeight));
    setShowSizeDropdown(true);
  };

  const applyCustomSize = () => {
    const w = clampSide(customWidth);
    const h = clampSide(customHeight);
    if (w === null || h === null) return;
    setCustomWidth(String(w));
    setCustomHeight(String(h));
    setCanvasSize(w, h);
    setShowSizeDropdown(false);
  };

  const startRename = () => {
    if (!activeDesign) return;
    setNameValue(activeDesign.name);
    setEditingName(true);
  };

  const finishRename = () => {
    if (activeDesign && nameValue.trim()) {
      renameDesign(activeDesign.id, nameValue.trim());
    }
    setEditingName(false);
  };

  return (
    <div class="flex items-center justify-between px-3 py-1.5 bg-white border-b border-zinc-200 shrink-0">
      {/* Left: Home + Design name + Canvas size */}
      <div class="flex items-center gap-3">
        <button
          class="p-1.5 rounded-md text-zinc-400 bg-transparent border-none cursor-pointer transition-all hover:bg-zinc-100 hover:text-zinc-900"
          onClick={() => navigate("/")}
          title="Back to designs"
        >
          <Home size={16} />
        </button>
        {activeDesign && (
          editingName ? (
            <input
              class="bg-zinc-100 border border-accent rounded px-2 py-0.5 text-xs text-zinc-900 outline-none w-40"
              value={nameValue}
              onInput={(e) => setNameValue((e.target as HTMLInputElement).value)}
              onBlur={finishRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") finishRename();
                if (e.key === "Escape") setEditingName(false);
              }}
              autoFocus
            />
          ) : (
            <span
              class="text-xs font-semibold text-zinc-600 cursor-pointer hover:text-zinc-900 transition-colors"
              onDblClick={startRename}
            >
              {activeDesign.name}
            </span>
          )
        )}

        <div class="relative">
          <button
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-400 bg-zinc-100 border border-zinc-300 cursor-pointer hover:text-zinc-900 hover:border-zinc-500 transition-all"
            onClick={() => (showSizeDropdown ? setShowSizeDropdown(false) : openSizeMenu())}
          >
            {sizeLabel}
            <ChevronDown size={12} />
          </button>
          {showSizeDropdown && (
            <>
              <div class="fixed inset-0 z-10" onClick={() => setShowSizeDropdown(false)} />
              <div class="absolute top-full left-0 mt-1 bg-white border border-zinc-300 rounded-lg shadow-xl z-20 min-w-[240px] py-1">
                {Object.entries(groups).map(([group, sizes]) => (
                  <div key={group}>
                    <div class="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      {group}
                    </div>
                    {sizes.map((s) => (
                      <button
                        key={s.label}
                        class={`w-full text-left px-3 py-1.5 text-xs cursor-pointer border-none transition-colors ${
                          s.width === canvasWidth && s.height === canvasHeight
                            ? "bg-accent/20 text-accent"
                            : "text-zinc-600 bg-transparent hover:bg-zinc-100"
                        }`}
                        onClick={() => {
                          setCanvasSize(s.width, s.height);
                          setShowSizeDropdown(false);
                        }}
                      >
                        <span class="font-medium">{s.label}</span>
                        <span class="text-zinc-400 ml-2">
                          {s.width} x {s.height}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}

                <div class="mt-1 pt-2 border-t border-zinc-200 px-3 pb-1">
                  <div class="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Custom
                  </div>
                  <div class="flex items-center gap-1.5">
                    <input
                      type="number"
                      aria-label="Custom width in pixels"
                      class="w-[68px] bg-zinc-100 border border-zinc-300 rounded px-2 py-1 text-xs text-zinc-900 outline-none focus:border-accent"
                      value={customWidth}
                      min={MIN_CANVAS_SIDE}
                      max={MAX_CANVAS_SIDE}
                      onInput={(e) => setCustomWidth((e.target as HTMLInputElement).value)}
                      onKeyDown={(e) => e.key === "Enter" && applyCustomSize()}
                    />
                    <span class="text-zinc-400 text-xs">x</span>
                    <input
                      type="number"
                      aria-label="Custom height in pixels"
                      class="w-[68px] bg-zinc-100 border border-zinc-300 rounded px-2 py-1 text-xs text-zinc-900 outline-none focus:border-accent"
                      value={customHeight}
                      min={MIN_CANVAS_SIDE}
                      max={MAX_CANVAS_SIDE}
                      onInput={(e) => setCustomHeight((e.target as HTMLInputElement).value)}
                      onKeyDown={(e) => e.key === "Enter" && applyCustomSize()}
                    />
                    <button
                      class="px-2.5 py-1 rounded text-xs font-medium text-white bg-accent border-none cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={applyCustomSize}
                    >
                      Resize
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {canUndoResize && (
          <button
            class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-zinc-500 bg-transparent border border-zinc-300 cursor-pointer hover:text-zinc-900 hover:border-zinc-500 transition-all"
            onClick={undoResize}
            title="Restore the previous size and layout"
          >
            <RotateCcw size={11} />
            Undo resize
          </button>
        )}
      </div>

      {/* Center: Undo / Redo */}
      <div class="flex items-center gap-1">
        <button
          class="p-1.5 rounded-md text-zinc-400 bg-transparent border-none cursor-pointer transition-all hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Cmd+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          class="p-1.5 rounded-md text-zinc-400 bg-transparent border-none cursor-pointer transition-all hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo2 size={16} />
        </button>
      </div>

      {/* Right: Zoom + Export + Save */}
      <div class="flex items-center gap-1.5">
        <button
          class="p-1.5 rounded-md text-zinc-400 bg-transparent border-none cursor-pointer transition-all hover:bg-zinc-100 hover:text-zinc-900"
          onClick={zoomOut}
          title="Zoom out"
        >
          <ZoomOut size={15} />
        </button>
        <span class="text-[11px] text-zinc-400 font-mono w-10 text-center">
          {Math.round((zoom / (fitScale || 1)) * 100)}%
        </span>
        <button
          class="p-1.5 rounded-md text-zinc-400 bg-transparent border-none cursor-pointer transition-all hover:bg-zinc-100 hover:text-zinc-900"
          onClick={zoomIn}
          title="Zoom in"
        >
          <ZoomIn size={15} />
        </button>
        <button
          class="p-1.5 rounded-md text-zinc-400 bg-transparent border-none cursor-pointer transition-all hover:bg-zinc-100 hover:text-zinc-900"
          onClick={zoomToFit}
          title="Fit to screen"
        >
          <Maximize size={15} />
        </button>

        <div class="w-px h-5 bg-zinc-300 mx-1" />

        <button
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold border border-zinc-300 cursor-pointer transition-all bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          onClick={exportPNG}
          title="Export as PNG"
        >
          <Download size={13} />
          Export
        </button>
        <button
          class="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-md text-[11px] font-semibold border-none cursor-pointer transition-all bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
          onClick={saveDesign}
          disabled={saving || !activeDesign}
        >
          {saving ? <span class="spinner !border-white/30 !border-t-white" /> : <Save size={13} />}
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
