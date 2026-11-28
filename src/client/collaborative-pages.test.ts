import assert from "node:assert/strict";
import test from "node:test";
import {h, render} from "preact";
import {act} from "preact/test-utils";
import {useCollaborativePages} from "./hooks/use-collaborative-pages";
import type {Page} from "./types";

test("unresolved pages wait for a choice while other pages can save or report a genuine failure", async t => {
  const canvas = (left: number) => JSON.stringify({objects: [{type: "Rect", layerId: "box", left}]});
  const page = (id: string, x: number): Page => ({
    id, design_id: "design", title: id, sort_order: 0, created_at: "", canvas_json: canvas(x),
  });
  const local = new Map<string, string>();
  let editor: ReturnType<typeof useCollaborativePages>;
  function Probe() {
    editor = useCollaborativePages(id => local.get(id)!, () => false);
    return null;
  }
  // The hook renders no DOM nodes.
  Object.defineProperty(globalThis, "document", {value: {}, configurable: true});
  const root = {childNodes: []} as unknown as HTMLElement;
  act(() => render(h(Probe, {}), root));
  t.after(() => { render(null, root); Reflect.deleteProperty(globalThis, "document"); });
  for (const id of ["first", "second", "third"]) {
    const base = page(id, 0);
    editor!.ready(base, base.canvas_json, base.canvas_json);
    local.set(id, canvas(10));
  }
  act(() => { editor.receive(page("first", 20)); editor.removed(page("second", 0)); });
  const writes = t.mock.method(globalThis, "fetch", async () => Response.json({error: "Unavailable"}, {status: 503}));
  assert.equal(await editor!.save(page("first", 0)), null);
  assert.equal(await editor!.save(page("second", 0)), null);
  assert.equal(writes.mock.callCount(), 0);
  await assert.rejects(() => editor.save(page("third", 0)), /Unavailable/);
  assert.equal(writes.mock.callCount(), 1);
  assert.equal(editor!.conflict?.page.id, "first");
  act(() => { editor.receive(page("first", 20), "theirs"); });
  assert.equal(editor!.conflict?.page.id, "second");
  assert.equal(editor!.conflict?.removed, true);
});
