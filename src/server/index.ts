import { createApp, createRoute, z } from "@clawnify/app";
import { query, get, run } from "./db.js";
import { initUploads, putUpload, getUpload } from "./uploads.js";
import { SEED_TEMPLATES } from "./seed-templates.js";

type Env = { Bindings: { DB: D1Database; UPLOADS: R2Bucket } };

const app = createApp<Env>({ title: "OpenDesign API", version: "1.0.0" });

// ── Starter templates ───────────────────────────────────────────────
//
// schema.sql is applied as DDL only by the Clawnify deploy pipeline, so the
// starter templates cannot be seeded there. They are inserted here instead,
// once per isolate, on the first request that reaches the app.
//
// Seeded only while the table is empty — the semantics the old schema.sql
// comment described. INSERT OR IGNORE alone is not enough: a row the user
// deleted no longer conflicts, so it would come back on the next cold isolate.
// The count guard keeps a deletion deleted; INSERT OR IGNORE on the explicit
// id keeps an edit intact and makes two concurrent cold requests harmless.
// Failures are swallowed — sample data must never turn into a failed request.

let seeded = false;

async function ensureSeeded() {
  if (seeded) return;
  seeded = true;
  try {
    const existing = await get<{ c: number }>("SELECT COUNT(*) as c FROM templates");
    if ((existing?.c ?? 0) > 0) return;
    for (const t of SEED_TEMPLATES) {
      await run(
        "INSERT OR IGNORE INTO templates (id, name, category, canvas_json, width, height, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [t.id, t.name, t.category, t.canvas_json, t.width, t.height, t.sort_order]
      );
    }
  } catch {
    seeded = false;
  }
}

// Runs after createApp's own initDB middleware, so the DB is ready here.
app.use("*", async (c, next) => {
  initUploads(c.env.UPLOADS);
  await ensureSeeded();
  await next();
});

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
  // RETURNING hands back the row just inserted; "newest by created_at" can pick
  // another design created in the same second.
  const row = await get<z.infer<typeof DesignSchema>>(
    "INSERT INTO designs (name, canvas_json, width, height) VALUES (?, ?, ?, ?) RETURNING *",
    [name || "Untitled Design", canvasData, width || 1080, height || 1080]
  );
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

  const page = await get<z.infer<typeof PageSchema>>(
    "INSERT INTO pages (design_id, title, canvas_json, sort_order) VALUES (?, ?, ?, ?) RETURNING *",
    [id, title, body.canvas_json || "{}", insertOrder]
  );
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
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "public, max-age=31536000",
      // Uploads include SVG, which can carry script. Opened directly, the file
      // must not run as a page on the app's origin; <img> and canvas are unaffected.
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export default app;
