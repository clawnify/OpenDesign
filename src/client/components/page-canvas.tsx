import { useRef, useEffect, useState } from "preact/hooks";
import {readCanvas} from "../../shared/canvas-merge";
import { fitAll } from "../lib/fit-text";
import * as fabric from "fabric";
import { useEditor } from "../context";
import type { Page } from "../types";

interface PageCanvasProps {
  page: Page;
  isActive: boolean;
  width: number;
  height: number;
  onActivate: () => void;
}

export function PageCanvas({ page, isActive, width, height, onActivate }: PageCanvasProps) {
  const { registerCanvas, unregisterCanvas, canvasReady, pageView, editors } = useEditor();
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [markers, setMarkers] = useState<{id: string; name: string; left: number; top: number; width: number; height: number}[]>([]);
  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;

  useEffect(() => {
    if (!canvasElRef.current || fabricRef.current) return;

    const c = new fabric.Canvas(canvasElRef.current, {
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
        applyCustomControls(obj);
      }
    });

    // Load page content
    const initial = pageView(page.id)?.json ?? page.canvas_json;
    let disposed = false;
    if (initial && initial !== "{}") {
      try {
        c.loadFromJSON(readCanvas(initial)).then(() => {
          if (disposed) return;
          fitAll(c);
          c.requestRenderAll();
          canvasReady(page, JSON.stringify(c.toJSON()), initial);
        });
      } catch {
        // ignore parse errors
      }
    }

    if (!initial || initial === "{}") canvasReady(page, JSON.stringify(c.toJSON()), initial || "{}");

    // On mouse down, activate this canvas (use ref to avoid stale closure)
    c.on("mouse:down", () => onActivateRef.current());

    fabricRef.current = c;
    registerCanvas(page.id, c);

    return () => {
      disposed = true;
      unregisterCanvas(page.id);
      c.dispose();
      fabricRef.current = null;
    };
  }, []);

  // Selection markers live outside Fabric so PNG and PDF exports stay clean.
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const selected = editors.filter(editor => editor.selection?.startsWith(page.id + ":"));
    const draw = () => {
      const next = selected.flatMap(editor => {
        const layer = canvas.getObjects().find(object => page.id + ":" + object.get("layerId") === editor.selection);
        return layer ? [{id: editor.id, name: editor.name, ...layer.getBoundingRect()}] : [];
      });
      setMarkers(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    draw();
    return canvas.on("after:render", draw);
  }, [editors, page.id]);

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
    <div
      class={`ring-1 ring-border ${isActive ? "outline-2 outline-offset-4 outline-selection" : ""}`}
      style={{ width, height, position: "relative" }}
    >
      <canvas ref={canvasElRef} />
      <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {markers.map(m => <div key={m.id} data-collaborator={m.name} class="absolute border-2 border-selection"
          style={{left: m.left, top: m.top, width: m.width, height: m.height}}>
          <span class="absolute left-0 top-0 bg-background px-1 text-label text-foreground">{m.name}</span>
        </div>)}
      </div>
    </div>
  );
}
