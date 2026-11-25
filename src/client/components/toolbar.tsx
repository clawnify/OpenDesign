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
  FileText,
  Image as ImageIcon,
  Images,
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
    exportAllPNG,
    exportPDF,
    exporting,
    pages,
    saveDesign,
    saving,
    saveStatus,
    autoSave,
    setAutoSave,
    activeDesign,
    renameDesign,
    setDesignTemplate,
    navigate,
  } = useEditor();

  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
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

  const designName = activeDesign?.name ?? "design";
  const pageIds = pages.map((p) => p.id);

  const runExport = (fn: () => void) => {
    setShowExportMenu(false);
    fn();
  };

  return (
    <div class="flex h-14 items-center justify-between gap-3 px-3 bg-surface border-b border-border shrink-0">
      {/* Left: Home + Design name + Canvas size */}
      <div class="flex items-center gap-3">
        <button
          class="btn btn-ghost btn-icon"
          onClick={() => navigate("/")}
          title="Back to designs"
          aria-label="Back to designs"
        >
          <Home size={16} />
        </button>
        {activeDesign && (
          editingName ? (
            <input
              class="field h-7 w-48"
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
              class="text-heading-3 text-foreground cursor-text truncate max-w-[16rem]"
              title="Double-click to rename"
              onDblClick={startRename}
            >
              {activeDesign.name}
            </span>
          )
        )}

        <div class="relative">
          <button
            class="btn btn-secondary pl-2.5 pr-2"
            aria-expanded={showSizeDropdown}
            onClick={() => (showSizeDropdown ? setShowSizeDropdown(false) : openSizeMenu())}
          >
            {sizeLabel}
            <ChevronDown size={14} class="text-muted" />
          </button>
          {showSizeDropdown && (
            <>
              <div class="fixed inset-0 z-10" onClick={() => setShowSizeDropdown(false)} />
              <div class="menu absolute top-full left-0 mt-1 z-20 min-w-[16rem]">
                {Object.entries(groups).map(([group, sizes]) => (
                  <div key={group}>
                    <div class="menu-label">
                      {group}
                    </div>
                    {sizes.map((s) => (
                      <button
                        key={s.label}
                        class="menu-item"
                        aria-selected={s.width === canvasWidth && s.height === canvasHeight}
                        onClick={() => {
                          setCanvasSize(s.width, s.height);
                          setShowSizeDropdown(false);
                        }}
                      >
                        <span>{s.label}</span>
                        <span class="ml-auto text-fine text-muted tabular-nums">
                          {s.width} x {s.height}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}

                <div class="mt-1 pt-1 border-t border-border px-2 pb-1.5">
                  <div class="menu-label px-0">
                    Custom
                  </div>
                  <div class="flex items-center gap-1.5">
                    <input
                      type="number"
                      aria-label="Custom width in pixels"
                      class="field h-7 w-[4.75rem] tabular-nums"
                      value={customWidth}
                      min={MIN_CANVAS_SIDE}
                      max={MAX_CANVAS_SIDE}
                      onInput={(e) => setCustomWidth((e.target as HTMLInputElement).value)}
                      onKeyDown={(e) => e.key === "Enter" && applyCustomSize()}
                    />
                    <span class="text-body-sm text-muted">×</span>
                    <input
                      type="number"
                      aria-label="Custom height in pixels"
                      class="field h-7 w-[4.75rem] tabular-nums"
                      value={customHeight}
                      min={MIN_CANVAS_SIDE}
                      max={MAX_CANVAS_SIDE}
                      onInput={(e) => setCustomHeight((e.target as HTMLInputElement).value)}
                      onKeyDown={(e) => e.key === "Enter" && applyCustomSize()}
                    />
                    <button
                      class="btn btn-secondary"
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
            class="btn btn-ghost"
            onClick={undoResize}
            title="Restore the previous size and layout"
          >
            <RotateCcw size={14} />
            Undo resize
          </button>
        )}
      </div>

      {/* Center: Undo / Redo */}
      <div class="flex items-center gap-1">
        <button
          class="btn btn-ghost btn-icon"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Cmd+Z)"
          aria-label="Undo"
        >
          <Undo2 size={16} />
        </button>
        <button
          class="btn btn-ghost btn-icon"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Cmd+Shift+Z)"
          aria-label="Redo"
        >
          <Redo2 size={16} />
        </button>
      </div>

      {/* Right: Zoom + Export + Save */}
      <div class="flex items-center gap-1.5">
        <button
          class="btn btn-ghost btn-icon"
          onClick={zoomOut}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut size={15} />
        </button>
        <span class="text-label text-muted tabular-nums w-12 text-center">
          {Math.round((zoom / (fitScale || 1)) * 100)}%
        </span>
        <button
          class="btn btn-ghost btn-icon"
          onClick={zoomIn}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn size={15} />
        </button>
        <button
          class="btn btn-ghost btn-icon"
          onClick={zoomToFit}
          title="Fit to screen"
          aria-label="Fit to screen"
        >
          <Maximize size={15} />
        </button>

        <div class="w-px h-5 bg-border mx-1" />

        <div class="relative">
          <button
            class="btn btn-secondary"
            aria-expanded={showExportMenu}
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={exporting || !activeDesign}
            title="Export this design"
          >
            <Download size={14} />
            {exporting ? "Preparing…" : "Export"}
            <ChevronDown size={14} class="text-muted" />
          </button>
          {showExportMenu && (
            <>
              <div class="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
              <div class="menu absolute top-full right-0 mt-1 z-20 min-w-[15rem]">
                <button
                  class="menu-item items-start gap-2.5"
                  onClick={() => runExport(() => exportPDF(pageIds, designName))}
                >
                  <FileText size={14} class="mt-0.5 shrink-0 text-muted" />
                  <span>
                    <span class="block font-medium">Carousel PDF</span>
                    <span class="block text-fine text-muted">
                      All {pages.length} {pages.length === 1 ? "page" : "pages"}, ready for LinkedIn
                    </span>
                  </span>
                </button>
                <button
                  class="menu-item items-start gap-2.5"
                  onClick={() => runExport(() => exportPNG(designName))}
                >
                  <ImageIcon size={14} class="mt-0.5 shrink-0 text-muted" />
                  <span>
                    <span class="block font-medium">This page</span>
                    <span class="block text-fine text-muted">PNG at 2x</span>
                  </span>
                </button>
                {pages.length > 1 && (
                  <button
                    class="menu-item items-start gap-2.5"
                    onClick={() => runExport(() => exportAllPNG(pageIds, designName))}
                  >
                    <Images size={14} class="mt-0.5 shrink-0 text-muted" />
                    <span>
                      <span class="block font-medium">All pages</span>
                      <span class="block text-fine text-muted">{pages.length} separate PNGs at 2x</span>
                    </span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        {activeDesign && (
          <label class="inline-flex items-center gap-1.5 text-label text-muted whitespace-nowrap cursor-pointer" title="Save changes automatically after a short pause">
            <input
              type="checkbox"
              class="accent-foreground"
              checked={autoSave}
              onChange={(e) => {
                setAutoSave(e.currentTarget.checked);
                if (e.currentTarget.checked) void saveDesign();
              }}
            />
            Auto-save
          </label>
        )}
        {activeDesign && (
          <label class="inline-flex items-center gap-1.5 text-label text-muted whitespace-nowrap cursor-pointer" title="Offer this design under Start from a template. Starting from it copies every page.">
            <input
              type="checkbox"
              class="accent-foreground"
              checked={Boolean(activeDesign.is_template)}
              onChange={(e) => void setDesignTemplate(activeDesign.id, e.currentTarget.checked)}
            />
            Template
          </label>
        )}
        {activeDesign && (
          <span class={`text-fine whitespace-nowrap ${saveStatus === "error" ? "text-danger" : "text-muted"}`} aria-live="polite">
            {saveStatus === "pending" ? "Unsaved changes" : saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Save failed" : autoSave ? "All changes saved" : ""}
          </span>
        )}
        <button
          class="btn btn-primary"
          onClick={saveDesign}
          disabled={saving || !activeDesign}
        >
          <Save size={14} />
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
