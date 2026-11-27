import { useRef, useEffect, useState } from "preact/hooks";
import type { RefObject } from "preact";
import { DesignCanvas } from "../lib/design-canvas";
import { watchDragScroll } from "../lib/drag-scroll";
import { readCanvas } from "../../shared/canvas-merge";
import { fitAll } from "../lib/fit-text";
import * as fabric from "fabric";
import { useEditor } from "../context";
import type { Page } from "../types";

interface PageCanvasProps {
  page: Page;
  width: number;
  height: number;
  scrollAreaRef: RefObject<HTMLDivElement>;
  onActivate: () => void;
}

interface SavedSelection {
  layers: unknown[];
  caret?: [number, number];
}

// Give the same collaborator the same hue in every viewer, even after a reload.
function collaboratorHue(id: string) {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return ((hash >>> 0) % 36000) / 100;
}

export function PageCanvas({revision, ...props}: PageCanvasProps & {revision: number}) {
  const saved = useRef<SavedSelection>({layers: []});
  return <FabricPage key={revision} {...props} saved={saved} />;
}

function FabricPage({page, width, height, scrollAreaRef, onActivate, saved}: PageCanvasProps & {saved: {current: SavedSelection}}) {
  const { registerCanvas, unregisterCanvas, canvasReady, pageView, editors, activePageId, zoom } = useEditor();
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [markers, setMarkers] = useState<{id: string; name: string; hue: number; labelRow: number; left: number; top: number; width: number; height: number}[]>([]);
  const activeRef = useRef(activePageId === page.id);
  activeRef.current = activePageId === page.id;
  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;

  useEffect(() => {
    if (!canvasElRef.current || fabricRef.current) return;

    const c = new DesignCanvas(canvasElRef.current, {
      width,
      height,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
      selection: true,
      controlsAboveOverlay: true,
    });

    // Retina rendering
    const dpr = window.devicePixelRatio || 1;
    c.setDimensions({ width: width * dpr, height: height * dpr }, { cssOnly: false });
    c.setDimensions({ width, height }, { cssOnly: true });
    c.setViewportTransform([dpr, 0, 0, dpr, 0, 0]);

    // Selection handles take the --selection token, so they follow the theme
    // like the rest of the interface (the canvas cannot read a CSS variable).
    const selection =
      getComputedStyle(document.documentElement).getPropertyValue("--selection").trim() || "#4977ed";

    // Custom control appearance — applied per-object via object:added
    const CONTROL_STYLE = {
      transparentCorners: false,
      borderColor: selection,
      borderScaleFactor: 1.5,
      padding: 6,
      cornerSize: 14,
      cornerColor: "#ffffff",
      cornerStrokeColor: selection,
      cornerStyle: "circle" as const,
    };

    // Custom render for corner controls (white circles with a selection-colour stroke)
    const renderCircleCorner = (
      ctx: CanvasRenderingContext2D,
      left: number,
      top: number,
      _styleOverride: unknown,
      _fabricObject: fabric.FabricObject,
    ) => {
      const size = 14;
      ctx.save();
      ctx.translate(left, top);
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = selection;
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    // Custom render for side controls (rounded pill handles)
    const renderPillControl = (horizontal: boolean) => {
      return (
        ctx: CanvasRenderingContext2D,
        left: number,
        top: number,
        _styleOverride: unknown,
        _fabricObject: fabric.FabricObject,
      ) => {
        const w = horizontal ? 28 : 8;
        const h = horizontal ? 8 : 28;
        ctx.save();
        ctx.translate(left, top);
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 4);
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = selection;
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      };
    };

    // Apply custom controls to an object
    const applyCustomControls = (obj: fabric.FabricObject) => {
      obj.set(CONTROL_STYLE);
      // Override corner renders
      if (obj.controls) {
        for (const key of ["tl", "tr", "bl", "br"]) {
          if (obj.controls[key]) {
            obj.controls[key].render = renderCircleCorner;
            obj.controls[key].sizeX = 18;
            obj.controls[key].sizeY = 18;
          }
        }
        for (const key of ["mt", "mb"]) {
          if (obj.controls[key]) {
            obj.controls[key].render = renderPillControl(true);
            obj.controls[key].sizeX = 32;
            obj.controls[key].sizeY = 12;
          }
        }
        for (const key of ["ml", "mr"]) {
          if (obj.controls[key]) {
            obj.controls[key].render = renderPillControl(false);
            obj.controls[key].sizeX = 12;
            obj.controls[key].sizeY = 32;
          }
        }
      }
    };

    // Apply to all existing objects
    c.getObjects().forEach(applyCustomControls);

    // Apply to any newly added objects
    c.on("object:added", (e) => {
      if (e.target) {
        const obj = e.target as fabric.FabricObject & {layerId?: string};
        if (!obj.layerId || c.getObjects().some(other => other !== obj && other.get("layerId") === obj.layerId))
          obj.layerId = crypto.randomUUID();
        if (obj.get("_isBgImage")) obj.set({ selectable: false, evented: false });
        applyCustomControls(obj);
      }
    });

    // Load page content
    const initial = pageView(page.id)?.json ?? page.canvas_json;
    let disposed = false;
    let stopPagePreview: (() => void) | undefined;
    const ready = () => {
      stopPagePreview = registerCanvas(page.id, c);
      canvasReady(page, JSON.stringify(c.toJSON()), initial || "{}");
    };
    if (initial && initial !== "{}") {
      try {
        c.loadFromJSON(readCanvas(initial)).then(() => {
          if (disposed) return;
          fitAll(c);
          c.requestRenderAll();
          ready();
          if (activeRef.current && !c.getActiveObject()) {
            const {layers, caret} = saved.current;
            const surviving = c.getObjects().filter(o => layers.includes(o.get("layerId")));
            if (surviving.length > 0) {
              const object = surviving.length === 1 ? surviving[0] : new fabric.ActiveSelection(surviving, {canvas: c});
              c.setActiveObject(object);
              if (caret && object instanceof fabric.IText) {
                object.enterEditing();
                object.setSelectionStart(Math.min(caret[0], object.text.length));
                object.setSelectionEnd(Math.min(caret[1], object.text.length));
                object.updateTextareaPosition();
              }
              c.requestRenderAll();
            }
          }
        });
      } catch {
        // ignore parse errors
      }
    }

    if (!initial || initial === "{}") ready();

    // On mouse down, activate this canvas (use ref to avoid stale closure)
    c.on("mouse:down", () => onActivateRef.current());

    fabricRef.current = c;
    const stopWatchingDrag = scrollAreaRef.current && watchDragScroll(c, scrollAreaRef.current);

    return () => {
      stopWatchingDrag?.();
      stopPagePreview?.();
      disposed = true;
      const object = c.getActiveObject();
      saved.current = {
        layers: c.getActiveObjects().map(o => o.get("layerId")),
        caret: object instanceof fabric.IText && object.isEditing ? [object.selectionStart, object.selectionEnd] : undefined,
      };
      c.discardActiveObject();
      unregisterCanvas(page.id);
      c.dispose();
      fabricRef.current = null;
    };
  }, []);

  // Selection markers live outside Fabric so PNG and PDF exports stay clean.
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const labelRows = new Map<string, number>();
    const selected = editors.flatMap(editor => {
      const target = editor.selection;
      if (!target || (target !== page.id && !target.startsWith(page.id + ":"))) return [];
      const labelRow = labelRows.get(target) ?? 0;
      labelRows.set(target, labelRow + 1);
      return [{target, marker: {id: editor.id, name: editor.name, hue: collaboratorHue(editor.id), labelRow}}];
    });
    const draw = () => {
      const next = selected.flatMap(({target, marker}) => {
        if (target === page.id) return [{...marker, left: 0, top: 0, width, height}];
        const layer = canvas.getObjects().find(object => page.id + ":" + object.get("layerId") === target);
        return layer ? [{...marker, ...layer.getBoundingRect()}] : [];
      });
      setMarkers(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    draw();
    return canvas.on("after:render", draw);
  }, [editors, page.id, width, height]);

  // The canvas above is built once, at whatever size the frame had then. A
  // design opened later adopts its own frame (app.tsx), which can land after
  // this canvas was made and before it was registered, so applyDimensions in
  // use-canvas never reached it: a 1080x1350 design drew on a 1080x1080
  // canvas and exports read the same cut-off canvas. Follow the frame.
  useEffect(() => {
    const c = fabricRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.setDimensions({ width: width * dpr, height: height * dpr }, { cssOnly: false });
    c.setDimensions({ width, height }, { cssOnly: true });
    c.setViewportTransform([dpr, 0, 0, dpr, 0, 0]);
    c.requestRenderAll();
  }, [width, height]);

  return (
    <>
      <div class="absolute left-0 top-0 origin-top-left" style={{ width, height, transform: `scale(${zoom})` }}>
        <canvas ref={canvasElRef} />
      </div>
      <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {markers.map(m => <div key={m.id} data-collaborator={m.name} class="absolute border-2 border-collaborator"
          style={{"--collaborator-hue": m.hue, left: m.left * zoom, top: m.top * zoom, width: m.width * zoom, height: m.height * zoom}}>
          <span class="absolute left-0 top-0 whitespace-nowrap rounded-br-xs bg-collaborator px-1 text-label text-on-collaborator"
            style={{transform: `translateY(${m.labelRow * 100}%)`}}>{m.name}</span>
        </div>)}
      </div>
    </>
  );
}
