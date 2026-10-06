// Image uploads live in the app's R2 bucket (the UPLOADS binding Clawnify
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
