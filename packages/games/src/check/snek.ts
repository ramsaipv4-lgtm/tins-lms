// The slice of Snek (SPEC §13.4) the pack check uses, and helpers around it. The real module is
// packages/games/src/lang/index.ts (task g-1); tests pass a stub with the same shape.
export interface SnekError { kind: string; line: number; col: number; message: string }
export type SnekCompiled = { ok: true; program: unknown } | { ok: false; error: SnekError };
export type SnekRun =
  | { ok: true; value: unknown; stdout: string; ops: number; peakCells: number }
  | { ok: false; error: SnekError; stdout: string; ops: number; peakCells: number };
export interface SnekApi {
  compile(source: string): SnekCompiled;
  run(program: any, opts?: { input?: string[]; globals?: Record<string, unknown>; maxOps?: number; maxDepth?: number; maxCells?: number }): SnekRun;
  callFunction(program: any, name: string, args: unknown[], opts?: { input?: string[]; maxOps?: number; maxDepth?: number; maxCells?: number }): SnekRun;
}

/** Load the real interpreter (the one loader of the engine; null while packages/games/src/lang does not exist). */
export { loadSnek } from '../engine/snek.ts';

export const trimOut = (s: string): string => String(s ?? '').replace(/\s+$/, '');

export type Outcome = { ok: true; stdout: string; value: unknown } | { ok: false; phase: 'compile' | 'run'; stdout: string; kind: string; line: number; message: string };

/** Compile and run a whole program. */
export function runSource(snek: SnekApi, source: string, input?: string[]): Outcome {
  const c = snek.compile(source);
  if (!c.ok) return { ok: false, phase: 'compile', stdout: '', kind: c.error.kind, line: c.error.line, message: c.error.message };
  const r = snek.run(c.program, input ? { input } : undefined);
  return r.ok ? { ok: true, stdout: r.stdout, value: r.value } : { ok: false, phase: 'run', stdout: r.stdout, kind: r.error.kind, line: r.error.line, message: r.error.message };
}

/** Values are equal after conversion; floats within 1e-9 (SPEC §13.5 "Tests in packs"). */
export function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a === b || Math.abs(a - b) <= 1e-9;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a as object).sort(), kb = Object.keys(b as object).sort();
    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && sameValue((a as any)[k], (b as any)[k]));
  }
  return a === b;
}

export interface PackTest { args?: unknown[]; expect?: unknown; input?: string[]; stdout?: string }

/** Run a program against pack tests; returns the first failure as a sentence, or null when all pass. */
export function failingTest(snek: SnekApi, source: string, entry: string | null, tests: readonly PackTest[]): string | null {
  const c = snek.compile(source);
  if (!c.ok) return `the program does not compile (${c.error.kind} on line ${c.error.line}: ${c.error.message})`;
  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    const label = `test ${i + 1}`;
    if (typeof t.stdout === 'string') {
      const r = snek.run(c.program, t.input ? { input: t.input } : undefined);
      if (!r.ok) return `${label} failed: the program raised ${r.error.kind}: ${r.error.message}`;
      if (trimOut(r.stdout) !== trimOut(t.stdout)) return `${label} failed: printed ${JSON.stringify(trimOut(r.stdout))}, expected ${JSON.stringify(trimOut(t.stdout))}`;
    } else {
      if (!entry) return `${label} calls a function but the level has no "entry" (or "signature") naming it`;
      const r = snek.callFunction(c.program, entry, t.args ?? []);
      const call = `${entry}(${(t.args ?? []).map((a) => JSON.stringify(a)).join(', ')})`;
      if (!r.ok) return `${label} failed: ${call} raised ${r.error.kind}: ${r.error.message}`;
      if (!sameValue(r.value, t.expect)) return `${label} failed: ${call} gave ${JSON.stringify(r.value)}, expected ${JSON.stringify(t.expect)}`;
    }
  }
  return null;
}
