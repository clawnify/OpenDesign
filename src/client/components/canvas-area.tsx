import { useRef, useEffect, useLayoutEffect, useState } from "preact/hooks";
import { Plus, Copy, Trash2 } from "lucide-preact";
import { useEditor } from "../context";
import { PageCanvas } from "./page-canvas";

const SIDE_GUTTER = 24;
const VERTICAL_GUTTER = 64; // Room for the page title and Add page button.
const PAGE_HEADER_HEIGHT = 36;

export function CanvasArea() {
  const {
    pageView, pages, activePageId, loadedDesignId, canvas, setActiveCanvas, canvasWidth, canvasHeight,
    zoom, zoomToFit, setZoomRaw, setFitScale, fitScale, addPage, duplicatePage, deletePage, renamePage,
  } = useEditor();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragRef = useRef<{ id: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);
  const zoomAnchor = useRef<{ canvas: HTMLCanvasElement; x: number; y: number; u: number; v: number } | null>(null);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const measure = () => {
      const { clientWidth, clientHeight } = wrapper;
      const availableWidth = Math.max(1, clientWidth - 2 * SIDE_GUTTER);
      const availableHeight = Math.max(1, clientHeight - 2 * VERTICAL_GUTTER);
      setFitScale(Math.min(availableWidth / canvasWidth, availableHeight / canvasHeight, 1));
      setViewportHeight(clientHeight);
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(wrapper);
    return () => obs.disconnect();
  }, [canvasWidth, canvasHeight, setFitScale]);

  useLayoutEffect(() => {
    zoomToFit();
    setPan({ x: 0, y: 0 });
    wrapperRef.current?.scrollTo(0, 0);
  }, [loadedDesignId, canvasWidth, canvasHeight, zoomToFit]);

  // Cmd+wheel zoom towards mouse position
  useLayoutEffect(() => {
    const anchor = zoomAnchor.current;
    const wrapper = wrapperRef.current;
    zoomAnchor.current = null;
    if (!anchor || !wrapper?.contains(anchor.canvas)) return;
    const rect = anchor.canvas.getBoundingClientRect();
    wrapper.scrollLeft += rect.left + rect.width * anchor.u - anchor.x;
    wrapper.scrollTop += rect.top + rect.height * anchor.v - anchor.y;
  }, [zoom]);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const handler = (e: WheelEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.95 : 1.05;
      const newZoom = Math.min(Math.max(zoom * factor, Math.min(fitScale, 0.05)), 3);
      if (newZoom === zoom) return;
      const page = (e.target as Element).closest("[data-page-id]");
      const canvas = page?.querySelector<HTMLCanvasElement>(".upper-canvas")
        ?? wrapper.querySelector<HTMLCanvasElement>(".upper-canvas");
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        zoomAnchor.current = {
          canvas,
          x: e.clientX,
          y: e.clientY,
          u: (e.clientX - rect.left) / rect.width,
          v: (e.clientY - rect.top) / rect.height,
        };
      }
      setZoomRaw(newZoom);
    };
    wrapper.addEventListener("wheel", handler, { passive: false });
    return () => wrapper.removeEventListener("wheel", handler);
  }, [zoom, fitScale, setZoomRaw]);

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

  const pageWidth = canvasWidth * zoom;
  const pageHeight = canvasHeight * zoom;
  const topPadding = Math.max(SIDE_GUTTER, (viewportHeight - pageHeight) / 2 - PAGE_HEADER_HEIGHT);

  return (
    <div
      ref={wrapperRef}
      class="min-h-0 flex-1 overflow-auto bg-canvas"
      style={{ cursor: isPanning ? "grabbing" : "grab" }}
      onPointerDown={(event) => {
        if (event.button !== 0 || (event.target as Element).closest("[data-page-id], button, input")) return;
        canvas?.discardActiveObject();
        canvas?.requestRenderAll();
        dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
        setIsPanning(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.id !== event.pointerId) return;
        setPan({ x: drag.panX + event.clientX - drag.x, y: drag.panY + event.clientY - drag.y });
      }}
      onPointerUp={(event) => {
        if (dragRef.current?.id === event.pointerId) {
          dragRef.current = null;
          setIsPanning(false);
        }
      }}
      onPointerCancel={() => { dragRef.current = null; setIsPanning(false); }}
      onLostPointerCapture={() => { dragRef.current = null; setIsPanning(false); }}
    >
      <div
        class="flex flex-col items-center gap-4 pb-4"
        style={{ width: `max(100%, ${pageWidth + 2 * SIDE_GUTTER}px)`, paddingTop: topPadding, transform: `translate(${pan.x}px, ${pan.y}px)` }}
      >
        {pages.map((page) => (
          <div key={page.id} data-page-id={page.id} style={{ width: Math.max(pageWidth, 128), maxWidth: "100%", cursor: "default" }}>
            <div class="flex h-8 items-center justify-between gap-1">
              {/* Title — click to rename */}
              <div class="flex min-w-0 items-center gap-1.5">
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
                    class="cursor-text truncate text-label text-muted hover:text-foreground"
                    onClick={() => startRename(page.id, page.title)}
                  >
                    {page.title}
                  </span>
                )}
              </div>

              {/* Action icons — visible on hover */}
              <div class="flex shrink-0 items-center gap-0.5">
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
            {/* Only the scaled drawing contributes to the scrollable size. */}
            <div
              class={`relative mx-auto mt-1 overflow-clip ring-1 ring-border ${page.id === activePageId ? "outline-2 outline-offset-4 outline-selection" : ""}`}
              style={{ width: pageWidth, height: pageHeight }}
            >
              <div class="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${zoom})` }}>
                <PageCanvas
                  key={pageView(page.id)?.key ?? 0}
                  page={page}
                  width={canvasWidth}
                  height={canvasHeight}
                  scrollAreaRef={wrapperRef}
                  onActivate={() => setActiveCanvas(page.id)}
                />
              </div>
            </div>

          </div>
        ))}

        <button
          class="dropzone border-faint flex items-center gap-1.5 h-7 px-3 rounded-sm text-label"
          onClick={() => addPage()}
        >
          <Plus size={14} />
          Add page
        </button>
      </div>
    </div>
  );
}
