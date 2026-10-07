import { useState, useCallback, useRef, useEffect } from "preact/hooks";
import type { Design, DesignWithPages, Template, Page } from "../types";
import type { Dimensions } from "../resize";
import { api } from "../api";

export function useDesigns(
  getCanvasJSONForPage: (pageId: string) => string,
  getCanvasSize: () => Dimensions
) {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeDesign, setActiveDesign] = useState<Design | null>(null);
  const [loadedDesignId, setLoadedDesignId] = useState<string | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const pagesRef = useRef<Page[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "pending" | "saving" | "error">("saved");
  const [autoSave, setAutoSaveState] = useState(() => {
    try {
      return localStorage.getItem("opendesign:auto-save") === "true";
    } catch {
      return false; // storage blocked (private window, sandboxed iframe)
    }
  });
  const activeIdRef = useRef<string | null>(null);
  const activePageIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const designLoadRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const updatePages = useCallback((next: Page[] | ((pages: Page[]) => Page[])) => {
    const updated = typeof next === "function" ? next(pagesRef.current) : next;
    pagesRef.current = updated;
    setPages(updated);
  }, []);

  // Keep activePageIdRef in sync
  useEffect(() => {
    activePageIdRef.current = activePageId;
  }, [activePageId]);

  // Load designs + templates on mount
  useEffect(() => {
    (async () => {
      try {
        const [d, t] = await Promise.all([
          api<Design[]>("GET", "/api/designs"),
          api<Template[]>("GET", "/api/templates"),
        ]);
        setDesigns(d);
        setTemplates(t);
      } catch (e) {
        console.error("Failed to load data:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveNow = useCallback(async () => {
    const designId = activeIdRef.current;
    if (!designId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const { width, height } = getCanvasSize();
    setSaving(true);
    if (activeIdRef.current === designId) setSaveStatus("saving");
    try {
      // Snapshot the active design before awaiting; navigation may switch canvases mid-save.
      const snapshots = pagesRef.current
        .filter((page) => page.design_id === designId)
        .map((page) => ({ page, json: getCanvasJSONForPage(page.id) }))
        .filter(({ json }) => json && json !== "{}");
      for (const { page, json } of snapshots) {
        if (!pagesRef.current.some((current) => current.id === page.id)) continue;
        try {
          const updatedPage = await api<Page>("PUT", `/api/pages/${page.id}`, { canvas_json: json });
          updatePages((prev) => prev.map((p) => (p.id === updatedPage.id ? updatedPage : p)));
        } catch (e) {
          // A page deleted while this save was in flight is already safely gone.
          if (!(e instanceof Error && e.message === "Not found")) throw e;
        }
      }
      // Also update design's canvas_json with first page for backwards compat
      const firstPage = activeIdRef.current === designId
        ? pagesRef.current.find((page) => page.design_id === designId)
        : undefined;
      const firstSavedPage = firstPage
        ? snapshots.find(({ page }) => page.id === firstPage.id) ?? snapshots[0]
        : snapshots[0];
      const firstPageJson = firstSavedPage?.json || firstSavedPage?.page.canvas_json || firstPage?.canvas_json || "{}";
      // The frame is part of the design: without it a resized design reopens
      // at its old dimensions with artwork scaled for the new ones.
      const updated = await api<Design>("PUT", `/api/designs/${designId}`, {
        canvas_json: firstPageJson,
        width,
        height,
      });
      setDesigns((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      if (activeIdRef.current === designId) {
        setActiveDesign(updated);
        setSaveStatus("saved");
      }
    } catch (e) {
      console.error("Failed to save:", e);
      if (activeIdRef.current === designId) setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }, [getCanvasJSONForPage, getCanvasSize, updatePages]);

  // One save at a time. Two overlapping saves can land their page writes out
  // of order, and the older snapshot would overwrite the newer one.
  const saveDesign = useCallback(() => {
    const run = saveQueueRef.current.then(saveNow);
    saveQueueRef.current = run;
    return run;
  }, [saveNow]);

  const createDesign = useCallback(async (): Promise<string | undefined> => {
    try {
      const d = await api<Design>("POST", "/api/designs", {
        name: "Untitled Design",
        canvas_json: "{}",
      });
      setDesigns((prev) => [d, ...prev]);
      return d.id;
    } catch (e) {
      console.error("Failed to create design:", e);
    }
  }, []);

  const createFromTemplate = useCallback(async (template: Template): Promise<string | undefined> => {
    try {
      const d = await api<Design>("POST", "/api/designs", {
        name: template.name,
        canvas_json: template.canvas_json,
        width: template.width,
        height: template.height,
      });
      setDesigns((prev) => [d, ...prev]);
      return d.id;
    } catch (e) {
      console.error("Failed to create from template:", e);
    }
  }, []);

  const loadDesign = useCallback(
    async (id: string) => {
      const request = ++designLoadRef.current;
      try {
        const d = await api<DesignWithPages>("GET", `/api/designs/${id}`);
        if (request !== designLoadRef.current) return;
        updatePages(d.pages);
        setActiveDesign(d);
        activeIdRef.current = d.id;
        setLoadedDesignId(d.id);
        if (d.pages.length > 0) {
          setActivePageId(d.pages[0].id);
        } else {
          setActivePageId(null);
        }
      } catch (e) {
        console.error("Failed to load design:", e);
      }
    },
    [updatePages]
  );

  const deleteDesign = useCallback(async (id: string) => {
    try {
      await api<{ ok: boolean }>("DELETE", `/api/designs/${id}`);
      setDesigns((prev) => prev.filter((d) => d.id !== id));
      if (activeIdRef.current === id) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        setActiveDesign(null);
        activeIdRef.current = null;
        setLoadedDesignId(null);
        updatePages([]);
      }
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  }, [updatePages]);

  const renameDesign = useCallback(async (id: string, name: string) => {
    try {
      const updated = await api<Design>("PUT", `/api/designs/${id}`, { name });
      setDesigns((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      if (activeIdRef.current === id) setActiveDesign(updated);
    } catch (e) {
      console.error("Failed to rename:", e);
    }
  }, []);

  // ── Page management ─────────────────────────────────────────────────

  const addPage = useCallback(async (afterPageId?: string) => {
    if (!activeIdRef.current) return;
    try {
      const body: Record<string, unknown> = {};
      if (afterPageId) {
        const afterPage = pages.find((p) => p.id === afterPageId);
        if (afterPage) body.after_sort_order = afterPage.sort_order;
      }
      const page = await api<Page>("POST", `/api/designs/${activeIdRef.current}/pages`, body);
      // Re-fetch all pages to get correct sort_order after shifts
      const d = await api<DesignWithPages>("GET", `/api/designs/${activeIdRef.current}`);
      updatePages(d.pages);
      setActivePageId(page.id);
    } catch (e) {
      console.error("Failed to add page:", e);
    }
  }, [pages, updatePages]);

  const duplicatePage = useCallback(
    async (pageId: string) => {
      // Save current canvas state for the page being duplicated
      const json = getCanvasJSONForPage(pageId);
      if (json && json !== "{}") {
        try {
          await api<Page>("PUT", `/api/pages/${pageId}`, { canvas_json: json });
        } catch {
          // best effort
        }
      }
      try {
        const page = await api<Page>("POST", `/api/pages/${pageId}/duplicate`, {});
        // Re-fetch all pages to get correct sort_order
        if (activeIdRef.current) {
          const d = await api<DesignWithPages>("GET", `/api/designs/${activeIdRef.current}`);
          updatePages(d.pages);
        }
        setActivePageId(page.id);
      } catch (e) {
        console.error("Failed to duplicate page:", e);
      }
    },
    [getCanvasJSONForPage, updatePages]
  );

  const deletePage = useCallback(
    async (pageId: string) => {
      try {
        await api<{ ok: boolean }>("DELETE", `/api/pages/${pageId}`);
        const remaining = pagesRef.current.filter((p) => p.id !== pageId);
        updatePages(remaining);
        if (activePageIdRef.current === pageId && remaining.length > 0) {
          setActivePageId(remaining[0].id);
        }
      } catch (e) {
        console.error("Failed to delete page:", e);
      }
    },
    [pages, updatePages]
  );

  const renamePage = useCallback(async (pageId: string, title: string) => {
    try {
      const updated = await api<Page>("PUT", `/api/pages/${pageId}`, { title });
      updatePages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (e) {
      console.error("Failed to rename page:", e);
    }
  }, [updatePages]);

  // switchToPage is now just scrolling + activating — handled by CanvasArea/PagesBar
  const switchToPage = useCallback((pageId: string) => {
    setActivePageId(pageId);
  }, []);

  const activePage = pages.find((p) => p.id === activePageId) ?? null;

  // Auto-save debounced
  const scheduleSave = useCallback(() => {
    if (!autoSave || !activeIdRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("pending");
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void saveDesign();
    }, 800);
  }, [autoSave, saveDesign]);

  const setAutoSave = useCallback((enabled: boolean) => {
    try {
      localStorage.setItem("opendesign:auto-save", String(enabled));
    } catch {
      // storage blocked: the choice lasts for this session only
    }
    setAutoSaveState(enabled);
    if (!enabled && saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  return {
    designs,
    templates,
    activeDesign,
    loadedDesignId,
    setActiveDesign,
    activeIdRef,
    loading,
    saving,
    saveStatus,
    autoSave,
    setAutoSave,
    createDesign,
    createFromTemplate,
    loadDesign,
    saveDesign,
    deleteDesign,
    renameDesign,
    scheduleSave,
    // Pages
    pages,
    activePageId,
    activePage,
    addPage,
    duplicatePage,
    deletePage,
    renamePage,
    switchToPage,
  };
}
