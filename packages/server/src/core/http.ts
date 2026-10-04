// Errors and validation shared by every route (SPEC §5): invalid input -> 400 { error: { field: message } }.
import type { ZodType } from 'zod';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`api error ${status}`);
    this.status = status;
    this.body = body;
  }
}

export const fieldError = (field: string, message: string, status = 400) =>
  new ApiError(status, { error: { [field]: message } });

export function zodFields(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.length ? issue.path.map(String).join('.') : '_';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export function parseWith<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new ApiError(400, { error: zodFields(r.error.issues) });
  return r.data;
}

// Reads the JSON body of a Hono context and validates it. An empty body counts as {}.
export async function validateBody<T>(c: any, schema: ZodType<T>): Promise<T> {
  let data: unknown = {};
  const text = await c.req.text();
  if (text.trim() !== '') {
    try { data = JSON.parse(text); } catch { throw fieldError('body', 'invalid-json'); }
  }
  return parseWith(schema, data);
}

export function validateQuery<T>(c: any, schema: ZodType<T>): T {
  return parseWith(schema, c.req.query());
}
