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

test("Fabric v6's capitalised type names are recognised", () => {
  // A canvas that has been through the editor serialises as "Textbox"/"Image"/
  // "Rect", not the lowercase names used in the seed templates. Both must work.
  const objects = [
    { type: "Textbox", text: "hi", fieldName: "headline" },
    { type: "Image", src: "https://example.com/a.png", fieldName: "logo" },
    { type: "Rect", fill: "#000", fieldName: "backdrop" },
  ];

  assert.deepEqual(
    collectFields([page("p1", objects)]).map((f) => [f.name, f.type]),
    [
      ["headline", "text"],
      ["logo", "image"],
    ]
  );
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

// ── Inline variables, and styles that stay on the right words ──────────────

const BLUE = { fill: "#1B3A9E" };
const RED = { fill: "#B8232F" };

function objectsOf(p: PageJSON): Array<Record<string, unknown>> {
  return JSON.parse(p.canvas_json).objects;
}

test("a {{variable}} is a text field of its own, with no value until filled", () => {
  const fields = collectFields([page("p1", [{ type: "textbox", text: "for {{to_label}} since {{when}}, {{to_label}}" }])]);
  assert.deepEqual(fields, [
    { name: "to_label", type: "text", value: "", page_ids: ["p1"] },
    { name: "when", type: "text", value: "", page_ids: ["p1"] },
  ]);
});

test("filling a variable keeps its colour on the value and moves the ranges after it", () => {
  // "for {{to_label}} since " + red "2025": the variable is blue, "2025" red.
  const text = "for {{to_label}} since 2025";
  const t = { type: "textbox", text, styles: [{ start: 4, end: 16, style: BLUE }, { start: 23, end: 27, style: RED }] };
  const { pages, filled } = fillPages([page("p1", [t])], { to_label: "European cloud" });
  const [o] = objectsOf(pages[0]);

  assert.deepEqual(filled, ["to_label"]);
  assert.equal(o.text, "for European cloud since 2025");
  assert.deepEqual(o.styles, [
    { start: 4, end: 18, style: BLUE },
    { start: 25, end: 29, style: RED },
  ]);
});

test("a whole-box field takes the style of its first character, not ranges left at old positions", () => {
  // The bug this fixes: "for European cloud since..." filled with a longer text kept
  // blue on characters 4 to 18, colouring half a word.
  const t = { type: "textbox", fieldName: "context", text: "for European cloud", styles: [{ start: 4, end: 18, style: BLUE }] };
  const [o] = objectsOf(fillPages([page("p1", [t])], { context: "for product launches" }).pages[0]);
  assert.equal(o.text, "for product launches");
  assert.deepEqual(o.styles, []);

  const all = { type: "textbox", fieldName: "stat", text: "5x demand", styles: [{ start: 0, end: 9, style: BLUE }] };
  const [p] = objectsOf(fillPages([page("p1", [all])], { stat: "3x faster than before" }).pages[0]);
  assert.deepEqual(p.styles, [{ start: 0, end: 21, style: BLUE }]);
});

test("line breaks are not counted, as fabric counts them", () => {
  const text = "EUROPE IS LEAVING\n{{what}}";
  const t = { type: "textbox", text, styles: [{ start: 17, end: 25, style: RED }] };
  const [o] = objectsOf(fillPages([page("p1", [t])], { what: "US TECH" }).pages[0]);
  assert.equal(o.text, "EUROPE IS LEAVING\nUS TECH");
  assert.deepEqual(o.styles, [{ start: 17, end: 24, style: RED }]);
});

test("an emoji is one character, and a multi-line value keeps its style on every line", () => {
  const text = "🇪🇺 {{a}} ok";
  const t = { type: "textbox", text, styles: [{ start: 2, end: 7, style: BLUE }, { start: 8, end: 10, style: RED }] };
  const [o] = objectsOf(fillPages([page("p1", [t])], { a: "one\ntwo" }).pages[0]);
  assert.equal(o.text, "🇪🇺 one\ntwo ok");
  assert.deepEqual(o.styles, [{ start: 2, end: 8, style: BLUE }, { start: 9, end: 11, style: RED }]);
});

test("the older { line: { char: style } } form is read too", () => {
  const t = { type: "textbox", text: "hi {{name}}!", styles: { 0: { 3: BLUE, 4: BLUE } } };
  const [o] = objectsOf(fillPages([page("p1", [t])], { name: "Ada" }).pages[0]);
  assert.equal(o.text, "hi Ada!");
  assert.deepEqual(o.styles, [{ start: 3, end: 6, style: BLUE }]);
});

test("a variable without a value stays as written, and is not reported as filled", () => {
  const t = { type: "textbox", text: "{{a}} and {{b}}" };
  const { pages, filled, unmatched } = fillPages([page("p1", [t])], { a: "x", c: "y" });
  assert.equal(objectsOf(pages[0])[0].text, "x and {{b}}");
  assert.deepEqual(filled, ["a"]);
  assert.deepEqual(unmatched, ["c"]);
});
