import assert from "node:assert/strict";
import test from "node:test";
import { newPageCanvas } from "./page-background";

const frame = { width: 800, height: 600 };
const artwork = { type: "Textbox", text: "Title" };

test("blank pages start opaque white and artwork stays on its original page", () => {
  assert.deepEqual(JSON.parse(newPageCanvas()), { background: "#ffffff", objects: [] });
  const source = JSON.stringify({ background: "#123456", objects: [artwork] });
  assert.deepEqual(JSON.parse(newPageCanvas(source, frame)), { background: "#123456", objects: [] });
});

test("a template backdrop becomes the page color, while a smaller shape stays behind", () => {
  const rect = { type: "rect", ...frame, fill: "#123456" };
  const inherit = (width: number) => JSON.parse(newPageCanvas(JSON.stringify({
    objects: [{ ...rect, width }, artwork],
  }), frame));
  assert.deepEqual(inherit(800), { background: "#123456", objects: [] });
  assert.deepEqual(inherit(80), { background: "#ffffff", objects: [] });
});

test("background images survive a second insertion without inheriting foreground layers", () => {
  const image = { type: "Image", src: "/api/uploads/image", width: 400, height: 300, scaleX: 2, scaleY: 2 };
  const source = JSON.stringify({ objects: [{ ...image, layerId: "old" }, artwork] });
  const next = newPageCanvas(source, frame);
  assert.deepEqual(JSON.parse(next).objects, [{ ...image, _isBgImage: true, selectable: false, evented: false }]);
  assert.deepEqual(JSON.parse(newPageCanvas(next, frame)), JSON.parse(next));
  const native = JSON.stringify({ backgroundImage: image, objects: [artwork] });
  assert.deepEqual(JSON.parse(newPageCanvas(native, frame)), { background: "#ffffff", backgroundImage: image, objects: [] });
});
