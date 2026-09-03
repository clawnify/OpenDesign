# OpenDesign

A design editor for creating professional social media graphics, especially LinkedIn posts.

## Features
- Fabric.js-based canvas editor with drag-and-drop
- Pre-built LinkedIn post templates (Quote Card, Stats Highlight, Announcement, Tips List, Profile Card, Minimal Text)
- Text editing with Google Fonts (Inter, Montserrat, Playfair Display)
- Image uploads and placement
- Multiple canvas sizes (1080x1080 square, 1200x627 landscape)
- Save and manage multiple designs
- Template fields — named slots you can fill from data over the API

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

`save: true` produces an editable design, not a rendered image — there is no
server-side renderer. Use it for a handful of variants. Do not loop it over a
large list: every variant becomes a row that `GET /api/designs` returns in full,
and the user ends up with gallery entries rather than finished graphics.

## When to use this template
Use this template when the user wants to:
- Create social media post images or graphics
- Design LinkedIn posts, quote cards, or announcement banners
- Build a simple graphic design tool
- Create branded visual content
- Generate on-brand variants of one design by filling it with data
