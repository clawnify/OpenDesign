import { useState, useCallback, useRef, useEffect } from "preact/hooks";
import * as fabric from "fabric";
import type { Template } from "../types";
import { reflowCanvas, type Dimensions } from "../resize";

const MAX_HISTORY = 50;

const TEXT_PRESETS = {
  heading: { text: "Add a heading", fontSize: 48, fontWeight: "700", fontFamily: "Montserrat" },
  subheading: { text: "Add a subheading", fontSize: 32, fontWeight: "500", fontFamily: "Inter" },
  body: { text: "Add body text", fontSize: 18, fontWeight: "400", fontFamily: "Inter" },
} as const;

const SHAPE_DEFAULTS = {
  fill: "#6366f1",
  stroke: "",
  strokeWidth: 0,
  opacity: 1,
};

interface CanvasHistory {
  entries: string[];
  index: number;
}

export function useCanvasState() {
  const canvasMapRef = useRef<Map<string, fabric.Canvas>>(new Map());
  const historyMapRef = useRef<Map<string, CanvasHistory>>(new Map());
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null);
  const activeCanvasIdRef = useRef<string | null>(null);
  const [selectedObject, setSelectedObject] = useState<fabric.FabricObject | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(1080);
  const [canvasHeight, setCanvasHeight] = useState(1080);
  const canvasWidthRef = useRef(1080);
  const canvasHeightRef = useRef(1080);
  // A resize spans every page at once, so it cannot be expressed in the
  // per-page undo stacks. It gets one snapshot of its own instead.
  const resizeSnapshotRef = useRef<
    { width: number; height: number; pages: Map<string, string> } | null
  >(null);
  const [canUndoResize, setCanUndoResize] = useState(false);
  const [zoom, setZoom] = useState(0.58);
  const [fitScale, setFitScale] = useState(0.58);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const isRestoringRef = useRef<Set<string>>(new Set());

  // Helper to get the active canvas
  const getActiveCanvas = useCallback((): fabric.Canvas | null => {
    const id = activeCanvasIdRef.current;
    if (!id) return null;
    return canvasMapRef.current.get(id) ?? null;
  }, []);

  // Update undo/redo state for active canvas
  const updateUndoRedoState = useCallback((pageId: string) => {
    if (pageId !== activeCanvasIdRef.current) return;
    const hist = historyMapRef.current.get(pageId);
    if (!hist) {
      setCanUndo(false);
      setCanRedo(false);
      return;
    }
    setCanUndo(hist.index > 0);
    setCanRedo(hist.index < hist.entries.length - 1);
  }, []);

  const saveHistory = useCallback((pageId: string) => {
    if (isRestoringRef.current.has(pageId)) return;
    const canvas = canvasMapRef.current.get(pageId);
    if (!canvas) return;
    // An edit lands on top of the resize. Restoring the snapshot would now
    // throw this work away too, so the resize stops being undoable here.
    if (resizeSnapshotRef.current) {
      resizeSnapshotRef.current = null;
      setCanUndoResize(false);
    }
    const json = JSON.stringify(canvas.toJSON());
    let hist = historyMapRef.current.get(pageId);
    if (!hist) {
      hist = { entries: [], index: -1 };
      historyMapRef.current.set(pageId, hist);
    }
    // Truncate forward history
    hist.entries = hist.entries.slice(0, hist.index + 1);
    hist.entries.push(json);
    if (hist.entries.length > MAX_HISTORY) {
      hist.entries.shift();
    } else {
      hist.index = hist.entries.length - 1;
    }
    updateUndoRedoState(pageId);
  }, [updateUndoRedoState]);

  const registerCanvas = useCallback((pageId: string, canvas: fabric.Canvas) => {
    canvasMapRef.current.set(pageId, canvas);

    // Selection events
    canvas.on("selection:created", (e) => {
      if (activeCanvasIdRef.current === pageId) {
        setSelectedObject(e.selected?.[0] ?? null);
      }
    });
    canvas.on("selection:updated", (e) => {
      if (activeCanvasIdRef.current === pageId) {
        setSelectedObject(e.selected?.[0] ?? null);
      }
    });
    canvas.on("selection:cleared", () => {
      if (activeCanvasIdRef.current === pageId) {
        setSelectedObject(null);
      }
    });

    // History events
    canvas.on("object:added", () => saveHistory(pageId));
    canvas.on("object:modified", () => saveHistory(pageId));
    canvas.on("object:removed", () => saveHistory(pageId));

    // Initial history snapshot
    setTimeout(() => {
      const json = JSON.stringify(canvas.toJSON());
      historyMapRef.current.set(pageId, { entries: [json], index: 0 });
      updateUndoRedoState(pageId);
    }, 100);
  }, [saveHistory, updateUndoRedoState]);

  const unregisterCanvas = useCallback((pageId: string) => {
    canvasMapRef.current.delete(pageId);
    historyMapRef.current.delete(pageId);
    // The snapshot holds JSON keyed by page id. Once a page it captured is
    // gone -- page deleted, or the editor left for another design -- it can no
    // longer be restored onto the canvases that are actually mounted.
    if (resizeSnapshotRef.current?.pages.has(pageId)) {
      resizeSnapshotRef.current = null;
      setCanUndoResize(false);
    }
  }, []);

  const setActiveCanvas = useCallback((pageId: string) => {
    const prevId = activeCanvasIdRef.current;
    if (prevId === pageId) return;

    // Clear selection on previous canvas
    if (prevId) {
      const prevCanvas = canvasMapRef.current.get(prevId);
      if (prevCanvas) {
        prevCanvas.discardActiveObject();
        prevCanvas.requestRenderAll();
      }
    }

    activeCanvasIdRef.current = pageId;
    setActiveCanvasId(pageId);
    setSelectedObject(null);
    updateUndoRedoState(pageId);
  }, [updateUndoRedoState]);

  // ── Text ────────────────────────────────────────────────────────────

  const addText = useCallback(
    (preset: "heading" | "subheading" | "body") => {
      const canvas = getActiveCanvas();
      if (!canvas) return;
      const cfg = TEXT_PRESETS[preset];
      const text = new fabric.Textbox(cfg.text, {
        left: canvasWidth / 2 - 200,
        top: canvasHeight / 2 - 30,
        width: 400,
        fontSize: cfg.fontSize,
        fontWeight: cfg.fontWeight,
        fontFamily: cfg.fontFamily,
        fill: "#ffffff",
        textAlign: "center",
        editable: true,
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      canvas.requestRenderAll();
    },
    [getActiveCanvas, canvasWidth, canvasHeight]
  );

  // ── Shapes ──────────────────────────────────────────────────────────

  const addShape = useCallback(
    (type: "rect" | "circle" | "line" | "triangle") => {
      const canvas = getActiveCanvas();
      if (!canvas) return;
      let obj: fabric.FabricObject;
      const cx = canvasWidth / 2;
      const cy = canvasHeight / 2;

      switch (type) {
        case "rect":
          obj = new fabric.Rect({
            left: cx - 75,
            top: cy - 75,
            width: 150,
            height: 150,
            rx: 8,
            ry: 8,
            ...SHAPE_DEFAULTS,
          });
          break;
        case "circle":
          obj = new fabric.Circle({
            left: cx - 60,
            top: cy - 60,
            radius: 60,
            ...SHAPE_DEFAULTS,
          });
          break;
        case "triangle":
          obj = new fabric.Triangle({
            left: cx - 60,
            top: cy - 60,
            width: 120,
            height: 120,
            ...SHAPE_DEFAULTS,
          });
          break;
        case "line":
          obj = new fabric.Line([cx - 100, cy, cx + 100, cy], {
            stroke: "#6366f1",
            strokeWidth: 3,
            fill: "",
          });
          break;
        default:
          return;
      }
      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.requestRenderAll();
    },
    [getActiveCanvas, canvasWidth, canvasHeight]
  );

  // ── Images ──────────────────────────────────────────────────────────

  const addImage = useCallback(
    async (url: string) => {
      const canvas = getActiveCanvas();
      if (!canvas) return;
      try {
        const img = await fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" });
        const scale = Math.min(
          (canvasWidth * 0.6) / (img.width || 1),
          (canvasHeight * 0.6) / (img.height || 1),
          1
        );
        img.set({
          left: canvasWidth / 2 - ((img.width || 0) * scale) / 2,
          top: canvasHeight / 2 - ((img.height || 0) * scale) / 2,
          scaleX: scale,
          scaleY: scale,
        });
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.requestRenderAll();
      } catch (e) {
        console.error("Failed to load image:", e);
      }
    },
    [getActiveCanvas, canvasWidth, canvasHeight]
  );

  // ── Background ──────────────────────────────────────────────────────

  const setBackground = useCallback(
    (type: "color" | "gradient" | "image", value: string) => {
      const canvas = getActiveCanvas();
      const pageId = activeCanvasIdRef.current;
      if (!canvas || !pageId) return;
      if (type === "color" || type === "gradient") {
        canvas.backgroundColor = value;
        canvas.requestRenderAll();
        saveHistory(pageId);
      } else if (type === "image") {
        fabric.FabricImage.fromURL(value, { crossOrigin: "anonymous" }).then((img) => {
          const scaleX = canvasWidth / (img.width || 1);
          const scaleY = canvasHeight / (img.height || 1);
          img.set({ left: 0, top: 0, scaleX, scaleY, selectable: false, evented: false });
          const objects = canvas.getObjects();
          const bgObj = objects.find((o) => (o as any)._isBgImage);
          if (bgObj) canvas.remove(bgObj);
          (img as any)._isBgImage = true;
          canvas.add(img);
          canvas.sendObjectToBack(img);
          canvas.requestRenderAll();
          saveHistory(pageId);
        });
      }
    },
    [getActiveCanvas, canvasWidth, canvasHeight, saveHistory]
  );

  // ── Object manipulation ─────────────────────────────────────────────

  const updateSelectedObject = useCallback(
    (props: Record<string, unknown>) => {
      const canvas = getActiveCanvas();
      const pageId = activeCanvasIdRef.current;
      if (!canvas || !selectedObject || !pageId) return;
      selectedObject.set(props as Partial<fabric.FabricObject>);
      canvas.requestRenderAll();
      saveHistory(pageId);
      setSelectedObject({ ...selectedObject } as fabric.FabricObject);
    },
    [getActiveCanvas, selectedObject, saveHistory]
  );

  const deleteSelected = useCallback(() => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    if (active.length === 0) return;
    active.forEach((obj) => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }, [getActiveCanvas]);

  // ── Undo / Redo ─────────────────────────────────────────────────────

  const restoreFromHistory = useCallback(
    (index: number) => {
      const pageId = activeCanvasIdRef.current;
      const canvas = getActiveCanvas();
      if (!canvas || !pageId) return;
      const hist = historyMapRef.current.get(pageId);
      if (!hist || index < 0 || index >= hist.entries.length) return;
      isRestoringRef.current.add(pageId);
      hist.index = index;
      const json = hist.entries[index];
      canvas.loadFromJSON(JSON.parse(json)).then(() => {
        canvas.requestRenderAll();
        isRestoringRef.current.delete(pageId);
        updateUndoRedoState(pageId);
      });
    },
    [getActiveCanvas, updateUndoRedoState]
  );

  const undo = useCallback(() => {
    const pageId = activeCanvasIdRef.current;
    if (!pageId) return;
    const hist = historyMapRef.current.get(pageId);
    if (!hist) return;
    restoreFromHistory(hist.index - 1);
  }, [restoreFromHistory]);

  const redo = useCallback(() => {
    const pageId = activeCanvasIdRef.current;
    if (!pageId) return;
    const hist = historyMapRef.current.get(pageId);
    if (!hist) return;
    restoreFromHistory(hist.index + 1);
  }, [restoreFromHistory]);

  // ── Canvas size ─────────────────────────────────────────────────────

  // Retarget every page's canvas to a new frame. Moves no artwork.
  const applyDimensions = useCallback((width: number, height: number) => {
    setCanvasWidth(width);
    setCanvasHeight(height);
    canvasWidthRef.current = width;
    canvasHeightRef.current = height;
    const dpr = window.devicePixelRatio || 1;
    for (const canvas of canvasMapRef.current.values()) {
      canvas.setDimensions({ width: width * dpr, height: height * dpr }, { cssOnly: false });
      canvas.setDimensions({ width, height }, { cssOnly: true });
      canvas.setViewportTransform([dpr, 0, 0, dpr, 0, 0]);
      canvas.requestRenderAll();
    }
  }, []);

  const getCanvasSize = useCallback(
    (): Dimensions => ({ width: canvasWidthRef.current, height: canvasHeightRef.current }),
    []
  );

  const setCanvasSize = useCallback(
    (width: number, height: number, options?: { reflow?: boolean }) => {
      const from = getCanvasSize();
      const to = { width, height };

      // Adopting a saved design's own frame: the stored artwork already fits it.
      if (options?.reflow === false) {
        applyDimensions(width, height);
        return;
      }
      if (from.width === to.width && from.height === to.height) return;

      const pages = new Map<string, string>();
      for (const [pageId, canvas] of canvasMapRef.current) {
        pages.set(pageId, JSON.stringify(canvas.toJSON()));
      }
      resizeSnapshotRef.current = { ...from, pages };
      setCanUndoResize(true);

      applyDimensions(width, height);
      for (const [pageId, canvas] of canvasMapRef.current) {
        isRestoringRef.current.add(pageId);
        reflowCanvas(canvas, from, to);
        isRestoringRef.current.delete(pageId);
        // A resize is a commit point: undoing across it page by page would
        // leave that page's artwork sized for the frame it no longer has.
        historyMapRef.current.set(pageId, {
          entries: [JSON.stringify(canvas.toJSON())],
          index: 0,
        });
        updateUndoRedoState(pageId);
      }
    },
    [applyDimensions, getCanvasSize, updateUndoRedoState]
  );

  // Restores the frame and every page's artwork together.
  const undoResize = useCallback(() => {
    const snapshot = resizeSnapshotRef.current;
    if (!snapshot) return;
    resizeSnapshotRef.current = null;
    setCanUndoResize(false);
    applyDimensions(snapshot.width, snapshot.height);
    for (const [pageId, canvas] of canvasMapRef.current) {
      const json = snapshot.pages.get(pageId);
      if (!json) continue;
      isRestoringRef.current.add(pageId);
      canvas.loadFromJSON(JSON.parse(json)).then(() => {
        canvas.requestRenderAll();
        isRestoringRef.current.delete(pageId);
        historyMapRef.current.set(pageId, { entries: [json], index: 0 });
        updateUndoRedoState(pageId);
      });
    }
  }, [applyDimensions, updateUndoRedoState]);

  // ── Zoom ────────────────────────────────────────────────────────────

  const zoomToFit = useCallback(() => {
    setZoom(fitScale);
  }, [fitScale]);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(z * 1.2, 3));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(z / 1.2, 0.05));
  }, []);

  // ── Export ──────────────────────────────────────────────────────────

  const exportPNG = useCallback(() => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    canvas.discardActiveObject();
    canvas.requestRenderAll();

    const dataURL = canvas.toDataURL({
      format: "png",
      multiplier: 2,
      quality: 1,
    });

    const link = document.createElement("a");
    link.download = "design.png";
    link.href = dataURL;
    link.click();

    if (activeObj) {
      canvas.setActiveObject(activeObj);
      canvas.requestRenderAll();
    }
  }, [getActiveCanvas]);

  // ── Serialization ───────────────────────────────────────────────────

  const getCanvasJSON = useCallback(() => {
    const canvas = getActiveCanvas();
    if (!canvas) return "{}";
    return JSON.stringify(canvas.toJSON());
  }, [getActiveCanvas]);

  const getCanvasJSONForPage = useCallback((pageId: string) => {
    const canvas = canvasMapRef.current.get(pageId);
    if (!canvas) return "{}";
    return JSON.stringify(canvas.toJSON());
  }, []);

  const loadTemplate = useCallback(
    (template: Template) => {
      // The template brings its own frame and artwork, so nothing is reflowed.
      applyDimensions(template.width, template.height);
      resizeSnapshotRef.current = null;
      setCanUndoResize(false);
      // Load template JSON onto active canvas
      const canvas = getActiveCanvas();
      const pageId = activeCanvasIdRef.current;
      if (canvas && pageId) {
        isRestoringRef.current.add(pageId);
        canvas.loadFromJSON(JSON.parse(template.canvas_json)).then(() => {
          canvas.requestRenderAll();
          isRestoringRef.current.delete(pageId);
          historyMapRef.current.set(pageId, {
            entries: [JSON.stringify(canvas.toJSON())],
            index: 0,
          });
          updateUndoRedoState(pageId);
        });
      }
    },
    [applyDimensions, getActiveCanvas, updateUndoRedoState]
  );

  // ── Keyboard shortcuts ──────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (meta && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && !isTextEditing()) {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, deleteSelected]);

  function isTextEditing(): boolean {
    const canvas = getActiveCanvas();
    if (!canvas) return false;
    const obj = canvas.getActiveObject();
    return obj instanceof fabric.Textbox && obj.isEditing === true;
  }

  return {
    // Canvas map management
    registerCanvas,
    unregisterCanvas,
    setActiveCanvas,
    activeCanvasId,
    canvasMap: canvasMapRef,
    // For backward compat (right-sidebar uses canvas directly)
    get canvas() {
      return getActiveCanvas();
    },
    selectedObject,
    canvasWidth,
    canvasHeight,
    zoom,
    setZoomRaw: setZoom,
    fitScale,
    setFitScale,
    addText,
    addShape,
    addImage,
    setBackground,
    updateSelectedObject,
    deleteSelected,
    undo,
    redo,
    canUndo,
    canRedo,
    setCanvasSize,
    getCanvasSize,
    undoResize,
    canUndoResize,
    zoomToFit,
    zoomIn,
    zoomOut,
    exportPNG,
    getCanvasJSON,
    getCanvasJSONForPage,
    loadTemplate,
  };
}
