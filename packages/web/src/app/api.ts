// Fetch wrapper for /api with the session cookie (SPEC §5: errors are 400 { error: { field: message } }).
export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  body: unknown;
  constructor(status: number, body: any) {
    const fields = body && typeof body === 'object' && body.error && typeof body.error === 'object' ? body.error : {};
    super(`HTTP ${status}`);
    this.status = status; this.fields = fields; this.body = body;
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json', ...opts.headers };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(path, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    credentials: 'same-origin', headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}
