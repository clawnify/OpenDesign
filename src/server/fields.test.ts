import { test } from "node:test";
import assert from "node:assert/strict";
import { collectFields, fillPages, type PageJSON } from "./fields.js";

function page(id: string, objects: unknown[]): PageJSON {
  return { id, canvas_json: JSON.stringify({ version: "6.0.0", objects }) };
}

const HEADLINE = { type: "textbox", text: "Your inspiring quote goes here", fieldName: "headline" };
const LOGO = { type: "image", src: "https://example.com/old.png", fieldName: "logo" };
const UNTAGGED = { type: "textbox", text: "not a field" };

test("collectFields reports name, type and current value", () => {
  const fields = collectFields([page("p1", [HEADLINE, LOGO, UNTAGGED])]);

  assert.deepEqual(fields, [
    { name: "headline", type: "text", value: "Your inspiring quote goes here", page_ids: ["p1"] },
    { name: "logo", type: "image", value: "https://example.com/old.png", page_ids: ["p1"] },
  ]);
});

test("a name reused across pages is one field listing every page", () => {
  const fields = collectFields([page("p1", [LOGO]), page("p2", [LOGO])]);

  assert.equal(fields.length, 1);
  assert.deepEqual(fields[0].page_ids, ["p1", "p2"]);
});

test("fields inside groups are found", () => {
  const fields = collectFields([page("p1", [{ type: "group", objects: [HEADLINE] }])]);

  assert.deepEqual(fields.map((f) => f.name), ["headline"]);
});

test("a tag on an object that is neither text nor image is ignored", () => {
  assert.deepEqual(collectFields([page("p1", [{ type: "rect", fieldName: "box" }])]), []);
});

test("blank and non-string field names are ignored", () => {
  const objects = [
    { type: "textbox", text: "a", fieldName: "   " },
    { type: "textbox", text: "b", fieldName: 42 },
  ];
  assert.deepEqual(collectFields([page("p1", objects)]), []);
});

test("empty and corrupt canvases are skipped, not thrown on", () => {
  const pages = [
    { id: "p1", canvas_json: "{}" },
    { id: "p2", canvas_json: "not json" },
    page("p3", [HEADLINE]),
  ];
  assert.deepEqual(collectFields(pages).map((f) => f.name), ["headline"]);
});

test("fill writes text and image by the object's own type", () => {
  const result = fillPages([page("p1", [HEADLINE, LOGO])], {
    headline: "Q3 revenue up 40%",
    logo: "https://example.com/new.png",
  });

  const objects = JSON.parse(result.pages[0].canvas_json).objects;
  assert.equal(objects[0].text, "Q3 revenue up 40%");
  assert.equal(objects[1].src, "https://example.com/new.png");
  assert.deepEqual(result.filled.sort(), ["headline", "logo"]);
  assert.deepEqual(result.unmatched, []);
});

test("one name on two pages fills both", () => {
  const result = fillPages([page("p1", [LOGO]), page("p2", [LOGO])], {
    logo: "https://example.com/new.png",
  });

  for (const filledPage of result.pages) {
    assert.equal(JSON.parse(filledPage.canvas_json).objects[0].src, "https://example.com/new.png");
  }
});

test("an unknown name is reported, not fatal", () => {
  const result = fillPages([page("p1", [LOGO])], {
    logo: "https://example.com/new.png",
    nope: "y",
  });

  assert.deepEqual(result.filled, ["logo"]);
  assert.deepEqual(result.unmatched, ["nope"]);
});

test("fill does not mutate the pages it was given", () => {
  const original = page("p1", [HEADLINE]);
  const before = original.canvas_json;

  fillPages([original], { headline: "changed" });

  assert.equal(original.canvas_json, before);
});

test("untouched pages are returned unchanged", () => {
  const pages = [page("p1", [HEADLINE]), page("p2", [UNTAGGED])];
  const result = fillPages(pages, { headline: "changed" });

  assert.equal(result.pages[1].canvas_json, pages[1].canvas_json);
});

test("filling with an empty string clears the text rather than being skipped", () => {
  const result = fillPages([page("p1", [HEADLINE])], { headline: "" });

  assert.equal(JSON.parse(result.pages[0].canvas_json).objects[0].text, "");
  assert.deepEqual(result.filled, ["headline"]);
});
