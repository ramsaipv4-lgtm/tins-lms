// Mapping extracted fields to tracker entries (P-16: a person confirms every value before anything is saved).
import { applyParseRules, type ParseRules } from '../../../../core/src/screenshot.ts';
import type { EntryKind } from './lib.ts';

export const KIND_OF_FIELD: Record<string, EntryKind> = { calories: 'food', protein: 'food', carbs: 'food', fat: 'food', amount: 'money', steps: 'steps', sleep: 'sleep', hours: 'sleep' };

export function kindOfFields(names: readonly string[]): EntryKind {
  for (const n of names) if (KIND_OF_FIELD[n.toLowerCase()]) return KIND_OF_FIELD[n.toLowerCase()];
  return 'note';
}

// Runs every approved rule set; the one that finds the most values leads (the person can switch app by hand).
export function bestRules(lines: readonly string[], all: readonly ParseRules[]): { rules: ParseRules; found: number } | null {
  let best: { rules: ParseRules; found: number } | null = null;
  for (const rules of all) {
    let found = 0;
    try { found = Object.values(applyParseRules(lines, rules)).filter((v) => v.value !== null).length; } catch { found = 0; }
    if (!best || found > best.found) best = { rules, found };
  }
  return best;
}

export function parseNumber(text: string): number | null {
  const s = text.trim().replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}
