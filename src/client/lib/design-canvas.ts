import { Canvas, FabricObject, Rect, Triangle } from "fabric";
import { same } from "../../shared/canvas-merge";

const transformDefaults = {left: 0, top: 0, scaleX: 1, scaleY: 1, width: 0, height: 0};
type Key = keyof typeof transformDefaults;
export type Geometry = Partial<Record<Key, number>>;
type Motion = {start: number; from: Geometry; to: Geometry};
const MOVE_DURATION_MS = 240;

// Only update geometry in place when Fabric can apply it without reloading the layer.
export function remoteGeometry(before: Record<string, unknown>, after: Record<string, unknown>, object: FabricObject) {
  const geometry: Geometry = {};
  for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (same(before[field], after[field])) continue;
    if (!Object.hasOwn(transformDefaults, field)) return null;
    if ((field === "width" || field === "height") && !(object instanceof Rect || object instanceof Triangle)) return null;
    const key = field as Key;
    const value = after[key] === undefined ? transformDefaults[key] : after[key];
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    geometry[key] = value;
  }
  return geometry;
}

function frame({start, from, to}: Motion, now: number): Geometry {
  const t = Math.min(1, (now - start) / MOVE_DURATION_MS);
  const ease = t * t * (3 - 2 * t);
  const result: Geometry = {};
  for (const key of Object.keys(to) as Key[]) result[key] = from[key]! + (to[key]! - from[key]!) * ease;
  return result;
}

export class DesignCanvas extends Canvas {
  private readonly motions = new Map<FabricObject, Motion>();

  moveLayer(object: FabricObject, geometry: Geometry) {
    const now = performance.now();
    const previous = this.motions.get(object);
    const from = previous ? frame(previous, now) : {};
    const to = {...previous?.to, ...geometry};
    for (const key of Object.keys(to) as Key[]) from[key] ??= object[key];

    object.set(geometry);
    object.setCoords();
    for (const key of Object.keys(to) as Key[]) to[key] = object[key];
    // Commit immediately. Only the on-screen paint uses an intermediate frame.
    if (this.getActiveObjects().includes(object) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.motions.delete(object);
    } else {
      this.motions.set(object, {start: now, from, to});
    }
  }

  override renderAll() {
    if (!this.motions.size) return super.renderAll();
    const now = performance.now();
    const active = this.getActiveObjects();
    for (const [object, motion] of this.motions) {
      const locallyChanged = (Object.keys(motion.to) as Key[]).some(key => object[key] !== motion.to[key]);
      if (locallyChanged || now - motion.start >= MOVE_DURATION_MS || object.canvas !== this || object.group || active.includes(object)) {
        this.motions.delete(object);
        continue;
      }
      object.set(frame(motion, now));
      object.setCoords();
    }
    try {
      super.renderAll(); // Also measures the on-canvas collaborator outline at the drawn position.
    } finally {
      for (const [object, motion] of this.motions) {
        object.set(motion.to);
        object.setCoords();
      }
    }
    if (this.motions.size) this.requestRenderAll();
  }
}
