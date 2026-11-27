import { createRoute, orgId, z } from "@clawnify/app";
import { ClawnifyServicesError, renderScreenshot } from "@clawnify/services";
import { get } from "./db.js";
import { fontCss, script, scriptHash } from "./render-bundle.generated.js";
import { listFonts } from "./uploads.js";
import type { Context } from "hono";

export type RenderEnv = {
  Bindings: {
    DB: D1Database;
    UPLOADS: R2Bucket;
    CLAWNIFY_TOKEN?: string;
    CLAWNIFY_SERVICES_URL?: string;
  };
};

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_CANVAS_EDGE = 8192;
const MAX_CANVAS_PIXELS = 16_777_216;
const LOCAL_UPLOAD = /^\/api\/uploads\/([a-zA-Z0-9._-]+)$/;
const RASTER_OR_SVG = /^image\/(png|jpeg|webp|gif|svg\+xml)$/;
const FONT_MIME = /^font\/(ttf|otf|woff2?)$/;
const ErrorBody = z.object({ error: z.string() });
const renderError = { description: "Render unavailable", content: { "application/json": { schema: ErrorBody } } };

export const renderDesignRoute = createRoute({
  method: "get",
  path: "/api/designs/{id}/render",
  summary: "Render one saved design page as PNG",
  description: "Use clawnify_app_api_read with as_image: true for an inline preview. Omit page_id for the first page, or pass max_size to fit the output within that many pixels on its longest edge. Pass download=1 to download the same PNG.",
  request: {
    params: z.object({ id: z.string().min(1).max(128) }),
    query: z.object({
      page_id: z.string().min(1).max(128).optional(),
      scale: z.enum(["1", "2"]).optional(),
      download: z.literal("1").optional(),
      max_size: z.coerce.number().int().min(64).max(MAX_CANVAS_EDGE).optional(),
    }),
  },
  responses: {
    200: { description: "PNG image", content: { "image/png": { schema: z.string().openapi({ format: "binary" }) } } },
    401: renderError,
    402: renderError,
    403: renderError,
    404: renderError,
    422: renderError,
    429: renderError,
    502: renderError,
    503: renderError,
  },
});

class RenderInputError extends Error {}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

function* objects(value: unknown): Generator<Record<string, unknown>> {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) yield* objects(item);
    return;
  }
  const record = value as Record<string, unknown>;
  yield record;
  for (const child of Object.values(record)) yield* objects(child);
}

async function prepareAssets(canvas: Record<string, unknown>, bucket: R2Bucket, initialSize: number) {
  let remaining = MAX_INPUT_BYTES - initialSize;
  const assets = new Map<string, string>();
  const families = new Set<string>();

  async function inlineUpload(url: string, types: RegExp) {
    const match = LOCAL_UPLOAD.exec(url);
    if (!match) throw new RenderInputError("Import linked images into this workspace before rendering.");
    const cached = assets.get(url);
    if (cached) return cached;
    const object = await bucket.get(match[1]);
    if (!object) throw new RenderInputError("An image or font used in this page could not be found.");
    const type = object.httpMetadata?.contentType ?? "";
    if (!types.test(type)) throw new RenderInputError("An image or font used in this page has an unsupported file type.");
    const encodedBytes = Math.ceil(object.size / 3) * 4;
    if (encodedBytes > remaining) throw new RenderInputError("This page exceeds the render input limit.");
    remaining -= encodedBytes;
    const data = `data:${type};base64,${base64(new Uint8Array(await object.arrayBuffer()))}`;
    assets.set(url, data);
    return data;
  }

  for (const object of objects(canvas)) {
    if (typeof object.fontFamily === "string") {
      families.add(object.fontFamily);
    }
    const type = String(object.type).toLowerCase();
    const key = type === "image" ? "src" : type === "pattern" ? "source" : null;
    if (!key || typeof object[key] !== "string") continue;
    const source = object[key];
    if (/^data:image\/(png|jpeg|webp|gif|svg\+xml)[;,]/.test(source)) continue;
    object[key] = await inlineUpload(source, RASTER_OR_SVG);
  }

  const fonts = [];
  const customFamilies = [...families].filter((family) => family.startsWith("Custom-"));
  if (customFamilies.length) {
    const uploaded = await listFonts(bucket);
    for (const family of customFamilies) {
      const font = uploaded.find((entry) => entry.family === family);
      if (!font) throw new RenderInputError("A font used in this page could not be found.");
      fonts.push({ ...font, url: await inlineUpload(font.url, FONT_MIME) });
    }
  }
  const css = [...families].filter((family) => Object.hasOwn(fontCss, family)).map((family) => fontCss[family]).join("");
  return { fonts, css };
}

function renderHtml(input: object, css: string): string {
  const data = JSON.stringify(input).replaceAll("<", "\\u003c");
  // Only the app's bundled renderer can execute. Uploaded design assets are
  // passed as data and the capture browser has no workspace credentials.
  return `<!doctype html><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'sha256-${scriptHash}'">
<style>body{margin:0}img{display:block}${css}</style>
<body><script type="application/json" id="design-input">${data}</script>
<script>${script}</script>`;
}

export async function renderSavedDesign(c: Context<RenderEnv, string, {
  out: { param: { id: string }; query: { page_id?: string; scale?: "1" | "2"; max_size?: number; download?: "1" } };
}>) {
  const workspaceId = orgId(c);
  if (!workspaceId) return c.json({ error: "Sign in to the workspace to render a design." }, 401);
  if (!c.env.CLAWNIFY_TOKEN) return c.json({ error: "Managed design rendering is unavailable in this workspace." }, 503);

  const { id } = c.req.valid("param");
  const { page_id: pageId, scale = "1", max_size: maxSize, download } = c.req.valid("query");
  const design = await get<{ name: string; width: number; height: number; canvas_json: string }>(
    "SELECT name, width, height, canvas_json FROM designs WHERE id = ?", [id],
  );
  if (!design) return c.json({ error: "Design not found." }, 404);

  const page = pageId
    ? await get<{ canvas_json: string }>("SELECT canvas_json FROM pages WHERE design_id = ? AND id = ?", [id, pageId])
    : await get<{ canvas_json: string }>("SELECT canvas_json FROM pages WHERE design_id = ? ORDER BY sort_order LIMIT 1", [id]);
  if (pageId && !page) return c.json({ error: "Page not found in this design." }, 404);

  const { width, height } = design;
  const longestEdge = Math.max(width, height);
  const multiplier = Math.min(Number(scale), maxSize ? maxSize / longestEdge : Infinity);
  const outputWidth = Math.max(1, Math.floor(width * multiplier));
  const outputHeight = Math.max(1, Math.floor(height * multiplier));
  if (![width, height].every(Number.isSafeInteger) || width < 1 || height < 1 ||
      longestEdge > MAX_CANVAS_EDGE || width * height > MAX_CANVAS_PIXELS) {
    return c.json({ error: "This canvas is larger than the renderer can load." }, 422);
  }
  if (Math.max(outputWidth, outputHeight) > MAX_CANVAS_EDGE || outputWidth * outputHeight > MAX_CANVAS_PIXELS) {
    return c.json({ error: "The design exceeds the render dimensions. Use max_size for a smaller export." }, 422);
  }

  try {
    const json = page?.canvas_json ?? design.canvas_json;
    if (json.length > MAX_INPUT_BYTES) throw new RenderInputError("This page exceeds the render input limit.");
    let canvas: Record<string, unknown>;
    try {
      canvas = JSON.parse(json);
    } catch {
      throw new RenderInputError("The saved design has invalid canvas data.");
    }
    if (!canvas || Array.isArray(canvas) || typeof canvas !== "object") {
      throw new RenderInputError("The saved design has invalid canvas data.");
    }
    const { fonts, css } = await prepareAssets(canvas, c.env.UPLOADS, json.length);
    const html = renderHtml({ canvas, fonts, width, height, scale: multiplier }, css);
    if (new TextEncoder().encode(html).byteLength > MAX_INPUT_BYTES) {
      throw new RenderInputError("This page exceeds the render input limit.");
    }

    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${workspaceId}\n${html}`));
    const key = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const cache = await caches.open("opendesign-render").catch(() => undefined);
    const cacheKey = new Request(new URL(`/__opendesign_render_cache/${key}`, c.req.url));
    let image: Response | undefined = await cache?.match(cacheKey).catch(() => undefined);
    if (!image) {
      const png = await renderScreenshot(c.env, {
        html,
        viewport: { width: outputWidth, height: outputHeight, deviceScaleFactor: 1 },
        type: "png",
        omitBackground: true,
        waitForSelector: "#rendered-page",
      });
      image = new Response(png as Uint8Array<ArrayBuffer>, {
        headers: { "Content-Type": "image/png", "Cache-Control": "max-age=86400" },
      });
      if (cache) await cache.put(cacheKey, image.clone()).catch(() => undefined);
    }
    const filename = design.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "design";
    return new Response(image.body, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}.png"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof RenderInputError) return c.json({ error: error.message }, 422);
    if (error instanceof ClawnifyServicesError) {
      if (error.status === 402) return c.json({ error: "This workspace is out of render credits." }, 402);
      if (error.status === 403) return c.json({ error: "This workspace cannot use the screenshot service." }, 403);
      if (error.status === 429) return c.json({ error: "The render service is busy. Try again shortly." }, 429);
    }
    return c.json({ error: "Could not render this design. Check that its images and fonts load in the editor." }, 502);
  }
}
