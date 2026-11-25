import { useState, useRef, useEffect } from "preact/hooks";
import * as fabric from "fabric";
import { Plus, MoreHorizontal, Copy, Trash2, Pencil, ChevronUp, ChevronDown } from "lucide-preact";
import { useEditor } from "../context";
import type { Page } from "../types";

function PageThumb({ page, width, height }: { page: Page; width: number; height: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const prevJsonRef = useRef<string>("");

  useEffect(() => {
    if (page.canvas_json === prevJsonRef.current) return;
    prevJsonRef.current = page.canvas_json;

    const el = document.createElement("canvas");
    const sc = new fabric.StaticCanvas(el, { width, height });
    try {
      const parsed = JSON.parse(page.canvas_json);
      sc.loadFromJSON(parsed).then(() => {
        sc.renderAll();
        const multiplier = Math.min(200 / width, 200 / height, 1);
        setSrc(sc.toDataURL({ format: "png", multiplier }));
        sc.dispose();
      });
    } catch {
      sc.dispose();
    }
  }, [page.canvas_json, width, height]);

  return src ? (
    <img src={src} class="rounded-xs w-full h-full object-cover" alt={page.title} />
  ) : (
    <div class="rounded-xs w-full h-full bg-surface-sunken" />
  );
}

export function PagesBar() {
  const {
    pages, activePageId, addPage, duplicatePage, deletePage, renamePage,
    switchToPage, setActiveCanvas, canvasWidth, canvasHeight,
  } = useEditor();
  const [expanded, setExpanded] = useState(false);
  const [menuPageId, setMenuPageId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuPageId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuPageId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuPageId]);

  // Auto-focus rename input
  useEffect(() => {
    if (renamingId && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renamingId]);

  const startRename = (pageId: string, currentTitle: string) => {
    setMenuPageId(null);
    setRenamingId(pageId);
    setRenameValue(currentTitle);
  };

  const finishRename = () => {
    if (renamingId && renameValue.trim()) {
      renamePage(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handlePageClick = (pageId: string) => {
    setActiveCanvas(pageId);
    switchToPage(pageId);
    const pageEl = document.querySelector(`[data-page-id="${pageId}"]`);
    if (pageEl) pageEl.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (pages.length === 0) return null;

  return (
    <div class="bg-surface border-t border-border shrink-0">
      {/* Collapsed bar — always visible */}
      <button
        class="w-full h-8 flex items-center justify-between px-4 bg-transparent border-none cursor-pointer hover:bg-surface-sunken"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        <span class="text-label text-muted">
          Pages ({pages.length})
        </span>
        {expanded ? (
          <ChevronDown size={14} class="text-muted" />
        ) : (
          <ChevronUp size={14} class="text-muted" />
        )}
      </button>

      {/* Expanded thumbnail strip */}
      {expanded && (
        <div class="flex items-start gap-2 px-4 py-2 border-t border-border overflow-x-auto">
          {pages.map((page) => {
            const isActive = page.id === activePageId;
            return (
              <div key={page.id} class="relative flex-shrink-0 group">
                <div
                  class={`relative flex flex-col items-center gap-1 cursor-pointer rounded-sm p-1 ${
                    isActive ? "bg-surface-sunken outline-2 outline-selection" : "hover:bg-surface-sunken"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => handlePageClick(page.id)}
                  style={{ width: 88 }}
                >
                  <div class="rounded w-full overflow-hidden" style={{ height: 50 }}>
                    <PageThumb page={page} width={canvasWidth} height={canvasHeight} />
                  </div>
                  <button
                    class="absolute top-1 right-1 p-0.5 rounded-xs bg-surface/90 border-none cursor-pointer opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-surface-sunken"
                    data-hover-only
                    aria-label="Page options"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuPageId(menuPageId === page.id ? null : page.id);
                    }}
                  >
                    <MoreHorizontal size={14} class="text-muted" />
                  </button>
                </div>
                <div class="mt-0.5 text-center" style={{ width: 88 }}>
                  {renamingId === page.id ? (
                    <input
                      ref={renameRef}
                      class="field h-6 px-1 text-center text-fine"
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
                      class={`text-fine truncate block ${isActive ? "text-foreground font-medium" : "text-muted"}`}
                    >
                      {page.title}
                    </span>
                  )}
                </div>

                {menuPageId === page.id && (
                  <div
                    ref={menuRef}
                    class="menu absolute bottom-full left-0 mb-1 z-30 min-w-[9rem]"
                  >
                    <button
                      class="menu-item"
                      onClick={() => startRename(page.id, page.title)}
                    >
                      <Pencil size={14} />
                      Rename
                    </button>
                    <button
                      class="menu-item"
                      onClick={() => {
                        setMenuPageId(null);
                        duplicatePage(page.id);
                      }}
                    >
                      <Copy size={14} />
                      Duplicate
                    </button>
                    {pages.length > 1 && (
                      <button
                        class="menu-item is-danger"
                        onClick={() => {
                          setMenuPageId(null);
                          deletePage(page.id);
                        }}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Built like a page (a tile, then its name) so its top and its label
              line up with the pages beside it. The tile is a page tile's size:
              88px wide, a 50px thumbnail plus 4px padding above and below. */}
          <button
            class="group flex-shrink-0 flex flex-col p-0 bg-transparent border-none cursor-pointer"
            onClick={() => addPage()}
          >
            <span class="dropzone flex items-center justify-center rounded-sm group-hover:bg-surface-sunken group-hover:text-foreground" style={{ width: 88, height: 58 }}>
              <Plus size={16} />
            </span>
            <span class="mt-0.5 text-fine text-muted text-center group-hover:text-foreground" style={{ width: 88 }}>
              Add page
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
