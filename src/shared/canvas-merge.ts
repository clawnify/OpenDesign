import { WHITE_BACKGROUND } from "./page-background";

type Layer = Record<string, unknown> & { layerId: string };
type Canvas = Record<string, unknown> & { objects: Layer[] };

export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && same(x[k], y[k]));
}

/** Old pages get the same IDs in every editor before their first collaborative save. */
export function readCanvas(json: string): Canvas {
  const input = JSON.parse(json);
  if (!input || typeof input !== "object" || Array.isArray(input) || (input.objects !== undefined && !Array.isArray(input.objects))) throw Error("Invalid canvas");
  const layers: Layer[] = input.objects ?? [];
  const ids = new Set(layers.map(o => o.layerId).filter(Boolean));
  const used = new Set<string>();
  const objects = layers.map((layer, index) => {
    if (!layer || typeof layer !== "object" || Array.isArray(layer)) throw Error("Invalid layer");
    let id = layer.layerId;
    if (!id) {
      id = "original-" + index;
      while (ids.has(id)) id += "_";
    }
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(id) || used.has(id)) throw Error("Invalid or duplicate layer ID");
    used.add(id);
    return {...layer, layerId: id};
  });
  return {...input, background: input.background || WHITE_BACKGROUND, objects};
}

/** Replay the local delta over the current page. Deletion is a value, including delete-vs-edit conflicts. */
export function mergeCanvas(baseJson: string, mineJson: string, theirsJson: string, choice?: "mine" | "theirs") {
  const base = readCanvas(baseJson), mine = readCanvas(mineJson), theirs = readCanvas(theirsJson);
  const conflicts = new Set<string>();
  function pick<T>(b: T, m: T, t: T, label: string): T {
    if (same(b, m) || same(m, t)) return t;
    if (same(b, t)) return m;
    conflicts.add(label);
    return choice === "mine" ? m : t;
  }
  function properties(b: Record<string, unknown>, m: Record<string, unknown>, t: Record<string, unknown>, label: string, skip?: string) {
    const entries = [];
    for (const key of new Set([...Object.keys(b), ...Object.keys(m), ...Object.keys(t)])) {
      if (key === skip) continue;
      const value = pick(b[key], m[key], t[key], label);
      if (value !== undefined) entries.push([key, value]);
    }
    return Object.fromEntries(entries);
  }
  const index = (c: Canvas) => new Map(c.objects.map(o => [o.layerId, o]));
  const b = index(base), m = index(mine), t = index(theirs);
  const layers = new Map<string, Record<string, unknown>>();
  for (const id of new Set([...b.keys(), ...m.keys(), ...t.keys()])) {
    const before = b.get(id), local = m.get(id), remote = t.get(id);
    const layer = before && local && remote ? properties(before, local, remote, id) : pick(before, local, remote, id);
    if (layer) layers.set(id, layer);
  }
  const common = (ids: Iterable<string>) => [...ids].filter(id => b.has(id) && m.has(id) && t.has(id) && layers.has(id));
  const order = [...pick(common(b.keys()), common(m.keys()), common(t.keys()), "Layer order")];
  const placed = new Set(order);
  for (const source of [t, m, b]) {
    let at = 0;
    for (const id of source.keys()) {
      if (!layers.has(id)) continue;
      if (placed.has(id)) at = order.indexOf(id) + 1;
      else { order.splice(at++, 0, id); placed.add(id); }
    }
  }
  const touched = [...m].filter(([id, layer]) => layers.has(id) && !same(b.get(id), layer));
  const canvas = {...properties(base, mine, theirs, "Page settings", "objects"), objects: order.map(id => layers.get(id))};
  return {json: JSON.stringify(canvas), editedLayer: touched.length === 1 ? touched[0][0] : null, conflicts: [...conflicts]};
}
