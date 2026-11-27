# OpenDesign

A design editor for creating professional social media graphics, especially LinkedIn posts.

## Features
- Fabric.js-based canvas editor with drag-and-drop
- Pre-built LinkedIn post templates (Quote Card, Stats Highlight, Announcement, Tips List, Profile Card, Minimal Text)
- Text editing with bundled fonts (Inter up to 900 for display headlines, Montserrat, Playfair Display and seven more), plus uploaded fonts
- Brand kits — palette, heading/body fonts and logos, applied to a design in one
  step and portable between installs as JSON (`/api/brand-kits`)
- Image uploads and placement
- Multiple canvas sizes (1080x1080 square, 1080x1350 carousel, 1200x627 landscape)
- Multi-page designs exported as one PDF, which is how a LinkedIn carousel is published
- 2x PNG export, one page or all of them
- Save and manage multiple designs
- Template fields — named slots you can fill from data over the API, and `{{variables}}` inside a text
- Your own designs offered as templates to start from

## Filling a design from data
Objects in a design can be given a field name in the editor, which turns the
design into a template you can drive without touching canvas JSON:

- `GET /api/designs/{id}/fields` — what this design can be filled with. Returns
  `name`, `type` (`text` or `image`), the current `value`, and the pages the
  field appears on.
- `POST /api/designs/{id}/fill` — `{"values": {"headline": "..."}}`. Returns the
  filled pages plus `filled` and `unmatched`; the stored design is unchanged.
  Add `"save": true` to write the result as a new design you can then open and
  export.

Prefer these over editing `canvas_json` by hand. Text fields take a string,
image fields take a URL, and one name may cover several objects or pages.

### Variables inside a text
Write `{{name}}` inside a text (`{{ name }}` and dotted names like
`{{client.name}}` work too) and `name` becomes a text field of its own. Use it
when a sentence keeps its fixed words and only one part varies:
"for {{to_label}} since {{since}}". A variable and a whole-object field may
share a name, and a fill writes both.

Style the variable the way the value should look. A value takes the style of
the first character of what it replaces, and every range after it moves with
the text, so a blue `{{to_label}}` fills as a blue destination and the grey
words around it stay grey. A whole-object field works the same way: the new
text takes the style of the old text's first character. A variable with no
value in the fill is left as written, so it shows instead of vanishing.

### Fitting a value on its lines
A text with `maxLines` set (the editor's "Shrink to fit") is drawn at the
largest size, up to the size it was designed at, that keeps it on that many
lines. Set it on every field whose value can run long. It shrinks from the
object's origin: from the top edge by default, around the middle when
`originY` is `"center"`. The fit is measured in the browser when the design is
opened or exported; the server has no canvas.

### Templates
`PUT /api/designs/{id}` with `{"is_template": true}` offers a design under
"Start from a template" (`GET /api/templates` lists it first, with its
`design_id`). Starting from it copies every page, which over the API is
`POST /api/designs/{id}/fill` with `{"values": {}, "save": true}`. The copy is a
design of its own and is not a template.

Uploaded fonts are stored under a generated family name (`Custom-…`); read
`GET /api/fonts` for which name is which before writing `fontFamily`.

`save: true` produces an editable design, not a rendered image — there is no
server-side renderer. Use it for a handful of variants. Do not loop it over a
large list: every variant becomes a row that `GET /api/designs` returns in full,
and the user ends up with gallery entries rather than finished graphics.

## When to use this template
Use this template when the user wants to:
- Create social media post images or graphics
- Design LinkedIn posts, quote cards, or announcement banners
- Build a LinkedIn or Instagram carousel and export it as a PDF
- Build a simple graphic design tool
- Create branded visual content
- Generate on-brand variants of one design by filling it with data
- Keep a team or client on-brand across every graphic (brand kit)

To inspect a saved design, call `GET /api/designs/{id}/render` via the app reader with `as_image: true`. For a specific page pass `page_id`. Use `max_size=1024` for a compact preview. Pass `download=1` for a PNG download at native size, or combine it with `scale=2` for a 2× export.
