import assert from "node:assert/strict";
import { test } from "node:test";
import { Observable, Point, Rect, type Canvas } from "fabric";
import { DragPreviews } from "./lib/drag-previews";

test("a peer's drag only moves display pixels, and cancellation reveals the stored position", t => {
  const windowEvents = new EventTarget();
  Object.defineProperty(globalThis, "window", {value: windowEvents, configurable: true});
  const rect = new Rect({left: 40, top: 10, width: 20, height: 10});
  rect.set("layerId", "box");
  rect.setCoords();
  const display = {} as CanvasRenderingContext2D;
  const canvas = Object.assign(new Observable(), {
    upperCanvasEl: new EventTarget(), getContext: () => display, requestRenderAll() {},
    getObjects: () => [rect],
  }) as unknown as Canvas;
  const previews = new DragPreviews(() => assert.fail("a received preview was echoed"));
  const stop = previews.attach("artboard", canvas);
  t.after(() => { stop(); previews.dispose(); Reflect.deleteProperty(globalThis, "window"); });
  const event = {type: "preview", session: "one"} as const;
  previews.receive({...event, value: JSON.stringify({page: "artboard", layers: [["box", 40, 10, 120, 30]]})});
  assert.equal(previews.bounds("artboard", rect).left, 120);
  assert.equal(rect.toObject().left, 40);
  canvas.fire("before:render", {ctx: {} as CanvasRenderingContext2D});
  assert.equal(rect.left, 40, "export must use the stored position");
  canvas.fire("before:render", {ctx: display});
  assert.deepEqual(rect.getXY(), new Point(120, 30));
  canvas.fire("after:render", {ctx: display});
  assert.deepEqual(rect.getXY(), new Point(40, 10));
  rect.setXY(new Point(60, 10));
  canvas.fire("before:render", {ctx: display});
  assert.equal(rect.left, 60, "a newer edit must supersede the preview");
  canvas.fire("after:render", {ctx: display});
  previews.receive({...event, value: null});
  rect.setXY(new Point(40, 10));
  canvas.fire("before:render", {ctx: display});
  assert.equal(rect.left, 40);
});
