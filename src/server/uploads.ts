let _bucket: R2Bucket;

export function initUploads(bucket: R2Bucket) {
  _bucket = bucket;
}

export async function putUpload(
  filename: string,
  data: ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<string> {
  await _bucket.put(filename, data, { httpMetadata: { contentType } });
  return `/api/uploads/${filename}`;
}

export async function getUpload(
  filename: string,
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  const obj = await _bucket.get(filename);
  if (!obj) return null;
  return {
    data: await obj.arrayBuffer(),
    contentType: obj.httpMetadata?.contentType || "application/octet-stream",
  };
}

export async function deleteUpload(filename: string): Promise<void> {
  await _bucket.delete(filename);
}

export async function readUploadAsBase64DataUrl(
  filename: string,
): Promise<string | null> {
  const result = await getUpload(filename);
  if (!result) return null;
  const bytes = new Uint8Array(result.data);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return `data:${result.contentType};base64,${btoa(binary)}`;
}
