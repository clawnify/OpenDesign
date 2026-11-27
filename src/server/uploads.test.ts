import assert from "node:assert/strict";
import { test } from "node:test";
import { initUploads, listImages, putUpload } from "./uploads";

test("the image library retains names and lists older uploads alongside new ones, across pages", async () => {
  const legacy = { key: "1700000000000_legacy.png" };
  const objects: { key: string; customMetadata?: { name: string } }[] = [];
  const bucket = {
    async put(key: string, _data: ArrayBuffer, options: { customMetadata: { name: string } }) {
      objects.push({ key, customMetadata: options.customMetadata });
    },
    async list({ cursor, include }: { cursor?: string; include: string[] }) {
      assert.deepEqual(include, ["customMetadata"]);
      if (!cursor) return { objects, truncated: true, cursor: "next" };
      assert.equal(cursor, "next");
      return { objects: [legacy, { key: "font-Custom-example.woff2" }], truncated: false };
    },
  } as unknown as R2Bucket;
  initUploads(bucket);
  const url = await putUpload("0-example.png", new Uint8Array([1]), "image/png", "Team logo.png");
  const first = await listImages(bucket);
  assert.deepEqual(first, { images: [{ name: "Team logo.png", url }], cursor: "next" });
  assert.deepEqual(await listImages(bucket, first.cursor!), {
    images: [{ name: legacy.key, url: `/api/uploads/${legacy.key}` }],
    cursor: null,
  });
});
