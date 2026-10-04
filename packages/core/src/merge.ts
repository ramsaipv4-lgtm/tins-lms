// Conflict merge (SPEC §4.13, F-22, D-24).
// A merge is a join: order-independent, idempotent and associative. To stay associative when a
// result is merged again, the result carries three kinds of provenance:
//   hubFields            class-owned values and the time of the hub revision they came from
//   mergeMeta.elements   rank of union elements that did not come from the winning revision
//   mergeMeta.statuses   every ticket status seen, so conflictBadge survives re-merging
import { canonicalJson } from './util.ts';

export type MergeDoc = Record<string, any>;

type Rank = { updatedAt: number; updatedBy: string };

const TICKET_ORDER = ['todo', 'doing', 'review', 'done'];
const HUB_FIELDS = ['schedule', 'passMark', 'switches'];

function rankOf(d: MergeDoc): Rank {
  return {
    updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : 0,
    updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : '',
  };
}

function cmpRank(a: Rank, b: Rank): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? -1 : 1;
  if (a.updatedBy !== b.updatedBy) return a.updatedBy < b.updatedBy ? -1 : 1;
  return 0;
}

function cmpStr(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function cmpId(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a === b ? 0 : a < b ? -1 : 1;
  return cmpStr(String(a), String(b));
}

// Total order on revisions: rank, then content, so equal ranks still pick one winner.
function cmpDoc(a: MergeDoc, b: MergeDoc): number {
  return cmpRank(rankOf(a), rankOf(b)) || cmpStr(canonicalJson(a), canonicalJson(b));
}

function isIdArray(v: unknown): v is MergeDoc[] {
  return Array.isArray(v) && v.every((e) => e !== null && typeof e === 'object' && !Array.isArray(e)
    && (typeof (e as MergeDoc).id === 'string' || typeof (e as MergeDoc).id === 'number'));
}

function clone<T>(v: T): T {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

function unionField(field: string, revs: MergeDoc[], target: Rank): { items: MergeDoc[]; meta: Record<string, Rank> } {
  const best = new Map<string, { el: MergeDoc; rank: Rank }>();
  for (const r of revs) {
    if (!isIdArray(r[field])) continue;
    for (const el of r[field] as MergeDoc[]) {
      const key = String(el.id);
      const rank: Rank = r.mergeMeta?.elements?.[field]?.[key] ?? rankOf(r);
      const cur = best.get(key);
      if (!cur) { best.set(key, { el, rank }); continue; }
      const c = cmpRank(rank, cur.rank) || cmpStr(canonicalJson(el), canonicalJson(cur.el));
      if (c > 0) best.set(key, { el, rank });
    }
  }
  const entries = [...best.values()].sort((a, b) => cmpId(a.el.id, b.el.id));
  const meta: Record<string, Rank> = {};
  for (const e of entries) {
    if (cmpRank(e.rank, target) !== 0) meta[String(e.el.id)] = { updatedAt: e.rank.updatedAt, updatedBy: e.rank.updatedBy };
  }
  return { items: entries.map((e) => clone(e.el)), meta };
}

export function mergeRevisions(docType: string, revisions: readonly MergeDoc[]): { doc: MergeDoc; conflictBadge: boolean } {
  if (revisions.length === 0) throw new Error('mergeRevisions needs at least one revision');
  const revs = [...revisions].sort(cmpDoc);
  const winner = revs[revs.length - 1];
  const target = rankOf(winner);
  const doc: MergeDoc = clone(winner);
  delete doc.hubFields;
  delete doc.mergeMeta;
  const elementsMeta: Record<string, Record<string, Rank>> = {};

  // Arrays of objects with an id: union by id, sorted by id.
  const fields = new Set<string>();
  for (const r of revs) for (const k of Object.keys(r)) fields.add(k);
  for (const f of [...fields].sort()) {
    const present = revs.filter((r) => r[f] !== undefined);
    if (!present.every((r) => isIdArray(r[f]))) continue;
    const { items, meta } = unionField(f, present, target);
    doc[f] = items;
    if (Object.keys(meta).length > 0) elementsMeta[f] = meta;
  }

  let conflictBadge = false;
  const mergeMeta: MergeDoc = {};

  if (docType === 'ticket') {
    const seen = new Set<string>();
    for (const r of revs) {
      const list: unknown[] = Array.isArray(r.mergeMeta?.statuses) ? r.mergeMeta.statuses : (r.status === undefined ? [] : [r.status]);
      for (const s of list) if (typeof s === 'string') seen.add(s);
    }
    if (seen.size > 0) {
      const idx = (s: string) => TICKET_ORDER.indexOf(s);
      const all = [...seen].sort((a, b) => idx(a) - idx(b) || cmpStr(a, b));
      doc.status = all[all.length - 1];
      conflictBadge = seen.size > 1;
      if (conflictBadge) mergeMeta.statuses = all;
    }
  }

  if (docType === 'class') {
    const hubFields: Record<string, { value: unknown; updatedAt: number }> = {};
    for (const f of HUB_FIELDS) {
      let best: { value: unknown; updatedAt: number } | undefined;
      const consider = (value: unknown, updatedAt: number) => {
        if (!best) { best = { value, updatedAt }; return; }
        const c = updatedAt - best.updatedAt || cmpStr(canonicalJson(value), canonicalJson(best.value));
        if (c > 0) best = { value, updatedAt };
      };
      for (const r of revs) {
        const carried = r.hubFields?.[f];
        if (carried && typeof carried === 'object' && 'value' in carried) consider(carried.value, carried.updatedAt);
        else if (typeof r.updatedBy === 'string' && r.updatedBy.startsWith('hub:') && r[f] !== undefined) consider(r[f], rankOf(r).updatedAt);
      }
      if (best) {
        doc[f] = clone(best.value);
        hubFields[f] = { value: clone(best.value), updatedAt: best.updatedAt };
      }
    }
    if (Object.keys(hubFields).length > 0) doc.hubFields = hubFields;
  }

  if (Object.keys(elementsMeta).length > 0) mergeMeta.elements = elementsMeta;
  if (Object.keys(mergeMeta).length > 0) doc.mergeMeta = mergeMeta;
  return { doc, conflictBadge };
}
