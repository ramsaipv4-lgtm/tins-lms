// Operators on Snek values: arithmetic, bit operations, indexing, slicing, unpacking.
import {
  MAX_INT, PyDeque, PyDict, PyFloat, PyRange, PySet, PyTuple, PyView, PyIter,
  asArray, dictSet, err, isNumber, nk, numVal, repr, tname, dictDel,
} from './values.ts';
import type { Rt } from './runtime.ts';

function art(t: string): string {
  return (/^[aeiouAEIOU]/.test(t) ? 'an ' : 'a ') + t;
}

export function overflow(): never {
  return err('OverflowError', `That number is too big: Snek ints must stay within ±${MAX_INT}.`);
}

function chk(r: number): number {
  if (r > MAX_INT || r < -MAX_INT) overflow();
  return r;
}

export function typeErrBin(op: string, a: any, b: any): never {
  const ta = tname(a);
  const tb = tname(b);
  let hint = '';
  if (op === '+' && ((ta === 'str' && (tb === 'int' || tb === 'float' || tb === 'bool')) || (tb === 'str' && (ta === 'int' || ta === 'float' || ta === 'bool')))) {
    hint = ' Convert the number with str() first.';
  } else if (op === '%' && ta === 'str') {
    hint = ' Snek has no % formatting: use an f-string instead.';
  }
  return err('TypeError', `Cannot use '${op}' between ${art(ta)} and ${art(tb)}.${hint}`);
}

export function floorDiv(a: number, b: number): number {
  const r = a % b;
  let q = (a - r) / b;
  if (r !== 0 && (r < 0) !== (b < 0)) q -= 1;
  return q + 0;
}
export function floorMod(a: number, b: number): number {
  const r = a % b;
  return r !== 0 && (r < 0) !== (b < 0) ? r + b : r + 0;
}

function zeroDiv(): never {
  return err('ZeroDivisionError', 'You cannot divide by zero.');
}

export function intPow(a: number, b: number): number {
  if (b === 0) return 1;
  if (a === 0 || a === 1) return a;
  if (a === -1) return b % 2 === 0 ? 1 : -1;
  if (b > 64) overflow();
  let result = 1;
  let base = a;
  let e = b;
  while (e > 0) {
    if (e & 1) result = chk(result * base);
    e = Math.floor(e / 2);
    if (e > 0) base = chk(base * base);
  }
  return result;
}

function bigOp(op: string, a: number, b: number): number {
  const x = BigInt(a);
  const y = BigInt(b);
  let r: bigint;
  switch (op) {
    case '&': r = x & y; break;
    case '|': r = x | y; break;
    case '^': r = x ^ y; break;
    case '<<':
      if (b < 0) err('ValueError', 'A shift cannot be by a negative number.');
      if (b > 64) overflow();
      r = x << y;
      break;
    default:
      if (b < 0) err('ValueError', 'A shift cannot be by a negative number.');
      r = x >> (b > 64 ? 64n : y);
  }
  if (r > BigInt(MAX_INT) || r < -BigInt(MAX_INT)) overflow();
  return Number(r);
}

export function binop(rt: Rt, op: string, a: any, b: any): any {
  const ta = typeof a;
  const tb = typeof b;
  // numbers
  if ((ta === 'number' || ta === 'boolean' || a instanceof PyFloat) && (tb === 'number' || tb === 'boolean' || b instanceof PyFloat)) {
    const bothInt = ta !== 'object' && tb !== 'object';
    const x = numVal(a);
    const y = numVal(b);
    switch (op) {
      case '+': return bothInt ? chk(x + y) : new PyFloat(x + y);
      case '-': return bothInt ? chk(x - y) : new PyFloat(x - y);
      case '*': return bothInt ? chk(x * y + 0) : new PyFloat(x * y);
      case '/':
        if (y === 0) zeroDiv();
        return new PyFloat(x / y);
      case '//':
        if (y === 0) zeroDiv();
        return bothInt ? floorDiv(x, y) : new PyFloat(Math.floor(x / y));
      case '%':
        if (y === 0) zeroDiv();
        if (bothInt) return floorMod(x, y);
        {
          const r = x % y;
          return new PyFloat(r !== 0 && (r < 0) !== (y < 0) ? r + y : r);
        }
      case '**':
        if (bothInt) {
          if (y >= 0) return intPow(x, y);
          if (x === 0) zeroDiv();
          return new PyFloat(Math.pow(x, y));
        }
        if (x === 0 && y < 0) zeroDiv();
        if (x < 0 && !Number.isInteger(y)) err('ValueError', 'A negative number cannot be raised to a fractional power in Snek.');
        return new PyFloat(Math.pow(x, y));
      case '&': case '|': case '^': case '<<': case '>>':
        if (!bothInt) typeErrBin(op, a, b);
        return bigOp(op, x, y);
      default:
        typeErrBin(op, a, b);
    }
  }
  switch (op) {
    case '+':
      if (ta === 'string' && tb === 'string') {
        const r = a + b;
        if (r.length >= 32) rt.alloc(r.length);
        return r;
      }
      if (Array.isArray(a) && Array.isArray(b)) {
        rt.alloc(a.length + b.length);
        rt.ops += a.length + b.length;
        return a.concat(b);
      }
      if (a instanceof PyTuple && b instanceof PyTuple) {
        rt.alloc(a.a.length + b.a.length);
        rt.ops += a.a.length + b.a.length;
        return new PyTuple(a.a.concat(b.a));
      }
      break;
    case '*': {
      let seq: any = null;
      let n: any = null;
      if (isNumber(b) && typeof b !== 'object') { seq = a; n = b; } else if (isNumber(a) && typeof a !== 'object') { seq = b; n = a; }
      if (seq !== null && (typeof seq === 'string' || Array.isArray(seq) || seq instanceof PyTuple)) {
        const k = Math.max(0, numVal(n));
        if (typeof seq === 'string') {
          const len = seq.length * k;
          if (len >= 32) rt.alloc(len);
          rt.ops += len;
          return seq.repeat(k);
        }
        const arr: any[] = Array.isArray(seq) ? seq : seq.a;
        const len = arr.length * k;
        rt.alloc(len);
        rt.ops += len;
        const out: any[] = new Array(len);
        for (let r = 0, j = 0; r < k; r++) for (let i = 0; i < arr.length; i++) out[j++] = arr[i];
        return Array.isArray(seq) ? out : new PyTuple(out);
      }
      break;
    }
    case '|': case '&': case '-': case '^':
      if (a instanceof PySet && b instanceof PySet) {
        const out = new PySet();
        rt.ops += a.m.size + b.m.size;
        if (op === '|') {
          for (const [k, v] of a.m) out.m.set(k, v);
          for (const [k, v] of b.m) if (!out.m.has(k)) out.m.set(k, v);
        } else if (op === '&') {
          for (const [k, v] of a.m) if (b.m.has(k)) out.m.set(k, v);
        } else if (op === '-') {
          for (const [k, v] of a.m) if (!b.m.has(k)) out.m.set(k, v);
        } else {
          for (const [k, v] of a.m) if (!b.m.has(k)) out.m.set(k, v);
          for (const [k, v] of b.m) if (!a.m.has(k)) out.m.set(k, v);
        }
        rt.alloc(out.m.size);
        return out;
      }
      break;
    default:
  }
  return typeErrBin(op, a, b);
}

export function negate(v: any): any {
  if (typeof v === 'number') return v === 0 ? 0 : -v;
  if (typeof v === 'boolean') return v ? -1 : 0;
  if (v instanceof PyFloat) return new PyFloat(-v.v);
  return err('TypeError', `Cannot use unary '-' on ${art(tname(v))}.`);
}
export function unaryPlus(v: any): any {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof PyFloat) return v;
  return err('TypeError', `Cannot use unary '+' on ${art(tname(v))}.`);
}
export function invert(v: any): any {
  if (typeof v === 'number') return -v - 1;
  if (typeof v === 'boolean') return v ? -2 : -1;
  return err('TypeError', `Cannot use '~' on ${art(tname(v))}.`);
}

// ---- indexing ----
function indexOf(i: any, what: string): number {
  if (typeof i === 'number') return i;
  if (typeof i === 'boolean') return i ? 1 : 0;
  return err('TypeError', `A ${what} index must be an int, not ${art(tname(i))}.`);
}

export function getItem(rt: Rt, o: any, i: any): any {
  if (Array.isArray(o)) {
    const n = indexOf(i, 'list');
    const len = o.length;
    if (n >= 0 && n < len) return o[n];
    if (n < 0 && n >= -len) return o[len + n];
    return err('IndexError', `The list index ${n} is out of range: the list has ${len} items.`);
  }
  if (typeof o === 'string') {
    const n = indexOf(i, 'str');
    const len = o.length;
    if (n >= 0 && n < len) return o[n];
    if (n < 0 && n >= -len) return o[len + n];
    return err('IndexError', `The string index ${n} is out of range: the string has ${len} characters.`);
  }
  if (o instanceof PyDict) {
    const v = o.m.get(nk(i));
    if (v === undefined) return keyError(i);
    return v;
  }
  if (o instanceof PyTuple) {
    const n = indexOf(i, 'tuple');
    const len = o.a.length;
    if (n >= 0 && n < len) return o.a[n];
    if (n < 0 && n >= -len) return o.a[len + n];
    return err('IndexError', `The tuple index ${n} is out of range: the tuple has ${len} items.`);
  }
  if (o instanceof PyRange) {
    const n = indexOf(i, 'range');
    if (n >= 0 && n < o.len) return o.start + n * o.step;
    if (n < 0 && n >= -o.len) return o.start + (o.len + n) * o.step;
    return err('IndexError', `The range index ${n} is out of range.`);
  }
  if (o instanceof PyDeque) {
    const n = indexOf(i, 'deque');
    const len = o.size();
    if (n >= 0 && n < len) return o.a[o.h + n];
    if (n < 0 && n >= -len) return o.a[o.h + len + n];
    return err('IndexError', `The deque index ${n} is out of range: the deque has ${len} items.`);
  }
  if (o instanceof PyView) return getItem(rt, asArray(o), i);
  return err('TypeError', `You cannot use [ ] to index ${art(tname(o))}.`);
}

export function keyError(k: any): never {
  return err('KeyError', `The key ${repr(k)} is not in the dict.`);
}

export function setItem(rt: Rt, o: any, i: any, v: any): void {
  if (Array.isArray(o)) {
    const n = indexOf(i, 'list');
    const len = o.length;
    if (n >= 0 && n < len) { o[n] = v; return; }
    if (n < 0 && n >= -len) { o[len + n] = v; return; }
    err('IndexError', `The list assignment index ${n} is out of range: the list has ${len} items.`);
  }
  if (o instanceof PyDict) {
    if (dictSet(o, i, v)) rt.alloc(1);
    return;
  }
  if (o instanceof PyDeque) {
    const n = indexOf(i, 'deque');
    const len = o.size();
    if (n >= 0 && n < len) { o.a[o.h + n] = v; return; }
    if (n < 0 && n >= -len) { o.a[o.h + len + n] = v; return; }
    err('IndexError', `The deque assignment index ${n} is out of range.`);
  }
  if (typeof o === 'string' || o instanceof PyTuple) {
    err('TypeError', `A ${tname(o)} cannot be changed after it is made: build a new one instead.`);
  }
  err('TypeError', `You cannot assign with [ ] into ${art(tname(o))}.`);
}

export function delItem(o: any, i: any): void {
  if (i instanceof Slice && Array.isArray(o)) {
    const idx = sliceIndices(o.length, i).sort((a, b) => b - a);
    for (const k of idx) o.splice(k, 1);
    return;
  }
  if (Array.isArray(o)) {
    const n = indexOf(i, 'list');
    const len = o.length;
    if (n >= 0 && n < len) { o.splice(n, 1); return; }
    if (n < 0 && n >= -len) { o.splice(len + n, 1); return; }
    err('IndexError', `The list index ${n} is out of range: the list has ${len} items.`);
  }
  if (o instanceof PyDict) {
    if (!dictDel(o, i)) keyError(i);
    return;
  }
  err('TypeError', `You cannot delete with [ ] from ${art(tname(o))}.`);
}

export class Slice {
  lo: any;
  hi: any;
  step: any;
  constructor(lo: any, hi: any, step: any) { this.lo = lo; this.hi = hi; this.step = step; }
}

function sliceBound(v: any, what: string): number | null {
  if (v === null) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return err('TypeError', `Slice positions must be ints or None, not ${art(tname(v))}.`);
}

// Returns the indices selected by a slice over a sequence of length len.
export function sliceIndices(len: number, s: Slice): number[] {
  const stepV = sliceBound(s.step, 'step');
  const step = stepV === null ? 1 : stepV;
  if (step === 0) err('ValueError', 'A slice step cannot be zero.');
  let lo = sliceBound(s.lo, 'start');
  let hi = sliceBound(s.hi, 'stop');
  let start: number;
  let stop: number;
  if (step > 0) {
    start = lo === null ? 0 : lo < 0 ? Math.max(0, lo + len) : Math.min(lo, len);
    stop = hi === null ? len : hi < 0 ? Math.max(0, hi + len) : Math.min(hi, len);
  } else {
    start = lo === null ? len - 1 : lo < 0 ? Math.max(-1, lo + len) : Math.min(lo, len - 1);
    stop = hi === null ? -1 : hi < 0 ? Math.max(-1, hi + len) : Math.min(hi, len - 1);
  }
  const out: number[] = [];
  if (step > 0) for (let i = start; i < stop; i += step) out.push(i);
  else for (let i = start; i > stop; i += step) out.push(i);
  return out;
}

export function getSlice(rt: Rt, o: any, s: Slice): any {
  if (Array.isArray(o) || typeof o === 'string' || o instanceof PyTuple || o instanceof PyRange) {
    const arr: any = Array.isArray(o) || typeof o === 'string' ? o : o instanceof PyTuple ? o.a : asArray(o);
    const len = arr.length;
    // fast path: step 1
    const plain = (s.step === null || s.step === 1) && (s.lo === null || typeof s.lo === 'number') && (s.hi === null || typeof s.hi === 'number');
    let out: any;
    if (plain) {
      let lo = s.lo === null ? 0 : s.lo < 0 ? Math.max(0, s.lo + len) : Math.min(s.lo, len);
      let hi = s.hi === null ? len : s.hi < 0 ? Math.max(0, s.hi + len) : Math.min(s.hi, len);
      if (hi < lo) hi = lo;
      rt.ops += hi - lo;
      if (typeof o === 'string') {
        if (hi - lo >= 32) rt.alloc(hi - lo);
        return o.slice(lo, hi);
      }
      rt.alloc(hi - lo);
      out = arr.slice(lo, hi);
    } else {
      const idx = sliceIndices(len, s);
      rt.ops += idx.length;
      if (typeof o === 'string') {
        let r = '';
        for (const i of idx) r += arr[i];
        if (r.length >= 32) rt.alloc(r.length);
        return r;
      }
      rt.alloc(idx.length);
      out = idx.map((i) => arr[i]);
    }
    return o instanceof PyTuple ? new PyTuple(out) : out;
  }
  return err('TypeError', `You cannot slice ${art(tname(o))}.`);
}

export function setSlice(rt: Rt, o: any, s: Slice, v: any): void {
  if (!Array.isArray(o)) err('TypeError', `You cannot assign to a slice of ${art(tname(o))}.`);
  const items = asArray(v).slice();
  const idx = sliceIndices(o.length, s);
  if (s.step === null || s.step === 1) {
    const lo = idx.length ? idx[0] : (s.lo === null ? 0 : Math.min(Math.max(s.lo < 0 ? s.lo + o.length : s.lo, 0), o.length));
    rt.alloc(items.length);
    o.splice(lo, idx.length, ...items);
    return;
  }
  if (idx.length !== items.length) err('ValueError', `A slice with a step needs exactly ${idx.length} values, not ${items.length}.`);
  idx.forEach((i, j) => { o[i] = items[j]; });
}

// ---- unpacking ----
export function unpackArray(v: any, n: number): any[] {
  let arr: any[];
  if (Array.isArray(v)) arr = v;
  else if (v instanceof PyTuple) arr = v.a;
  else if (typeof v === 'string' || v instanceof PyDict || v instanceof PySet || v instanceof PyRange || v instanceof PyDeque || v instanceof PyIter || v instanceof PyView) arr = asArray(v);
  else return err('TypeError', `Cannot unpack ${art(tname(v))} into ${n} names: it is not a sequence.`);
  if (arr.length !== n) {
    if (arr.length < n) err('ValueError', `Not enough values to unpack: expected ${n} but got ${arr.length}.`);
    err('ValueError', `Too many values to unpack: expected ${n} but got ${arr.length}.`);
  }
  return arr;
}

