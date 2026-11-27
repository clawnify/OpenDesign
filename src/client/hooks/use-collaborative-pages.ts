import {useCallback, useRef, useState} from "preact/hooks";
import {documentSaved} from "@clawnify/app/client";
import {mergeCanvas, readCanvas} from "../../shared/canvas-merge";
import {api, ApiError} from "../api";
import type {Page} from "../types";

interface Base { rendered: string; draft: string; saved: string }
interface Conflict { page: Page; layers: string[]; local: string; removed?: boolean }
interface View { key: number; json: string }

/** Fabric adds defaults when it loads a compact canvas. Diff against the actual
 * rendered baseline, then replay just the user's edits on the stored artwork. */
export function useCollaborativePages(getCanvas: (id: string) => string,
  applyMove: (id: string, before: string, after: string) => boolean) {
  const bases = useRef(new Map<string, Base>());
  const views = useRef(new Map<string, View>());
  const [version, setVersion] = useState(0);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const pending = useRef<Conflict | null>(null);
  function showConflict(value: Conflict | null) {
    pending.current = value;
    setConflict(value);
  }
  const ready = useCallback((page: Page, rendered: string, draft: string) => {
    bases.current.set(page.id, {rendered, draft, saved: page.canvas_json});
  }, []);

  function draft(id: string) {
    const base = bases.current.get(id);
    const rendered = getCanvas(id);
    if (!base || rendered === "{}") return null;
    const json = rendered === base.rendered ? base.draft :
      mergeCanvas(base.rendered, rendered, base.draft, "mine").json;
    return {base, rendered, json};
  }

  function stage(page: Page, json: string, previous: string) {
    if (applyMove(page.id, previous, json)) {
      ready(page, getCanvas(page.id), json);
      return;
    }
    bases.current.delete(page.id);
    views.current.set(page.id, {key: (views.current.get(page.id)?.key ?? 0) + 1, json});
    setVersion(n => n + 1);
  }
  function receive(page: Page, resolve?: "mine" | "theirs") {
    const local = draft(page.id);
    if (!local || local.base.saved === page.canvas_json) return;
    const result = mergeCanvas(local.base.saved, local.json, page.canvas_json, resolve);
    if (result.conflicts.length && !resolve) {
      if (!pending.current || pending.current.page.id === page.id) showConflict({page, layers: result.conflicts, local: local.json});
      return;
    }
    stage(page, result.json, local.json);
    if (pending.current?.page.id === page.id) showConflict(null);
  }
  async function save(page: Page) {
    if (pending.current?.page.id === page.id) throw Error("Choose which layer changes to keep.");
    const local = draft(page.id);
    if (!local || local.json === local.base.saved) return page;
    let updated;
    try {
      updated = await api<Page>("PUT", "/api/pages/" + page.id, {base_canvas_json: local.base.saved, canvas_json: local.json});
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && error.data.current)
        showConflict({page: error.data.current, layers: error.data.conflicts, local: local.json});
      if (error instanceof ApiError && error.status === 404) removed(page);
      throw error;
    }
    documentSaved(page.design_id);
    if (bases.current.get(page.id) !== local.base) return updated;
    // A keystroke or drag can complete while the save is crossing the network.
    const now = draft(page.id);
    if (!now) return updated;
    const incoming = mergeCanvas(local.json, now.json, updated.canvas_json);
    if (incoming.conflicts.length) {
      showConflict({page: updated, layers: incoming.conflicts, local: now.json});
    } else if (JSON.stringify(readCanvas(local.json)) !== JSON.stringify(readCanvas(updated.canvas_json))) {
      stage(updated, incoming.json, now.json);
    } else {
      bases.current.set(page.id, {rendered: local.rendered, draft: updated.canvas_json, saved: updated.canvas_json});
    }
    return updated;
  }
  function removed(page: Page) {
    const local = draft(page.id);
    if (!local || local.json === local.base.saved) return false;
    if (!pending.current || pending.current.page.id === page.id)
      showConflict({page, layers: [], local: local.json, removed: true});
    return true;
  }
  const reset = useCallback(() => {
    bases.current.clear();
    views.current.clear();
    showConflict(null);
  }, []);
  return {ready, save, receive, conflict, reset, removed, draft, showConflict, view: (id: string) => views.current.get(id), version};
}
