import { useRef, useEffect, useState } from "preact/hooks";
import { Plus, Copy, Trash2 } from "lucide-preact";
import { useEditor } from "../context";
import { PageCanvas } from "./page-canvas";

export function CanvasArea() {
  const {
    pages, activePageId, setActiveCanvas, canvasWidth, canvasHeight,
    zoom, setZoomRaw, setFitScale, addPage, duplicatePage, deletePage, renamePage,
  } = useEditor();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  // Calculate fit scale on mount
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const padding = 120;
    const availW = wrapper.clientWidth - padding;
    const fit = Math.min(availW / canvasWidth, 1);
    setFitScale(fit);
    setZoomRaw(0.58);
  }, [canvasWidth, canvasHeight]);

  // Recalculate on resize
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const obs = new ResizeObserver(() => {
      const padding = 120;
      const availW = wrapper.clientWidth - padding;
      const fit = Math.min(availW / canvasWidth, 1);
      setFitScale(fit);
    });
    obs.observe(wrapper);
    return () => obs.disconnect();
  }, [canvasWidth, canvasHeight]);

  // Cmd+wheel zoom towards mouse position
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const handler = (e: WheelEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      const prevZoom = zoomRef.current;
      const factor = e.deltaY > 0 ? 0.95 : 1.05;
      const newZoom = Math.min(Math.max(prevZoom * factor, 0.05), 3);

      // Mouse position relative to scroll container
      const rect = wrapper.getBoundingClientRect();
      const mouseX = e.clientX - rect.left + wrapper.scrollLeft;
      const mouseY = e.clientY - rect.top + wrapper.scrollTop;

      // Adjust scroll to keep point under mouse stable
      const scale = newZoom / prevZoom;
      wrapper.scrollLeft = mouseX * scale - (e.clientX - rect.left);
      wrapper.scrollTop = mouseY * scale - (e.clientY - rect.top);

      setZoomRaw(newZoom);
    };
    wrapper.addEventListener("wheel", handler, { passive: false });
    return () => wrapper.removeEventListener("wheel", handler);
  }, [setZoomRaw]);

  // Auto-activate first page if none active
  useEffect(() => {
    if (!activePageId && pages.length > 0) {
      setActiveCanvas(pages[0].id);
    }
  }, [pages, activePageId, setActiveCanvas]);

  // Auto-focus rename input
  useEffect(() => {
    if (renamingId && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renamingId]);

  const startRename = (pageId: string, currentTitle: string) => {
    setRenamingId(pageId);
    setRenameValue(currentTitle);
  };

  const finishRename = () => {
    if (renamingId && renameValue.trim()) {
      renamePage(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  // Inverse scale for page headers so they don't zoom
  const inverseScale = 1 / zoom;

  return (
    <div
      ref={wrapperRef}
      class="flex-1 overflow-auto bg-canvas"
    >
      {/* Spacer div — its dimensions match the visual (scaled) size so overflow scrollbars work */}
      <div
        style={{
          width: Math.max((canvasWidth + 80) * zoom, wrapperRef.current?.clientWidth ?? 0),
          minHeight: "100%",
          display: "flex",
          justifyContent: "center",
        }}
      >
      <div
        class="flex flex-col items-center"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "center top",
          padding: "40px 40px 80px",
        }}
      >
        {pages.map((page) => (
          <div
            key={page.id}
            class="mb-10"
            data-page-id={page.id}
            ref={(el) => {
              if (el) pageRefs.current.set(page.id, el);
            }}
          >
            {/* Page header — inverse scaled to stay fixed size */}
            <div
              style={{
                height: 32 * inverseScale,
                marginBottom: 4 * inverseScale,
              }}
            >
            <div
              class="group/header flex items-center justify-between py-1.5"
              style={{
                transform: `scale(${inverseScale})`,
                transformOrigin: "left top",
                width: canvasWidth * zoom,
                height: 32,
              }}
            >
              {/* Title — click to rename */}
              <div class="flex items-center gap-1.5">
                {renamingId === page.id ? (
                  <input
                    ref={renameRef}
                    class="field h-6 w-[8.75rem] px-1.5 text-label"
                    value={renameValue}
                    onInput={(e) => setRenameValue((e.target as HTMLInputElement).value)}
                    onBlur={finishRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") finishRename();
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                  />
                ) : (
                  <span
                    class="text-label text-muted cursor-text hover:text-foreground"
                    onClick={() => startRename(page.id, page.title)}
                  >
                    {page.title}
                  </span>
                )}
              </div>

              {/* Action icons — visible on hover */}
              <div class="flex items-center gap-0.5">
                <button
                  class="btn btn-ghost btn-icon"
                  onClick={() => addPage(page.id)}
                  title="Add page below"
                  aria-label="Add page below"
                >
                  <Plus size={14} />
                </button>
                <button
                  class="btn btn-ghost btn-icon"
                  onClick={() => duplicatePage(page.id)}
                  title="Duplicate page"
                  aria-label="Duplicate page"
                >
                  <Copy size={14} />
                </button>
                {pages.length > 1 && (
                  <button
                    class="btn btn-ghost btn-icon is-danger"
                    onClick={() => deletePage(page.id)}
                    title="Delete page"
                    aria-label="Delete page"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            </div>

            {/* Canvas */}
            <PageCanvas
              page={page}
              isActive={page.id === activePageId}
              width={canvasWidth}
              height={canvasHeight}
              onActivate={() => setActiveCanvas(page.id)}
            />
          </div>
        ))}

        {/* Add page button — inverse scaled */}
        <div style={{ height: 40 * inverseScale }}>
          <div
            style={{
              transform: `scale(${inverseScale})`,
              transformOrigin: "center top",
              height: 40,
            }}
          >
            <button
              class="dropzone border-faint flex items-center gap-1.5 h-7 px-3 rounded-sm text-label"
              onClick={() => addPage()}
            >
              <Plus size={14} />
              Add page
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
