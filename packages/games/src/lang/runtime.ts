// Run-time state: counters, limits, output, and the live-cell scan.
import {
  Frame, PyBound, PyClass, PyDeque, PyDict, PyFunc, PyInstance, PyIter, PySet, PyTuple, PyView, SnekFatal,
} from './values.ts';
import type { PyExc } from './values.ts';

export const POS_SHIFT = 1024;
export function mkPos(line: number, col: number): number {
  return line * POS_SHIFT + (col < POS_SHIFT ? col : POS_SHIFT - 1);
}

export const MAX_OUTPUT = 1_000_000;

export class Rt {
  ops = 0;
  maxOps: number;
  maxDepth: number;
  maxCells: number;
  depth = 0;
  pos = 0;
  out: string[] = [];
  outLen = 0;
  input: string[];
  inIdx = 0;
  frames: Frame[] = [];
  module: Frame | null = null;
  temps: any[] = [];
  al = 0;
  nextAt = 64;
  peak = 0;
  lastLive = 0; // live cells at the last scan
  scanAl = 0; // allocation counter at the last scan
  scanOps = 0; // ops at the last scan
  curExc: PyExc | null = null;
  lastValue: any = null;
  busy = false;

  constructor(maxOps: number, maxDepth: number, maxCells: number, input: string[]) {
    this.maxOps = maxOps;
    this.maxDepth = maxDepth;
    this.maxCells = maxCells;
    this.input = input;
  }

  reset(maxOps: number, maxDepth: number, maxCells: number, input: string[]): void {
    this.ops = 0;
    this.maxOps = maxOps;
    this.maxDepth = maxDepth;
    this.maxCells = maxCells;
    this.depth = 0;
    this.pos = 0;
    this.out = [];
    this.outLen = 0;
    this.input = input;
    this.inIdx = 0;
    this.frames = [];
    this.module = null;
    this.temps = [];
    this.al = 0;
    this.nextAt = 64;
    this.peak = 0;
    this.lastLive = 0;
    this.scanAl = 0;
    this.scanOps = 0;
    this.curExc = null;
    this.lastValue = null;
  }

  fatal(kind: string, message: string): never {
    throw new SnekFatal(kind, message, this.pos);
  }

  opsFatal(): never {
    this.fatal('TooManySteps', `Your code ran too long (more than ${this.maxOps} steps): check your loops for one that never ends.`);
  }

  write(s: string): void {
    this.outLen += s.length;
    if (this.outLen > MAX_OUTPUT) {
      this.fatal('TooBig', `Your program printed too much text (more than ${MAX_OUTPUT} characters).`);
    }
    this.out.push(s);
  }

  // Record that k new list/dict/set/str elements are about to exist.
  alloc(k: number): void {
    this.al += k;
    if (this.al >= this.nextAt || k > this.maxCells) this.gc(k);
  }

  gc(k: number): void {
    if (k > this.maxCells) this.bigFatal(k);
    // A scan costs time in proportion to the live data, so a big heap is not rescanned more often than once
    // per live/16 ops, unless the allocation counter says the limit could already be crossed.
    if (this.ops - this.scanOps < this.lastLive >> 4 && this.lastLive + (this.al - this.scanAl) + k <= this.maxCells) {
      this.nextAt = this.al + 64;
      return;
    }
    const live = this.scan();
    this.lastLive = live;
    this.scanAl = this.al;
    this.scanOps = this.ops;
    const total = live + k;
    if (total > this.maxCells) this.bigFatal(total);
    if (total > this.peak) this.peak = total;
    // Rescan after a quarter of the live size more elements (at least 64), but never later than the point
    // where the limit could be crossed, so a program stops as soon as it goes over.
    const room = this.maxCells - total;
    this.nextAt = this.al + Math.max(1, Math.min(room, Math.max(64, live >> 2)));
  }

  bigFatal(n: number): never {
    const shown = Math.min(n, this.maxCells + 1);
    if (shown > this.peak) this.peak = shown;
    this.fatal('TooBig', `Your program used too much memory (more than ${this.maxCells} items at once).`);
  }

  finalScan(): void {
    const live = this.scan();
    if (live > this.peak) this.peak = live;
  }

  // Counts the live list/tuple/dict/set/deque elements and str characters reachable from the variables.
  scan(): number {
    const seen = new Set<any>();
    const stack: any[] = [];
    let count = 0;
    const push = (x: any) => {
      if (typeof x === 'string') { if (x.length > 1) count += x.length; return; }
      if (typeof x === 'object' && x !== null && !seen.has(x)) { seen.add(x); stack.push(x); }
    };
    if (this.module) push(this.module);
    for (let i = 0; i <= this.depth && i < this.frames.length; i++) if (this.frames[i]) push(this.frames[i]);
    for (const t of this.temps) push(t);
    while (stack.length > 0) {
      const x = stack.pop();
      if (Array.isArray(x)) {
        count += x.length;
        for (let i = 0; i < x.length; i++) push(x[i]);
      } else if (x instanceof Frame) {
        const v = x.v;
        for (let i = 0; i < v.length; i++) if (v[i] !== undefined) push(v[i]);
        if (x.p) push(x.p);
      } else if (x instanceof PyTuple) {
        count += x.a.length;
        for (let i = 0; i < x.a.length; i++) push(x.a[i]);
      } else if (x instanceof PyDict) {
        count += x.m.size;
        for (const v of x.m.values()) push(v);
        if (x.o) for (const k of x.o.values()) push(k);
      } else if (x instanceof PySet) {
        count += x.m.size;
        for (const v of x.m.values()) push(v);
      } else if (x instanceof PyDeque) {
        count += x.size();
        for (let i = x.h; i < x.a.length; i++) push(x.a[i]);
      } else if (x instanceof PyInstance) {
        count += x.attrs.size;
        for (const v of x.attrs.values()) push(v);
      } else if (x instanceof PyFunc) {
        if (x.parent) push(x.parent);
        for (const d of x.defaults) push(d);
      } else if (x instanceof PyBound) {
        push(x.self);
        push(x.fn);
      } else if (x instanceof PyClass) {
        for (const v of x.ns.values()) push(v);
      } else if (x instanceof PyIter) {
        count += x.a.length - x.i;
        for (let i = x.i; i < x.a.length; i++) push(x.a[i]);
      } else if (x instanceof PyView) {
        push(x.d);
      }
    }
    return count;
  }
}
