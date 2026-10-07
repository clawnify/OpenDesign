import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { importCustomFont, loadCustomFont } from "./fonts";
import { exportKit, importKit } from "./lib/kit-transfer";
import { listFonts, storeFont } from "../server/uploads";

test("custom fonts validate, persist, reload and travel with brand kits", async () => {
  const bytes = await readFile("node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2");
  const file = new File([bytes], "My Font.WOFF2");
  const objects = new Map<string, any>();
  const bucket = {
    put: async (key: string, data: ArrayBuffer, metadata: object) => objects.set(key, { key, data, ...metadata }),
    list: async ({ prefix, cursor }: { prefix: string; cursor?: string }) => {
      const entries = [...objects.values()].filter((obj) => obj.key.startsWith(prefix));
      // One object per page proves the library isn't silently truncated.
      const offset = Number(cursor || 0);
      return { objects: entries.slice(offset, offset + 1), truncated: offset + 1 < entries.length, cursor: String(offset + 1) };
    },
  };
  const stored = await storeFont(bucket as any, file);
  const second = await storeFont(bucket as any, file);
  assert.notEqual(stored.family, second.family);
  assert.equal(stored.name, "My Font");
  assert.equal(objects.get(stored.url.split("/").pop()!).httpMetadata.contentType, "font/woff2");
  assert.equal((await listFonts(bucket as any)).length, 2);
  for (const invalid of [
    new File([bytes], "image.png"),
    new File([], "empty.ttf"),
    new File(["not a font at all"], "broken.otf"),
    new File([bytes], "wrong-format.ttf"),
    new File([new Uint8Array(10 * 1024 * 1024 + 1)], "huge.woff2"),
  ]) await assert.rejects(storeFont(bucket as any, invalid), TypeError);
  assert.equal(objects.size, 2);

  const registered: string[] = [];
  class Face {
    loaded = false;
    constructor(public family: string, private source: string | ArrayBuffer) {}
    async load() {
      if (this.source instanceof ArrayBuffer && new DataView(this.source).getUint32(0) !== 0x774f4632) throw new Error("Decode failed");
      this.loaded = true;
      return this;
    }
  }
  Object.assign(globalThis, { FontFace: Face, document: { fonts: { add: (face: Face) => {
    assert.equal(face.loaded, true);
    registered.push(face.family);
  } } } });
  const nativeFetch = globalThis.fetch;
  let uploads = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("data:")) return nativeFetch(url, options);
    assert.equal(url, "/api/fonts");
    uploads++;
    const uploaded = (options?.body as FormData).get("file") as File;
    return Response.json(await storeFont(bucket as any, uploaded));
  };
  try {
    const imported = await importCustomFont(file);
    assert.deepEqual(registered, [imported.family]);
    await loadCustomFont(imported);
    assert.deepEqual(registered, [imported.family, imported.family]);
    await assert.rejects(importCustomFont(new File(["invalid file"], "broken.woff2")), /decoded/);
    assert.equal(uploads, 1);
    globalThis.fetch = async () => Response.json({ error: "Storage unavailable" }, { status: 500 });
    await assert.rejects(importCustomFont(file), /Storage unavailable/);
    assert.equal(registered.length, 2);

    const raw = JSON.stringify({
      name: "Portable kit", colors: ["#123456"], logos: [],
      heading_font: stored.family, body_font: stored.family,
      fonts: [{ family: stored.family, filename: "My Font.woff2", data: `data:font/woff2;base64,${bytes.toString("base64")}` }],
    });
    globalThis.fetch = nativeFetch;
    const result = await importKit(raw, async (font) => {
      assert.equal(font.name, "My Font.woff2");
      assert.deepEqual(Buffer.from(await font.arrayBuffer()), bytes);
      return "Custom-new-install";
    });
    assert.equal(result?.kit.heading_font, "Custom-new-install");
    assert.equal(result?.kit.body_font, "Custom-new-install");
    assert.equal(result?.missing, 0);
    const failed = await importKit(raw, async () => { throw new Error("Storage unavailable"); });
    assert.equal(failed?.missing, 1);
    assert.equal(failed?.kit.heading_font, stored.family);

    Object.assign(globalThis, { FileReader: class {
      result: string | null = null;
      onload = () => {};
      readAsDataURL(blob: Blob) {
        blob.arrayBuffer().then(data => {
          this.result = `data:${blob.type};base64,${Buffer.from(data).toString("base64")}`;
          this.onload();
        });
      }
    } });
    globalThis.fetch = async () => new Response(bytes, { headers: { "Content-Type": "font/woff2" } });
    const exported = await exportKit({ ...JSON.parse(raw), id: "kit", created_at: "", updated_at: "" }, [stored]);
    assert.equal(exported.missing, 0);
    const portable = JSON.parse(exported.json);
    assert.equal(portable.fonts.length, 1);
    assert.equal(portable.fonts[0].family, stored.family);
    assert.ok(portable.fonts[0].data.startsWith("data:font/woff2;base64,"));
  } finally {
    globalThis.fetch = nativeFetch;
  }
});
