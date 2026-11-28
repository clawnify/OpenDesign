import { ActiveSelection, Point, type Canvas, type FabricObject } from "fabric";
import type { DocumentPreview } from "@clawnify/app/client";
import { pageUnderObject } from "./page-drag";

// Scene coordinates, independent of each editor's zoom, scroll and device scale.
type Layer = [id: string, startX: number, startY: number, x: number, y: number];
interface Move { page: string; layers: Layer[]; to?: [page: string, dx: number, dy: number] }
const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);
function readMove(value: string): Move | null {
  try {
    const m = JSON.parse(value);
    if (!m || typeof m.page !== "string" || !Array.isArray(m.layers) || !m.layers.length ||
      !m.layers.every((p: unknown) => Array.isArray(p) && p.length === 5 && typeof p[0] === "string" && p.slice(1).every(finite)) ||
      (m.to !== undefined && !(Array.isArray(m.to) && m.to.length === 3 && typeof m.to[0] === "string" && m.to.slice(1).every(finite)))) return null;
    return m;
  } catch { return null; }
}

export class DragPreviews {
  private pages = new Map<string, Canvas>();
  private peers = new Map<string, {move: Move; timeout: ReturnType<typeof setTimeout>}>();
  constructor(private send: (value: string | null) => void) {}

  private redraw(m: Move) {
    this.pages.get(m.page)?.requestRenderAll();
    if (m.to) this.pages.get(m.to[0])?.requestRenderAll();
  }

  private forget(session: string) {
    const peer = this.peers.get(session);
    if (!peer) return;
    clearTimeout(peer.timeout);
    this.peers.delete(session);
    this.redraw(peer.move);
  }

  receive = ({session, value}: DocumentPreview) => {
    this.forget(session);
    const move = value && readMove(value);
    if (!move) return;
    this.peers.set(session, {move, timeout: setTimeout(() => this.forget(session), 3500)});
    this.redraw(move);
  };

  private position(object: FabricObject, layer: Layer) {
    const point = object.getXY();
    // A local gesture or a newer committed position supersedes an older preview.
    if (Math.abs(point.x - layer[1]) > 0.1 || Math.abs(point.y - layer[2]) > 0.1) return;
    return new Point(layer[3], layer[4]);
  }

  bounds(page: string, object: FabricObject) {
    const rect = object.getBoundingRect();
    for (const {move} of this.peers.values()) {
      if (move.page !== page) continue;
      const layer = move.layers.find(([id]) => id === object.get("layerId"));
      if (!layer) continue;
      const next = this.position(object, layer);
      if (next) return {...rect, left: rect.left + next.x - layer[1], top: rect.top + next.y - layer[2]};
    }
    return rect;
  }

  attach(page: string, canvas: Canvas) {
    this.pages.set(page, canvas);
    let start = new Map<FabricObject, Point>();
    let latest: string | null = null;
    let lastSent = 0;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const members = (target: FabricObject) => target instanceof ActiveSelection ? target.getObjects() : [target];
    const before = canvas.on("before:transform", ({transform}) => {
      start = new Map(members(transform.target).map(o => [o, o.getXY()]));
    });
    const publish = () => {
      if (latest && performance.now() - lastSent >= 55) {
        this.send(latest);
        lastSent = performance.now();
      }
    };
    const moving = canvas.on("object:moving", ({target}) => {
      const layers: Layer[] = [];
      for (const o of members(target)) {
        const origin = start.get(o);
        const id = o.get("layerId");
        if (!origin || typeof id !== "string") continue;
        const {x, y} = o.getXY();
        layers.push([id, origin.x, origin.y, x, y]);
      }
      if (!layers.length) return;
      const dest = pageUnderObject(canvas, target, this.pages);
      latest = JSON.stringify({page, layers, to: dest && [dest.id, dest.offset.x, dest.offset.y]});
      publish();
      heartbeat ??= setInterval(publish, 200);
    });
    const stop = (cancel: boolean) => {
      clearInterval(heartbeat);
      heartbeat = undefined;
      if (latest) {
        if (cancel) this.send(null);
        else this.send(latest);
      }
      latest = null;
      start.clear();
    };
    const up = canvas.on("mouse:up", () => stop(false));
    const cancel = () => stop(true);
    window.addEventListener("blur", cancel);
    canvas.upperCanvasEl.addEventListener("touchcancel", cancel);
    canvas.upperCanvasEl.addEventListener("pointercancel", cancel);

    // Fabric paints synchronously between these events. Only displace objects
    // on the display canvas. JSON, hit-testing, undo and exports use the model.
    const restore = new Map<FabricObject, Point>();
    const paint = canvas.on("before:render", ({ctx}) => {
      if (ctx !== canvas.getContext() || !this.peers.size) return;
      const objects = new Map(canvas.getObjects().map(o => [o.get("layerId"), o]));
      for (const {move} of this.peers.values()) {
        if (move.page !== page) continue;
        for (const layer of move.layers) {
          const o = objects.get(layer[0]);
          const next = o && this.position(o, layer);
          if (!o || !next || restore.has(o)) continue;
          restore.set(o, o.getXY());
          o.setXY(next);
          o.setCoords();
        }
      }
    });
    const after = canvas.on("after:render", ({ctx}) => {
      if (ctx !== canvas.getContext()) return;
      for (const [o, point] of restore) { o.setXY(point); o.setCoords(); }
      restore.clear();
      for (const {move} of this.peers.values()) {
        if (move.to?.[0] !== page) continue;
        const source = this.pages.get(move.page);
        if (!source) continue;
        ctx.save();
        ctx.transform(...canvas.viewportTransform);
        for (const layer of move.layers) {
          const o = source.getObjects().find(obj => obj.get("layerId") === layer[0]);
          if (!o || !this.position(o, layer)) continue;
          ctx.save();
          ctx.translate(layer[3] - layer[1] + move.to[1], layer[4] - layer[2] + move.to[2]);
          o.render(ctx);
          ctx.restore();
        }
        ctx.restore();
      }
    });
    return () => {
      cancel();
      before(); moving(); up(); paint(); after();
      window.removeEventListener("blur", cancel);
      canvas.upperCanvasEl.removeEventListener("touchcancel", cancel);
      canvas.upperCanvasEl.removeEventListener("pointercancel", cancel);
      this.pages.delete(page);
    };
  }

  dispose() {
    for (const session of this.peers.keys()) this.forget(session);
  }
}
