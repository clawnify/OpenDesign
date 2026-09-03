<img src="readme-banner.png" alt="OpenDesign preview" width="100%" />

# OpenDesign: The Open-Source Canva Alternative for SaaS

[![Deploy with Clawnify](https://app.clawnify.com/deploy-button.svg)](https://app.clawnify.com/deploy?repo=clawnify/OpenDesign)

A design editor for creating professional social media graphics — LinkedIn posts, quote cards, announcements, and more. Part of the [OpenClaw](https://github.com/openclaw/openclaw) ecosystem. Zero cloud dependencies — runs locally with SQLite.

Built with **Preact + Fabric.js + Tailwind CSS + Hono + SQLite**. Ships with a Figma-inspired dark editor UI, retina canvas rendering, and pre-built LinkedIn post templates.

## What Is It?

OpenDesign is a production-ready graphic design editor designed for the OpenClaw community. Think of it as an open-source Canva alternative — a visual design tool you can self-host, customize, and embed in any SaaS product.

Unlike Canva or Adobe Express, this runs entirely on your own infrastructure. No subscriptions, no watermarks, no vendor lock-in. Create pixel-perfect social media graphics with professional typography and export at 2x resolution.

## Features

- **Template fields** — name any text or image object, then fill it from data or an agent over the API; one name can drive several objects and pages at once
- **Fabric.js canvas** — full object manipulation with retina/HiDPI rendering (2x device pixel ratio)
- **Pre-built templates** — LinkedIn-optimized: Quote Card, Stats Highlight, Announcement, Tips List, Profile Card, Minimal Text
- **10 Google Fonts** — Inter, Playfair Display, Montserrat, Poppins, Roboto, Open Sans, Lora, Raleway, Source Sans Pro, Merriweather
- **Text editing** — font family, size, weight, alignment, color, line height, letter spacing
- **Shapes** — rectangles, circles, triangles, lines with fill, stroke, border radius
- **Image uploads** — drag-and-drop or click to upload, place on canvas
- **Backgrounds** — solid colors, gradients, uploaded images
- **Canvas sizes** — LinkedIn Square (1080x1080), LinkedIn Landscape (1200x627), LinkedIn Portrait (1200x1500), Instagram Story (1080x1920)
- **Undo/Redo** — full history with keyboard shortcuts (Cmd+Z / Cmd+Shift+Z)
- **2x PNG export** — crisp high-resolution output for social media
- **Auto-save** — designs persist to SQLite with debounced saves
- **Dual-mode UI** — human-optimized + AI-agent-optimized (`?agent=true`)

## Quickstart

```bash
git clone https://github.com/clawnify/OpenDesign.git
cd open-design
pnpm install
pnpm run dev
```

Open `http://localhost:5178` in your browser. Data persists in `data.db`, uploads in `uploads/`.

### Agent Mode (for OpenClaw / Claude Code)

Append `?agent=true` to the URL:

```
http://localhost:5178/?agent=true
```

This activates an agent-friendly UI with:
- Explicit buttons always visible (no hover-to-reveal)
- Large click targets for reliable browser automation
- All controls accessible without drag interactions
- Semantic labels for AI navigation

### Using with Claude Code

Claude Code can interact with the design editor through the REST API:

```bash
# Create a new design
curl -X POST http://localhost:3006/api/designs \
  -H "Content-Type: application/json" \
  -d '{"name": "Q1 Results", "width": 1080, "height": 1080}'

# Load a template
curl http://localhost:3006/api/templates/1

# Update design with canvas JSON
curl -X PUT http://localhost:3006/api/designs/1 \
  -H "Content-Type: application/json" \
  -d '{"canvas_json": "{...}"}'
```

OpenClaw agents can also use the browser tool to visually interact with the editor — navigate, click templates, edit text, and export PNGs.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Preact, TypeScript, Tailwind CSS v4, Vite |
| **Canvas** | Fabric.js v6 (retina rendering, object manipulation) |
| **Backend** | Hono, Node.js |
| **Database** | SQLite (better-sqlite3) |
| **Fonts** | Google Fonts (WebFontLoader) |
| **Icons** | Lucide |

### Prerequisites

- Node.js 20+
- pnpm (or npm/yarn)

## Architecture

```
src/
  server/
    schema.sql  — SQLite schema (designs, templates) + template seeds
    db.ts       — SQLite wrapper (query, get, run, transaction)
    index.ts    — Hono REST API (designs CRUD, templates, fields, uploads)
    fields.ts   — Template fields: read the fill schema, substitute values
    uploads.ts  — Local file upload management
    dev.ts      — Dev server with static file serving
  client/
    app.tsx           — Root component with WebFont loading
    context.tsx       — Editor context + canvas size presets
    hooks/
      use-canvas.ts   — Fabric.js state, undo/redo, zoom, export
      use-designs.ts  — Designs CRUD + auto-save + template loading
    components/
      editor.tsx        — Main layout (toolbar + sidebars + canvas)
      canvas.tsx        — Fabric.js canvas with retina rendering
      toolbar.tsx       — Size picker, undo/redo, zoom, export, save
      left-sidebar.tsx  — Templates, text, shapes, images, backgrounds
      right-sidebar.tsx — Properties panel (context-aware per selection)
      template-card.tsx — Template thumbnail in gallery
      design-list.tsx   — Saved designs list with rename/delete
```

### Data Model

```sql
designs   (id, name, canvas_json, width, height, thumbnail_url, created_at, updated_at)
templates (id, name, category, canvas_json, width, height, thumbnail_url, sort_order)
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/designs` | List all designs |
| POST | `/api/designs` | Create a design |
| GET | `/api/designs/:id` | Get a design |
| PUT | `/api/designs/:id` | Update a design |
| DELETE | `/api/designs/:id` | Delete a design |
| GET | `/api/designs/:id/fields` | List the design's fillable fields |
| POST | `/api/designs/:id/fill` | Fill those fields with values |
| GET | `/api/templates` | List all templates |
| GET | `/api/templates/:id` | Get a template |
| POST | `/api/uploads` | Upload an image file |
| GET | `/api/uploads/:filename` | Serve an uploaded image |

## Template Fields

Design something once, then produce as many variants of it as you have rows of
data — without anything on the outside having to understand canvas JSON.

Select a text or image object in the editor and give it a **Field name** in the
properties panel. That object is now a fill slot:

```bash
curl localhost:8787/api/designs/$ID/fields
```

```json
[
  { "name": "headline", "type": "text",  "value": "Your inspiring quote goes here", "page_ids": ["p1"] },
  { "name": "logo",     "type": "image", "value": "https://.../old.png",            "page_ids": ["p1", "p2"] }
]
```

Fill it. Text fields take a string (numbers are accepted and stringified),
image fields take a URL:

```bash
curl -X POST localhost:8787/api/designs/$ID/fill \
  -H 'content-type: application/json' \
  -d '{"values": {"headline": "Q3 revenue up 40%", "logo": "https://.../new.png"}}'
```

The response carries the filled pages plus `filled` and `unmatched`, so a name
that matches nothing is reported rather than failing the request. The stored
design is left alone — add `"save": true` (and optionally `"name"`) to persist
the result as a new design instead.

### How far this scales today

`save: true` writes a **new editable design**, not a rendered image, because
there is no server-side rasterizer. That makes it the right tool for a handful
of variants — an agent fills a card, opens it, exports it — and the wrong one
for a spreadsheet:

- Each saved variant is a row in `designs`, and `GET /api/designs` returns every
  row with its full `canvas_json` and no pagination. A three-object card is
  ~2.5 KB serialised; a branded design with an image is 10-40 KB. A few hundred
  variants turn the gallery response into megabytes.
- So a few hundred saved variants give you a few hundred gallery entries, not a
  few hundred finished graphics.

For real bulk output, drive `fill` without `save` and rasterize in the browser —
the canvas is already there, and that loop is the missing piece rather than a
server-side renderer. Until it exists, treat `save: true` as a small-N
convenience.

Worth knowing:

- A field name may repeat. One `logo` across five pages fills all five, which is
  what you want for a carousel.
- What gets written depends on the object, not the declared type: text objects
  take `text`, image objects take `src`.
- A replacement image keeps the original object's box, so a different aspect
  ratio will be stretched. Size the slot for the images you intend to feed it.
- Only text and image objects can be fields. Naming a shape does nothing.
- Rendering to PNG still happens in the browser — there is no server-side
  rasterizer, because Workers have no canvas.

## Community & Contributions

This project is part of the [OpenClaw](https://github.com/openclaw/openclaw) ecosystem. Contributions are welcome — open an issue or submit a PR.

## License

MIT
