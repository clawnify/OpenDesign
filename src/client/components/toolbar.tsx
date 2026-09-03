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
  FileText,
  Image as ImageIcon,
  Images,
} from "lucide-preact";
import { useEditor, CANVAS_SIZES } from "../context";

export function Toolbar() {
  const {
    canvasWidth,
    canvasHeight,
    setCanvasSize,
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
    exportAllPNG,
    exportPDF,
    exporting,
    pages,
    saveDesign,
    saving,
    activeDesign,
    renameDesign,
    navigate,
  } = useEditor();

  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  const currentSize = CANVAS_SIZES.find(
    (s) => s.width === canvasWidth && s.height === canvasHeight
  );
  const sizeLabel = currentSize ? currentSize.label : `${canvasWidth} x ${canvasHeight}`;

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

  const designName = activeDesign?.name ?? "design";
  const pageIds = pages.map((p) => p.id);

  const runExport = (fn: () => void) => {
    setShowExportMenu(false);
    fn();
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
            onClick={() => setShowSizeDropdown(!showSizeDropdown)}
          >
            {sizeLabel}
            <ChevronDown size={12} />
          </button>
          {showSizeDropdown && (
            <>
              <div class="fixed inset-0 z-10" onClick={() => setShowSizeDropdown(false)} />
              <div class="absolute top-full left-0 mt-1 bg-white border border-zinc-300 rounded-lg shadow-xl z-20 min-w-[200px] py-1">
                {CANVAS_SIZES.map((s) => (
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
            </>
          )}
        </div>
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

        <div class="relative">
          <button
            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold border border-zinc-300 cursor-pointer transition-all bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={exporting || !activeDesign}
            title="Export this design"
          >
            {exporting ? <span class="spinner" /> : <Download size={13} />}
            {exporting ? "Preparing..." : "Export"}
            <ChevronDown size={12} />
          </button>
          {showExportMenu && (
            <>
              <div class="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
              <div class="absolute top-full right-0 mt-1 bg-white border border-zinc-300 rounded-lg shadow-xl z-20 min-w-[230px] py-1">
                <button
                  class="w-full flex items-start gap-2.5 text-left px-3 py-2 text-xs text-zinc-600 bg-transparent border-none cursor-pointer transition-colors hover:bg-zinc-100"
                  onClick={() => runExport(() => exportPDF(pageIds, designName))}
                >
                  <FileText size={14} class="mt-0.5 shrink-0 text-accent" />
                  <span>
                    <span class="block font-medium text-zinc-900">Carousel PDF</span>
                    <span class="block text-[10px] text-zinc-400">
                      All {pages.length} {pages.length === 1 ? "page" : "pages"} — ready for LinkedIn
                    </span>
                  </span>
                </button>
                <button
                  class="w-full flex items-start gap-2.5 text-left px-3 py-2 text-xs text-zinc-600 bg-transparent border-none cursor-pointer transition-colors hover:bg-zinc-100"
                  onClick={() => runExport(() => exportPNG(designName))}
                >
                  <ImageIcon size={14} class="mt-0.5 shrink-0 text-zinc-400" />
                  <span>
                    <span class="block font-medium text-zinc-900">This page</span>
                    <span class="block text-[10px] text-zinc-400">PNG at 2x</span>
                  </span>
                </button>
                {pages.length > 1 && (
                  <button
                    class="w-full flex items-start gap-2.5 text-left px-3 py-2 text-xs text-zinc-600 bg-transparent border-none cursor-pointer transition-colors hover:bg-zinc-100"
                    onClick={() => runExport(() => exportAllPNG(pageIds, designName))}
                  >
                    <Images size={14} class="mt-0.5 shrink-0 text-zinc-400" />
                    <span>
                      <span class="block font-medium text-zinc-900">All pages</span>
                      <span class="block text-[10px] text-zinc-400">{pages.length} separate PNGs at 2x</span>
                    </span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
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
