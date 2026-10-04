// Append-only hash-chained ledger (SPEC §4.9, P-10)
import { sha256, canonicalJson, utf8Encode } from './util.ts';

export type Entry = {
  seq: number;
  subject: string;
  value: unknown;
  by: string;
  at: number;
  reason?: string;
  corrects?: number;
  prevHash: string;
  hash: string;
};

const GENESIS = '0'.repeat(64);

type EntryBody = Omit<Entry, 'hash'>;

async function hashBody(body: EntryBody): Promise<string> {
  return sha256(utf8Encode(canonicalJson(body)));
}

export async function appendEntry(
  ledger: readonly Entry[],
  entry: { subject: string; value: unknown; by: string; at: number; reason?: string; corrects?: number },
): Promise<Entry[]> {
  const last = ledger.length > 0 ? ledger[ledger.length - 1] : undefined;
  const body: EntryBody = {
    seq: last ? last.seq + 1 : 0,
    subject: entry.subject,
    value: entry.value,
    by: entry.by,
    at: entry.at,
    prevHash: last ? last.hash : GENESIS,
  };
  if (entry.reason !== undefined) body.reason = entry.reason;
  if (entry.corrects !== undefined) body.corrects = entry.corrects;
  const hash = await hashBody(body);
  return [...ledger, { ...body, hash }];
}

export async function verifyLedger(ledger: readonly Entry[]): Promise<{ ok: boolean; brokenAt: number | null }> {
  let prev = GENESIS;
  for (let i = 0; i < ledger.length; i++) {
    const e = ledger[i];
    const { hash, ...body } = e;
    if (e.seq !== i || e.prevHash !== prev || (await hashBody(body as EntryBody)) !== hash) {
      return { ok: false, brokenAt: i };
    }
    prev = hash;
  }
  return { ok: true, brokenAt: null };
}

export function currentValue(ledger: readonly Entry[], subject: string): unknown {
  for (let i = ledger.length - 1; i >= 0; i--) {
    if (ledger[i].subject === subject) return ledger[i].value;
  }
  return undefined;
}
