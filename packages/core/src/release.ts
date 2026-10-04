// Content release in step with the teleprompter (SPEC 4.7, D-38)
import { hkdfSha256, aesGcmSeal, aesGcmOpen, utf8Encode } from './util.ts';

export async function sectionKey(dayKey: Uint8Array, sectionIndex: number): Promise<Uint8Array> {
  return hkdfSha256(dayKey, new Uint8Array(0), utf8Encode(`section:${sectionIndex}`), 32);
}

export async function sealSection(key: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
  return aesGcmSeal(key, plaintext);
}

export async function openSection(key: Uint8Array, sealed: Uint8Array): Promise<Uint8Array> {
  return aesGcmOpen(key, sealed);
}

export function releasePlan(
  classStart: number,
  sections: readonly { id: string; plannedSec: number; graded: boolean }[],
): { id: string; at: number | null }[] {
  let elapsedMs = 0;
  return sections.map((s) => {
    const at = s.graded ? null : classStart + elapsedMs;
    elapsedMs += s.plannedSec * 1000;
    return { id: s.id, at };
  });
}

export function isReleased(
  section: { id: string; graded: boolean },
  plan: { id: string; at: number | null }[],
  ctx: { now: number; reachedIds: readonly string[]; releaseAll: boolean },
): boolean {
  if (ctx.releaseAll || ctx.reachedIds.includes(section.id)) return true;
  if (section.graded) return false;
  const entry = plan.find((p) => p.id === section.id);
  return entry !== undefined && entry.at !== null && ctx.now >= entry.at;
}
