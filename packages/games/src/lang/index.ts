// Snek, the Python-subset interpreter (SPEC §13.4): compile, run, step, callFunction.
// Pure TypeScript: no imports outside this folder, no DOM or Node APIs.
import { CompileError } from './types.ts';
import type { Compiled, Node, Program, RunOpts, RunResult, SnekError, SnekErrorKind, StepEvent } from './types.ts';
import { parseProgram } from './parser.ts';
import { resolveModule } from './resolve.ts';
import type { Scope } from './resolve.ts';
import { Frame, PyExc, SnekFatal, SnekThrow, err, hooks } from './values.ts';
import { POS_SHIFT, Rt } from './runtime.ts';
import { Interp } from './fast.ts';
import type { Ex } from './fast.ts';
import { Stepper } from './gen.ts';
import { fromJS, makeHost, toJS } from './convert.ts';

export type { Compiled, Program, RunOpts, RunResult, SnekError, SnekErrorKind, StepEvent };

const DEFAULT_OPS = 1_000_000;
const DEFAULT_DEPTH = 200;
const DEFAULT_CELLS = 100_000;

class ProgramImpl {
  readonly snek = 'program' as const;
  body: Node[];
  scope: Scope;
  interps: Map<string, Interp> = new Map();
  mains: Map<Interp, Ex> = new Map();
  constructor(body: Node[], scope: Scope) {
    this.body = body;
    this.scope = scope;
  }
}

export function sentence(s: string): string {
  let t = String(s).replace(/\s+/g, ' ').trim();
  t = t.replace(/\bundefined\b|\bnull\b|\bNaN\b|\[object/g, '?');
  if (t.length > 150) t = t.slice(0, 147).trimEnd() + '...';
  if (t === '') t = 'Something went wrong.';
  if (!/[.!?]$/.test(t)) t += '.';
  return t;
}

export function compile(source: string): Compiled {
  try {
    const body = parseProgram(String(source));
    const scope = resolveModule(body);
    return { ok: true, program: new ProgramImpl(body, scope) as unknown as Program };
  } catch (e: any) {
    if (e instanceof CompileError) {
      return { ok: false, error: { kind: e.kind, line: e.line, col: e.col, message: sentence(e.message) } };
    }
    if (e instanceof RangeError) {
      return { ok: false, error: { kind: 'SyntaxError', line: 1, col: 1, message: 'This program is nested too deeply for Snek to read.' } };
    }
    return { ok: false, error: { kind: 'SyntaxError', line: 1, col: 1, message: 'Snek could not read this program.' } };
  }
}

function limit(v: unknown, dflt: number): number {
  return typeof v === 'number' && v > 0 && isFinite(v) ? Math.floor(v) : dflt;
}

interface Setup {
  prog: ProgramImpl;
  interp: Interp;
  rt: Rt;
  frame: Frame;
  release: () => void;
}

function setup(p: Program, opts: RunOpts | undefined): Setup {
  const prog = p as unknown as ProgramImpl;
  const o = opts ?? {};
  const globals = o.globals ?? {};
  const names = Object.keys(globals).sort();
  const key = names.join('\u0000');
  const maxOps = limit(o.maxOps, DEFAULT_OPS);
  const maxDepth = limit(o.maxDepth, DEFAULT_DEPTH);
  const maxCells = limit(o.maxCells, DEFAULT_CELLS);
  const input = Array.isArray(o.input) ? o.input.map((x) => String(x)) : [];
  let interp = prog.interps.get(key);
  if (!interp || interp.rt.busy) {
    const fresh = new Interp(new Rt(maxOps, maxDepth, maxCells, input), names);
    fresh.key = key;
    if (!interp) prog.interps.set(key, fresh);
    interp = fresh;
  }
  const rt = interp.rt;
  rt.reset(maxOps, maxDepth, maxCells, input);
  rt.busy = true;
  interp.mods.clear();
  const frame = new Frame(prog.scope.nslots, null, prog.scope);
  rt.module = frame;
  const interpRef = interp;
  const release = () => { rt.busy = false; interpRef.mods.clear(); };
  try {
    names.forEach((name, i) => {
      const val = (globals as Record<string, unknown>)[name];
      const v = typeof val === 'function' ? makeHost(rt, name, val as (...a: unknown[]) => unknown) : fromJS(val);
      interp!.hostVals[i] = v;
      const slot = prog.scope.names.get(name);
      if (slot !== undefined) frame.v[slot] = v;
    });
  } catch (e) {
    release();
    throw e;
  }
  return { prog, interp, rt, frame, release };
}

function fail(rt: Rt, e: any): RunResult {
  let kind: SnekErrorKind;
  let message: string;
  let pos = rt.pos;
  if (e instanceof SnekFatal) {
    kind = e.kind as SnekErrorKind;
    message = e.message;
    pos = e.pos;
  } else if (e instanceof SnekThrow) {
    const x: PyExc = e.exc;
    kind = x.kind as SnekErrorKind;
    pos = x.pos || rt.pos;
    if (x.user) {
      if (x.kind === 'AssertionError') message = x.msg === '' ? 'The assertion failed.' : `Assertion failed: ${x.msg}`;
      else message = x.msg === '' ? `A ${x.kind} was raised.` : x.msg;
    } else message = x.msg;
  } else if (e instanceof RangeError) {
    kind = 'TooDeep';
    message = `Your function called itself too many times (more than ${Math.max(rt.depth, 1)} levels deep): check that it has a case that stops.`;
  } else {
    if (hooks.internal) hooks.internal(e);
    kind = 'RuntimeError';
    message = 'Snek hit an unexpected problem while running this program.';
  }
  rt.depth = 0;
  try { rt.finalScan(); } catch { /* ignore */ }
  return {
    ok: false,
    error: { kind, line: Math.floor(pos / POS_SHIFT) || 1, col: pos % POS_SHIFT || 1, message: sentence(message) },
    stdout: rt.out.join(''),
    ops: rt.ops,
    peakCells: rt.peak,
  };
}

function success(rt: Rt, value: unknown): RunResult {
  rt.depth = 0;
  rt.finalScan();
  return { ok: true, value, stdout: rt.out.join(''), ops: rt.ops, peakCells: rt.peak };
}

function mainOf(prog: ProgramImpl, interp: Interp): Ex {
  let m = prog.mains.get(interp);
  if (!m) {
    m = interp.module(prog.body);
    prog.mains.set(interp, m);
  }
  return m;
}

function withHook<T>(interp: Interp, fn: () => T): T {
  const prev = hooks.callUser;
  const prevAlloc = hooks.alloc;
  hooks.callUser = (f, args) => interp.callUser(f, args, null);
  hooks.alloc = (k) => interp.rt.alloc(k);
  try {
    return fn();
  } finally {
    hooks.callUser = prev;
    hooks.alloc = prevAlloc;
  }
}

export function run(p: Program, opts?: RunOpts): RunResult {
  let s: Setup;
  try {
    s = setup(p, opts);
  } catch (e: any) {
    const rt = new Rt(1, 1, 1, []);
    return fail(rt, e);
  }
  const { prog, interp, rt, frame, release } = s;
  try {
    return withHook(interp, () => {
      mainOf(prog, interp)(frame);
      return success(rt, toJS(rt.lastValue));
    });
  } catch (e) {
    return fail(rt, e);
  } finally {
    release();
  }
}

export function callFunction(p: Program, name: string, args: unknown[], opts?: RunOpts): RunResult {
  let s: Setup;
  try {
    s = setup(p, opts);
  } catch (e: any) {
    const rt = new Rt(1, 1, 1, []);
    return fail(rt, e);
  }
  const { prog, interp, rt, frame, release } = s;
  try {
    return withHook(interp, () => {
      mainOf(prog, interp)(frame);
      const slot = prog.scope.names.get(name);
      const fn = slot === undefined ? undefined : frame.v[slot];
      if (fn === undefined) err('NameError', `There is no function named '${name}' in this program.`);
      rt.pos = 0;
      const jsArgs = (Array.isArray(args) ? args : []).map((a) => fromJS(a));
      const r = interp.callValue(fn, jsArgs, null);
      return success(rt, toJS(r));
    });
  } catch (e) {
    return fail(rt, e);
  } finally {
    release();
  }
}

export function* step(p: Program, opts?: RunOpts): Generator<StepEvent, RunResult> {
  let s: Setup;
  try {
    s = setup(p, opts);
  } catch (e: any) {
    const rt = new Rt(1, 1, 1, []);
    return fail(rt, e);
  }
  const { prog, interp, rt, frame, release } = s;
  try {
    const stepper = new Stepper(interp);
    const gen = stepper.runModule(prog.body, frame);
    for (;;) {
      const r = withHook(interp, () => gen.next());
      if (r.done) break;
      yield r.value;
    }
    return withHook(interp, () => success(rt, toJS(rt.lastValue)));
  } catch (e) {
    return fail(rt, e);
  } finally {
    release();
  }
}
