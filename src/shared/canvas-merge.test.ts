import assert from "node:assert/strict";
import test from "node:test";
import {mergeCanvas, readCanvas} from "./canvas-merge";
const base = JSON.stringify({objects: [{type:"Textbox", text:"Headline"}, {type:"Rect", left:20}]});
function edit(json: string, index: number, props: Record<string, unknown>) {
  const canvas = readCanvas(json);
  Object.assign(canvas.objects[index], props);
  return JSON.stringify(canvas);
}
test("two independent edits survive on a legacy page and on retry", () => {
  const mine = edit(base, 1, {left:50}), theirs = edit(base, 0, {text:"Agent headline"});
  const merged = mergeCanvas(base, mine, theirs);
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(readCanvas(merged.json).objects.map(o => o.text ?? o.left), ["Agent headline", 50]);
  assert.deepEqual(mergeCanvas(base, mine, merged.json), merged);
});
test("both headline choices preserve the sidebar move", () => {
  const mine = edit(edit(base, 0, {text:"Mine"}), 1, {left:90});
  const theirs = edit(base, 0, {text:"Theirs"});
  for (const choice of ["mine", "theirs"] as const) {
    const result = mergeCanvas(base, mine, theirs, choice);
    assert.deepEqual(result.conflicts, ["original-0"]);
    assert.equal(readCanvas(result.json).objects[0].text, choice === "mine" ? "Mine" : "Theirs");
    assert.equal(readCanvas(result.json).objects[1].left, 90);
  }
});
test("concurrent removal and edit report a conflict, independent insertions survive", () => {
  const mine = readCanvas(base), other = readCanvas(base);
  mine.objects.shift();
  other.objects[0].text = "Changed";
  mine.objects.push({layerId:"a", type:"Rect"});
  other.objects.push({layerId:"b", type:"Rect"});
  const merged = mergeCanvas(base, JSON.stringify(mine), JSON.stringify(other), "mine");
  assert.deepEqual(merged.conflicts, ["original-0"]);
  assert.deepEqual(new Set(readCanvas(merged.json).objects.map(o=>o.layerId)), new Set(["original-1","a","b"]));
});
test("duplicate IDs reject ambiguous input", () => {
  assert.throws(()=>readCanvas('{"objects":[{"layerId":"a"},{"layerId":"a"}]}'));
});
