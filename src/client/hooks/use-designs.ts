import { useState, useCallback, useRef, useEffect } from "preact/hooks";
import type { Design, DesignWithPages, Template, Page } from "../types";
import { newPageCanvas } from "../../shared/page-background";
import type { Dimensions } from "../resize";
import { useCollaborativePages } from "./use-collaborative-pages";
import { api } from "../api";

export function useDesigns(
  getCanvasJSONForPage: (pageId: string) => string,
  getCanvasSize: () => Dimensions,
  applyRemoteMove: (id: string, before: string, after: string) => boolean,
) {
  const collaboration = useCollaborativePages(getCanvasJSONForPage, applyRemoteMove);
  const collabRef = useRef(collaboration);
  collabRef.current = collaboration;
  const frameRef = useRef({width: 0, height: 0});
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
      for (const page of pagesRef.current.filter(item => item.design_id === designId)) {
        if (!pagesRef.current.some((current) => current.id === page.id)) continue;
        const updatedPage = await collabRef.current.save(page);
        updatePages(prev => prev.map(p => p.id === updatedPage.id ? updatedPage : p));
      }
      // The frame is part of the design: without it a resized design reopens
      // at its old dimensions with artwork scaled for the new ones.
      if (activeIdRef.current === designId && (width !== frameRef.current.width || height !== frameRef.current.height)) {
        const updated = await api<Design>("PUT", `/api/designs/${designId}`, {width, height});
        setDesigns(prev => prev.map(d => d.id === updated.id ? updated : d));
        if (activeIdRef.current === designId) {frameRef.current = {width,height}; setActiveDesign(updated);}
      }
      if (activeIdRef.current === designId && !saveTimerRef.current) {
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
      });
      setDesigns((prev) => [d, ...prev]);
      return d.id;
    } catch (e) {
      console.error("Failed to create design:", e);
    }
  }, []);

  const createFromTemplate = useCallback(async (template: Template): Promise<string | undefined> => {
    try {
      if (template.design_id) {
        // One of your own designs: copy every page, fields and all. A fill with
        // no values and save: true is exactly that copy.
        const copy = await api<{ design: Design }>("POST", `/api/designs/${template.design_id}/fill`, {
          values: {},
          save: true,
          name: template.name,
        });
        setDesigns((prev) => [copy.design, ...prev]);
        return copy.design.id;
      }
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
        collabRef.current.reset();
        frameRef.current = {width: d.width, height: d.height};
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

  /** Offer a design as a template to start from, or stop offering it. */
  const setDesignTemplate = useCallback(async (id: string, on: boolean) => {
    try {
      // The template is the design as saved, so save what is on screen first.
      if (on && activeIdRef.current === id) await saveDesign();
      const updated = await api<Design>("PUT", `/api/designs/${id}`, { is_template: on });
      setDesigns((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      if (activeIdRef.current === id) setActiveDesign(updated);
      setTemplates(await api<Template[]>("GET", "/api/templates"));
    } catch (e) {
      console.error("Failed to change the template setting:", e);
    }
  }, [saveDesign]);

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
      const previous = afterPageId ? pages.find(p => p.id === afterPageId) : pages.at(-1);
      if (previous) {
        if (afterPageId) body.after_sort_order = previous.sort_order;
        const draft = collabRef.current.draft(previous.id);
        if (draft && draft.json !== draft.base.saved) {
          body.canvas_json = newPageCanvas(draft.json, getCanvasSize());
        }
      }
      const page = await api<Page>("POST", `/api/designs/${activeIdRef.current}/pages`, body);
      // Re-fetch all pages to get correct sort_order after shifts
      const d = await api<DesignWithPages>("GET", `/api/designs/${activeIdRef.current}`);
      updatePages(d.pages);
      setActivePageId(page.id);
    } catch (e) {
      console.error("Failed to add page:", e);
    }
  }, [pages, getCanvasSize, updatePages]);

  const duplicatePage = useCallback(
    async (pageId: string) => {
      // Save current canvas state for the page being duplicated
      const original = pagesRef.current.find(p => p.id === pageId);
      if (!original) return;
      const json = getCanvasJSONForPage(pageId);
      if (json && json !== "{}") {
        try {
          await collabRef.current.save(original);
        } catch {
          return;
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
  const scheduleSave = useCallback((immediate = false) => {
    if (!activeIdRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("pending");
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void saveDesign();
    }, immediate ? 0 : 800);
  }, [saveDesign]);

  const refresh = useCallback(() => {
    const id = activeIdRef.current;
    if (!id) return;
    const session = designLoadRef.current;
    const task = async () => {
      if (activeIdRef.current !== id || session !== designLoadRef.current) return;
      const next = await api<DesignWithPages>("GET", "/api/designs/" + id);
      if (activeIdRef.current !== id || session !== designLoadRef.current) return;
      for (const page of next.pages) collabRef.current.receive(page);
      const ids = new Set(next.pages.map(page => page.id));
      const recoverable = pagesRef.current.filter(page => !ids.has(page.id) && collabRef.current.removed(page));
      updatePages([...next.pages, ...recoverable]);
    };
    saveQueueRef.current = saveQueueRef.current.then(task).catch(error => console.error("Failed to refresh design", error));
  }, [updatePages]);

  async function resolveConflict(choice: "mine" | "theirs") {
    const conflict = collaboration.conflict;
    if (!conflict) return;
    if (conflict.removed) {
      const old = conflict.page;
      try {
        const recovered = choice === "mine" ? await api<Page>("POST", "/api/designs/" + old.design_id + "/pages", {
          title: old.title + " (recovered)", canvas_json: collaboration.draft(old.id)?.json ?? conflict.local,
        }) : null;
        if (activeIdRef.current !== old.design_id) return;
        updatePages(prev => [...prev.filter(p => p.id !== old.id), ...(recovered ? [recovered] : [])]);
        collaboration.showConflict(null);
        setSaveStatus("saved");
      } catch { setSaveStatus("error"); }
      return;
    }
    collaboration.receive(conflict.page, choice);
    updatePages(prev => prev.map(p => p.id === conflict.page.id ? conflict.page : p));
    scheduleSave();
  }
  return {
    pageView: collaboration.view,
    canvasReady: collaboration.ready,
    conflict: collaboration.conflict,
    resolveConflict,
    refresh,
    designs,
    templates,
    activeDesign,
    loadedDesignId,
    setActiveDesign,
    activeIdRef,
    loading,
    saving,
    saveStatus,
    createDesign,
    createFromTemplate,
    loadDesign,
    saveDesign,
    deleteDesign,
    renameDesign,
    setDesignTemplate,
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
