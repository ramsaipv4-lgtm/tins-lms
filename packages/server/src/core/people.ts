// Org-level helpers shared by route modules: the org document, Terms & Conditions, people, age rules.
import { ApiError } from './http.ts';
import { SCHEMA } from './config.ts';
import { randomKey } from './ids.ts';

export const ORG_DB = 'org';
export const ORG_ID = 'org:main';
export const DEFAULT_TNC = { version: '1', text: 'Terms and Conditions: use this learning platform responsibly and honestly.' };

export async function ensureOrg(ctx: any): Promise<{ doc: any; created: boolean }> {
  const existing = await ctx.store.get(ORG_DB, ORG_ID);
  if (existing) { ctx.hubId = existing.hubId; return { doc: existing, created: false }; }
  const doc = await ctx.store.put(ORG_DB, {
    type: 'org', id: ORG_ID, schema: SCHEMA, name: 'Coach LMS', brand: {}, switches: {},
    hubId: ctx.hubId ?? randomKey(), updatedAt: ctx.clock.now(), updatedBy: 'system',
  });
  ctx.hubId = doc.hubId;
  return { doc, created: true };
}

export async function currentTnc(ctx: any): Promise<{ version: string; text: string }> {
  const d = await ctx.store.get(ORG_DB, 'tnc:current');
  return d ? { version: String(d.version), text: String(d.text) } : DEFAULT_TNC;
}

export async function getPerson(ctx: any, key: string): Promise<any | null> {
  return ctx.store.get(ORG_DB, `person:${key}`);
}

// Insert-or-merge a person document; `patch` wins over what is stored.
export async function savePerson(ctx: any, key: string, patch: Record<string, any>): Promise<any> {
  const prev = (await getPerson(ctx, key)) ?? { type: 'person', id: `person:${key}`, schema: SCHEMA, name: '', roles: [], minor: false };
  return ctx.store.put(ORG_DB, { ...prev, ...patch, updatedAt: ctx.clock.now(), updatedBy: patch.updatedBy ?? key });
}

// Date of birth "YYYY-MM-DD" -> true when under 18 at `now` (D-33). Throws a 400 for an impossible date.
export function isMinor(dob: string, now: number): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  const t = m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  const back = Number.isNaN(t) ? null : new Date(t);
  if (!m || !back || back.getUTCFullYear() !== +m[1] || back.getUTCMonth() !== +m[2] - 1 || back.getUTCDate() !== +m[3] || t > now) {
    throw new ApiError(400, { error: { dob: 'invalid-date' } });
  }
  const eighteen = Date.UTC(+m[1] + 18, +m[2] - 1, +m[3]);
  return now < eighteen;
}
