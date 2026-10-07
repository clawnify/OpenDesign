// Image and font uploads live in the app's R2 bucket (the UPLOADS binding Clawnify
// provisions for `storage: true`). The bucket is handed in per request by the
// middleware in index.ts.

let _bucket: R2Bucket;

export function initUploads(bucket: R2Bucket) {
  _bucket = bucket;
}

function sanitize(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function putUpload(filename: string, data: ArrayBuffer | Uint8Array, contentType: string): Promise<string> {
  const safe = sanitize(filename);
  await _bucket.put(safe, data, { httpMetadata: { contentType } });
  return `/api/uploads/${safe}`;
}

export async function getUpload(filename: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  const obj = await _bucket.get(sanitize(filename));
  if (!obj) return null;
  return {
    data: await obj.arrayBuffer(),
    contentType: obj.httpMetadata?.contentType || "application/octet-stream",
  };
}

export async function deleteUpload(filename: string): Promise<void> {
  await _bucket.delete(sanitize(filename));
}

const FONT_TYPES: Record<string, { signature: number; mime: string }> = {
  ttf: { signature: 0x00010000, mime: "font/ttf" },
  otf: { signature: 0x4f54544f, mime: "font/otf" },
  woff: { signature: 0x774f4646, mime: "font/woff" },
  woff2: { signature: 0x774f4632, mime: "font/woff2" },
};

export async function storeFont(bucket: typeof _bucket, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const format = FONT_TYPES[ext];
  if (!format) throw new TypeError("Choose a TTF, OTF, WOFF or WOFF2 font file.");
  if (!file.size || file.size > 10 * 1024 * 1024) throw new TypeError("Fonts must be between 1 byte and 10 MB.");
  const data = await file.arrayBuffer();
  if (data.byteLength < 12 || new DataView(data).getUint32(0) !== format.signature) {
    throw new TypeError("That file is not a valid font of the selected type.");
  }
  const family = `Custom-${crypto.randomUUID()}`;
  const name = file.name.replace(/\.[^.]+$/, "").replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 100) || "Custom font";
  const key = `font-${family}.${ext}`;
  await bucket.put(key, data, {
    httpMetadata: { contentType: format.mime },
    customMetadata: { family, name },
  });
  return { family, name, url: `/api/uploads/${key}` };
}

export async function listFonts(bucket: typeof _bucket) {
  const fonts: { family: string; name: string; url: string }[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: "font-", include: ["customMetadata"], cursor });
    for (const object of page.objects) {
      const { family, name } = object.customMetadata || {};
      if (family && name) fonts.push({ family, name, url: `/api/uploads/${object.key}` });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return fonts.sort((a, b) => a.name.localeCompare(b.name));
}
