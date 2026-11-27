import type {Page} from "./types";

export class ApiError extends Error {
  constructor(readonly status: number, readonly data: {error?: string; current?: Page; conflicts: string[]}) {
    super(data.error || "Request failed");
  }
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = { method, headers: {} };
  if (body) {
    (opts.headers as Record<string, string>)["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(path, opts);
  const data = await r.json();
  if (!r.ok) throw new ApiError(r.status, data as ConstructorParameters<typeof ApiError>[1]);
  return data as T;
}
