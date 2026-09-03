import { createApp, createRoute, z } from "@clawnify/app";
import { query, get, run } from "./db.js";
import { putUpload, getUpload } from "./uploads.js";
import { collectFields, fillPages } from "./fields.js";

type Env = { Bindings: { DB: D1Database } };

const app = createApp<Env>({ title: "OpenDesign API", version: "1.0.0" });

// ── Schemas ──────────────────────────────────────────────────────────

const DesignSchema = z.object({
  id: z.string(),
  name: z.string(),
  canvas_json: z.string(),
  width: z.number(),
  height: z.number(),
  thumbnail_url: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const TemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  canvas_json: z.string(),
  width: z.number(),
  height: z.number(),
  thumbnail_url: z.string().nullable(),
  sort_order: z.number(),
});

const PageSchema = z.object({
  id: z.string(),
  design_id: z.string(),
  title: z.string(),
  canvas_json: z.string(),
  sort_order: z.number(),
  created_at: z.string(),
});

const DesignWithPagesSchema = DesignSchema.extend({
  pages: z.array(PageSchema),
});

const ErrorSchema = z.object({ error: z.string() });

// ── List designs ────────────────────────────────────────────────────

const listDesigns = createRoute({
  method: "get",
  path: "/api/designs",
  responses: { 200: { content: { "application/json": { schema: z.array(DesignSchema) } }, description: "OK" } },
});

app.openapi(listDesigns, async (c) => {
  const rows = await query<z.infer<typeof DesignSchema>>("SELECT * FROM designs ORDER BY updated_at DESC");
  return c.json(rows, 200);
});

// ── Get design ──────────────────────────────────────────────────────

const getDesign = createRoute({
  method: "get",
  path: "/api/designs/{id}",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: DesignWithPagesSchema } }, description: "OK" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
  },
});

app.openapi(getDesign, async (c) => {
  const { id } = c.req.valid("param");
  const row = await get<z.infer<typeof DesignSchema>>("SELECT * FROM designs WHERE id = ?", [id]);
  if (!row) return c.json({ error: "Not found" }, 404);
  const pages = await query<z.infer<typeof PageSchema>>(
    "SELECT * FROM pages WHERE design_id = ? ORDER BY sort_order",
    [id]
  );
  return c.json({ ...row, pages }, 200);
});

// ── Create design ───────────────────────────────────────────────────

const createDesign = createRoute({
  method: "post",
  path: "/api/designs",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().optional(),
            canvas_json: z.string().optional(),
            width: z.number().optional(),
            height: z.number().optional(),
          }),
        },
      },
    },
  },
  responses: { 200: { content: { "application/json": { schema: DesignSchema } }, description: "OK" } },
});

app.openapi(createDesign, async (c) => {
  const { name, canvas_json, width, height } = c.req.valid("json");
  const canvasData = canvas_json || "{}";
  await run(
    "INSERT INTO designs (name, canvas_json, width, height) VALUES (?, ?, ?, ?)",
    [name || "Untitled Design", canvasData, width || 1080, height || 1080]
  );
  const row = await get<z.infer<typeof DesignSchema>>("SELECT * FROM designs ORDER BY created_at DESC LIMIT 1");
  // Auto-create first page
  await run(
    "INSERT INTO pages (design_id, title, canvas_json, sort_order) VALUES (?, ?, ?, ?)",
    [row!.id, "Page 1", canvasData, 0]
  );
  return c.json(row!, 200);
});

// ── Update design ───────────────────────────────────────────────────

const updateDesign = createRoute({
  method: "put",
  path: "/api/designs/{id}",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().optional(),
            canvas_json: z.string().optional(),
            width: z.number().optional(),
            height: z.number().optional(),
            thumbnail_url: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { "application/json": { schema: DesignSchema } }, description: "OK" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
  },
});

app.openapi(updateDesign, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const existing = await get<z.infer<typeof DesignSchema>>("SELECT * FROM designs WHERE id = ?", [id]);
  if (!existing) return c.json({ error: "Not found" }, 404);

  await run(
    `UPDATE designs SET name = ?, canvas_json = ?, width = ?, height = ?, thumbnail_url = ?, updated_at = datetime('now') WHERE id = ?`,
    [body.name ?? existing.name, body.canvas_json ?? existing.canvas_json, body.width ?? existing.width, body.height ?? existing.height, body.thumbnail_url ?? existing.thumbnail_url, id]
  );
  const row = await get<z.infer<typeof DesignSchema>>("SELECT * FROM designs WHERE id = ?", [id]);
  return c.json(row!, 200);
});

// ── Delete design ───────────────────────────────────────────────────

const deleteDesign = createRoute({
  method: "delete",
  path: "/api/designs/{id}",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "OK" },
  },
});

app.openapi(deleteDesign, async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM designs WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// ── Template fields ─────────────────────────────────────────────────
//
// A design becomes a template the moment any object carries a `fieldName`.
// `/fields` publishes the schema so a caller knows what it can fill; `/fill`
// substitutes values without touching the stored design, or writes the result
// as a new design when `save` is set. Together they cover "generate N variants
// from a row of data" without the caller ever parsing canvas JSON.

const FieldSchema = z.object({
  name: z.string(),
  type: z.enum(["text", "image"]),
  value: z.string(),
  page_ids: z.array(z.string()),
});

const listFields = createRoute({
  method: "get",
  path: "/api/designs/{id}/fields",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.array(FieldSchema) } }, description: "OK" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
  },
});

app.openapi(listFields, async (c) => {
  const { id } = c.req.valid("param");
  const design = await get<{ id: string }>("SELECT id FROM designs WHERE id = ?", [id]);
  if (!design) return c.json({ error: "Not found" }, 404);
  const pages = await query<z.infer<typeof PageSchema>>(
    "SELECT * FROM pages WHERE design_id = ? ORDER BY sort_order",
    [id]
  );
  return c.json(collectFields(pages), 200);
});

// ── Fill a design ───────────────────────────────────────────────────

const FilledPageSchema = z.object({
  id: z.string(),
  title: z.string(),
  sort_order: z.number(),
  canvas_json: z.string(),
});

const FillResponseSchema = z.object({
  design: DesignSchema,
  pages: z.array(FilledPageSchema),
  filled: z.array(z.string()),
  unmatched: z.array(z.string()),
});

const fillDesign = createRoute({
  method: "post",
  path: "/api/designs/{id}/fill",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            values: z.record(z.union([z.string(), z.number()])),
            // Persist the result as a new design instead of only returning it.
            save: z.boolean().optional(),
            name: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { "application/json": { schema: FillResponseSchema } }, description: "OK" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
  },
});

app.openapi(fillDesign, async (c) => {
  const { id } = c.req.valid("param");
  const { values, save, name } = c.req.valid("json");

  const design = await get<z.infer<typeof DesignSchema>>("SELECT * FROM designs WHERE id = ?", [id]);
  if (!design) return c.json({ error: "Not found" }, 404);

  const pages = await query<z.infer<typeof PageSchema>>(
    "SELECT * FROM pages WHERE design_id = ? ORDER BY sort_order",
    [id]
  );

  // Numbers are the common case for stat cards, so accept them and stringify
  // rather than making every caller do it.
  const strings = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)]));
  const { pages: filledPages, filled, unmatched } = fillPages(pages, strings);

  const body = filledPages.map((p) => ({
    id: p.id,
    title: p.title,
    sort_order: p.sort_order,
    canvas_json: p.canvas_json,
  }));

  if (!save) return c.json({ design, pages: body, filled, unmatched }, 200);

  // Ids are generated here rather than by the column default so the new rows
  // can be linked without a racy "most recently created" lookup.
  const newDesignId = crypto.randomUUID();
  await run(
    "INSERT INTO designs (id, name, canvas_json, width, height) VALUES (?, ?, ?, ?, ?)",
    [
      newDesignId,
      name || `${design.name} (filled)`,
      // designs.canvas_json mirrors page 1, matching what the editor writes.
      filledPages[0]?.canvas_json ?? design.canvas_json,
      design.width,
      design.height,
    ]
  );

  const createdPages = filledPages.map((p) => ({ ...p, id: crypto.randomUUID() }));
  for (const p of createdPages) {
    await run(
      "INSERT INTO pages (id, design_id, title, canvas_json, sort_order) VALUES (?, ?, ?, ?, ?)",
      [p.id, newDesignId, p.title, p.canvas_json, p.sort_order]
    );
  }

  const created = await get<z.infer<typeof DesignSchema>>("SELECT * FROM designs WHERE id = ?", [newDesignId]);
  return c.json(
    {
      design: created!,
      pages: createdPages.map((p) => ({
        id: p.id,
        title: p.title,
        sort_order: p.sort_order,
        canvas_json: p.canvas_json,
      })),
      filled,
      unmatched,
    },
    200
  );
});

// ── Add page ───────────────────────────────────────────────────────

const addPage = createRoute({
  method: "post",
  path: "/api/designs/{id}/pages",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            title: z.string().optional(),
            canvas_json: z.string().optional(),
            after_sort_order: z.number().optional(),
          }),
        },
      },
    },
  },
  responses: { 200: { content: { "application/json": { schema: PageSchema } }, description: "OK" } },
});

app.openapi(addPage, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const count = await get<{ c: number }>("SELECT COUNT(*) as c FROM pages WHERE design_id = ?", [id]);
  const title = body.title || `Page ${(count?.c ?? 0) + 1}`;

  let insertOrder: number;
  if (body.after_sort_order !== undefined) {
    await run(
      "UPDATE pages SET sort_order = sort_order + 1 WHERE design_id = ? AND sort_order > ?",
      [id, body.after_sort_order]
    );
    insertOrder = body.after_sort_order + 1;
  } else {
    const maxOrder = await get<{ m: number }>("SELECT COALESCE(MAX(sort_order), -1) as m FROM pages WHERE design_id = ?", [id]);
    insertOrder = (maxOrder?.m ?? -1) + 1;
  }

  await run(
    "INSERT INTO pages (design_id, title, canvas_json, sort_order) VALUES (?, ?, ?, ?)",
    [id, title, body.canvas_json || "{}", insertOrder]
  );
  const page = await get<z.infer<typeof PageSchema>>("SELECT * FROM pages WHERE design_id = ? ORDER BY created_at DESC LIMIT 1", [id]);
  return c.json(page!, 200);
});

// ── Duplicate page ─────────────────────────────────────────────────

const duplicatePage = createRoute({
  method: "post",
  path: "/api/pages/{pageId}/duplicate",
  request: { params: z.object({ pageId: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: PageSchema } }, description: "OK" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
  },
});

app.openapi(duplicatePage, async (c) => {
  const { pageId } = c.req.valid("param");
  const original = await get<z.infer<typeof PageSchema>>("SELECT * FROM pages WHERE id = ?", [pageId]);
  if (!original) return c.json({ error: "Not found" }, 404);
  // Shift sort_order of pages after the original
  await run(
    "UPDATE pages SET sort_order = sort_order + 1 WHERE design_id = ? AND sort_order > ?",
    [original.design_id, original.sort_order]
  );
  await run(
    "INSERT INTO pages (design_id, title, canvas_json, sort_order) VALUES (?, ?, ?, ?)",
    [original.design_id, `${original.title} (copy)`, original.canvas_json, original.sort_order + 1]
  );
  const page = await get<z.infer<typeof PageSchema>>("SELECT * FROM pages WHERE design_id = ? AND sort_order = ?", [original.design_id, original.sort_order + 1]);
  return c.json(page!, 200);
});

// ── Update page ────────────────────────────────────────────────────

const updatePage = createRoute({
  method: "put",
  path: "/api/pages/{pageId}",
  request: {
    params: z.object({ pageId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            title: z.string().optional(),
            canvas_json: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { "application/json": { schema: PageSchema } }, description: "OK" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
  },
});

app.openapi(updatePage, async (c) => {
  const { pageId } = c.req.valid("param");
  const body = c.req.valid("json");
  const existing = await get<z.infer<typeof PageSchema>>("SELECT * FROM pages WHERE id = ?", [pageId]);
  if (!existing) return c.json({ error: "Not found" }, 404);
  await run(
    "UPDATE pages SET title = ?, canvas_json = ? WHERE id = ?",
    [body.title ?? existing.title, body.canvas_json ?? existing.canvas_json, pageId]
  );
  const page = await get<z.infer<typeof PageSchema>>("SELECT * FROM pages WHERE id = ?", [pageId]);
  return c.json(page!, 200);
});

// ── Delete page ────────────────────────────────────────────────────

const deletePage = createRoute({
  method: "delete",
  path: "/api/pages/{pageId}",
  request: { params: z.object({ pageId: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "OK" },
    400: { content: { "application/json": { schema: ErrorSchema } }, description: "Cannot delete last page" },
  },
});

app.openapi(deletePage, async (c) => {
  const { pageId } = c.req.valid("param");
  const page = await get<z.infer<typeof PageSchema>>("SELECT * FROM pages WHERE id = ?", [pageId]);
  if (!page) return c.json({ ok: true }, 200);
  const count = await get<{ c: number }>("SELECT COUNT(*) as c FROM pages WHERE design_id = ?", [page.design_id]);
  if ((count?.c ?? 0) <= 1) return c.json({ error: "Cannot delete the last page" }, 400);
  await run("DELETE FROM pages WHERE id = ?", [pageId]);
  return c.json({ ok: true }, 200);
});

// ── List templates ──────────────────────────────────────────────────

const listTemplates = createRoute({
  method: "get",
  path: "/api/templates",
  responses: { 200: { content: { "application/json": { schema: z.array(TemplateSchema) } }, description: "OK" } },
});

app.openapi(listTemplates, async (c) => {
  const rows = await query<z.infer<typeof TemplateSchema>>("SELECT * FROM templates ORDER BY sort_order");
  return c.json(rows, 200);
});

// ── Get template ────────────────────────────────────────────────────

const getTemplate = createRoute({
  method: "get",
  path: "/api/templates/{id}",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: TemplateSchema } }, description: "OK" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
  },
});

app.openapi(getTemplate, async (c) => {
  const { id } = c.req.valid("param");
  const row = await get<z.infer<typeof TemplateSchema>>("SELECT * FROM templates WHERE id = ?", [id]);
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row, 200);
});

// ── File uploads ────────────────────────────────────────────────────

app.post("/api/uploads", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!file || typeof file === "string") {
    return c.json({ error: "No file provided" }, 400);
  }

  const ext = file.name?.split(".").pop()?.toLowerCase() || "png";
  const allowed = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
  if (!allowed.has(ext)) {
    return c.json({ error: "Unsupported file type" }, 400);
  }

  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const data = await file.arrayBuffer();
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : ext === "svg" ? "image/svg+xml" : "image/png";
  const url = await putUpload(filename, data, mime);

  return c.json({ url }, 200);
});

app.get("/api/uploads/:filename", async (c) => {
  const { filename } = c.req.param();
  const result = await getUpload(filename);
  if (!result) return c.json({ error: "Not found" }, 404);

  return new Response(result.data, {
    headers: { "Content-Type": result.contentType, "Cache-Control": "public, max-age=31536000" },
  });
});

export default app;
