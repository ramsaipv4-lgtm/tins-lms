// Runtime value classes and the core helpers every part of the interpreter shares.
// Representation: int = JS number (integral), bool = JS boolean, None = null, str = JS string,
// list = JS Array, float = PyFloat, tuple = PyTuple, dict = PyDict, set = PySet.
import type { Node } from './types.ts';
import { floatRepr } from './format.ts';

export class PyFloat {
  v: number;
  constructor(v: number) { this.v = v; }
}
export class PyTuple {
  a: any[];
  constructor(a: any[]) { this.a = a; }
}
export class PyDict {
  m: Map<any, any> = new Map();
  o: Map<any, any> | null = null; // original keys whose normalised key differs
}
export class PySet {
  m: Map<any, any> = new Map(); // normalised key -> original key
}
export class PyRange {
  start: number;
  stop: number;
  step: number;
  len: number;
  constructor(start: number, stop: number, step: number) {
    this.start = start;
    this.stop = stop;
    this.step = step;
    this.len = step > 0 ? Math.max(0, Math.ceil((stop - start) / step)) : Math.max(0, Math.ceil((start - stop) / -step));
  }
}
export class PyDeque {
  a: any[];
  h = 0;
  constructor(a: any[]) { this.a = a; }
  size(): number { return this.a.length - this.h; }
  items(): any[] { return this.h === 0 ? this.a : this.a.slice(this.h); }
}
export class PyIter {
  a: any[];
  i = 0;
  name: string;
  constructor(a: any[], name: string) { this.a = a; this.name = name; }
}
export class PyView {
  kind: string; // keys | values | items
  d: PyDict;
  constructor(kind: string, d: PyDict) { this.kind = kind; this.d = d; }
}
export class Frame {
  v: any[];
  p: Frame | null;
  ret: any = null;
  ll = 0; // line of the last step event in this frame
  s: any; // Scope
  constructor(n: number, p: Frame | null, s: any) {
    this.v = new Array(n);
    this.p = p;
    this.s = s;
  }
}
export class PyFunc {
  name: string;
  node: Node;
  parent: Frame | null;
  defaults: any[];
  body: ((f: Frame) => number) | null = null;
  gbody: any = null;
  constructor(name: string, node: Node, parent: Frame | null, defaults: any[]) {
    this.name = name;
    this.node = node;
    this.parent = parent;
    this.defaults = defaults;
  }
}
export class PyBound {
  self: any;
  fn: PyFunc;
  constructor(self: any, fn: PyFunc) { this.self = self; this.fn = fn; }
}
export class PyBuiltin {
  name: string;
  fn: (args: any[], kw: Map<string, any> | null) => any;
  ty: string | null;
  host: boolean;
  constructor(name: string, fn: (args: any[], kw: Map<string, any> | null) => any, ty: string | null = null, host = false) {
    this.name = name;
    this.fn = fn;
    this.ty = ty;
    this.host = host;
  }
}
export class PyClass {
  name: string;
  ns: Map<string, any>;
  constructor(name: string, ns: Map<string, any>) { this.name = name; this.ns = ns; }
}
export class PyInstance {
  cls: PyClass;
  attrs: Map<string, any> = new Map();
  constructor(cls: PyClass) { this.cls = cls; }
}
export class PyModule {
  name: string;
  attrs: Map<string, any>;
  constructor(name: string, attrs: Map<string, any>) { this.name = name; this.attrs = attrs; }
}
export class PyExc {
  kind: string;
  msg: string;
  args: any[];
  pos = 0;
  user = false;
  constructor(kind: string, msg: string, args?: any[]) {
    this.kind = kind;
    this.msg = msg;
    this.args = args ?? [msg];
  }
}
export class PyExcClass {
  kind: string;
  constructor(kind: string) { this.kind = kind; }
}

// A Python-level exception travelling through JS (catchable by try/except).
export class SnekThrow {
  exc: PyExc;
  constructor(exc: PyExc) { this.exc = exc; }
}
// A limit or sandbox stop: never catchable by the learner's code.
export class SnekFatal {
  kind: string;
  message: string;
  pos: number;
  constructor(kind: string, message: string, pos: number) {
    this.kind = kind;
    this.message = message;
    this.pos = pos;
  }
}

export const MAX_INT = 9007199254740991;

export function err(kind: string, msg: string): never {
  throw new SnekThrow(new PyExc(kind, msg));
}

// Late-bound hooks set by the evaluator (they need the running interpreter).
export const hooks: {
  callUser: (fn: any, args: any[]) => any;
  alloc: (k: number) => void;
  internal: ((e: unknown) => void) | null;
} = { callUser: () => null, alloc: () => {}, internal: null };

const idMap = new WeakMap<object, number>();
let idNext = 1;
export function objId(o: object): number {
  let i = idMap.get(o);
  if (i === undefined) { i = idNext++; idMap.set(o, i); }
  return i;
}

export function aType(v: any): string {
  const t = tname(v);
  return (/^[aeiouAEIOU]/.test(t) ? 'an ' : 'a ') + t;
}

export function tname(v: any): string {
  switch (typeof v) {
    case 'number': return 'int';
    case 'boolean': return 'bool';
    case 'string': return 'str';
    case 'object':
      if (v === null) return 'NoneType';
      if (Array.isArray(v)) return 'list';
      if (v instanceof PyFloat) return 'float';
      if (v instanceof PyTuple) return 'tuple';
      if (v instanceof PyDict) return 'dict';
      if (v instanceof PySet) return 'set';
      if (v instanceof PyInstance) return v.cls.name;
      if (v instanceof PyRange) return 'range';
      if (v instanceof PyDeque) return 'deque';
      if (v instanceof PyFunc || v instanceof PyBound) return 'function';
      if (v instanceof PyBuiltin) return v.ty ? 'type' : 'builtin_function';
      if (v instanceof PyClass) return 'type';
      if (v instanceof PyModule) return 'module';
      if (v instanceof PyExc) return v.kind;
      if (v instanceof PyIter) return v.name;
      if (v instanceof PyView) return 'dict_' + v.kind;
      return 'object';
    default: return 'object';
  }
}

export function truthy(v: any): boolean {
  switch (typeof v) {
    case 'boolean': return v;
    case 'number': return v !== 0;
    case 'string': return v.length > 0;
    case 'object':
      if (v === null) return false;
      if (Array.isArray(v)) return v.length > 0;
      if (v instanceof PyFloat) return v.v !== 0;
      if (v instanceof PyTuple) return v.a.length > 0;
      if (v instanceof PyDict) return v.m.size > 0;
      if (v instanceof PySet) return v.m.size > 0;
      if (v instanceof PyRange) return v.len > 0;
      if (v instanceof PyDeque) return v.size() > 0;
      if (v instanceof PyView) return v.d.m.size > 0;
      return true;
    case 'undefined': return false;
    default: return true;
  }
}

export function isNumber(v: any): boolean {
  return typeof v === 'number' || typeof v === 'boolean' || v instanceof PyFloat;
}
export function numVal(v: any): number {
  return typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : v.v;
}

// ---- dict / set keys ----
function tupleKey(v: any): string {
  switch (typeof v) {
    case 'number': return 'n' + v;
    case 'boolean': return 'n' + (v ? 1 : 0);
    case 'string': return 's' + v.length + ':' + v;
    default:
      if (v === null) return 'N';
      if (v instanceof PyFloat) return Number.isInteger(v.v) ? 'n' + v.v : 'f' + v.v;
      if (v instanceof PyTuple) return 't(' + v.a.map(tupleKey).join(',') + ')';
      if (Array.isArray(v) || v instanceof PyDict || v instanceof PySet || v instanceof PyDeque) {
        err('TypeError', `Cannot use a ${tname(v)} inside a tuple that is used as a dict key or set item, because a ${tname(v)} can change.`);
      }
      return 'o' + objId(v);
  }
}

export function nk(k: any): any {
  switch (typeof k) {
    case 'number': case 'string': return k;
    case 'boolean': return k ? 1 : 0;
    default:
      if (k === null) return null;
      if (k instanceof PyFloat) return Number.isInteger(k.v) ? k.v : '\0f' + k.v;
      if (k instanceof PyTuple) return '\0t(' + k.a.map(tupleKey).join(',') + ')';
      if (Array.isArray(k) || k instanceof PyDict || k instanceof PySet || k instanceof PyDeque) {
        err('TypeError', `Cannot use a ${tname(k)} as a dict key or set item, because a ${tname(k)} can change.`);
      }
      return k;
  }
}

export function dictGet(d: PyDict, k: any): any {
  return d.m.get(nk(k));
}
export function dictHas(d: PyDict, k: any): boolean {
  return d.m.has(nk(k));
}
export function dictSet(d: PyDict, k: any, v: any): boolean {
  const n = nk(k);
  const isNew = !d.m.has(n);
  d.m.set(n, v);
  if (isNew && n !== k) {
    if (!d.o) d.o = new Map();
    d.o.set(n, k);
  }
  return isNew;
}
export function dictDel(d: PyDict, k: any): boolean {
  const n = nk(k);
  if (d.o) d.o.delete(n);
  return d.m.delete(n);
}
export function dictKeys(d: PyDict): any[] {
  const out: any[] = [];
  const o = d.o;
  if (!o) { for (const k of d.m.keys()) out.push(k); return out; }
  for (const k of d.m.keys()) out.push(o.has(k) ? o.get(k) : k);
  return out;
}
export function dictItems(d: PyDict): any[] {
  const out: any[] = [];
  const o = d.o;
  for (const [k, v] of d.m) out.push(new PyTuple([o && o.has(k) ? o.get(k) : k, v]));
  return out;
}
export function setAdd(s: PySet, k: any): boolean {
  const n = nk(k);
  if (s.m.has(n)) return false;
  s.m.set(n, k);
  return true;
}
export function setItems(s: PySet): any[] {
  return Array.from(s.m.values());
}
export function dictFromPairs(pairs: [any, any][]): PyDict {
  const d = new PyDict();
  for (const [k, v] of pairs) dictSet(d, k, v);
  return d;
}

// ---- iteration ----
// Returns the items of any iterable. The result may be the iterable's own storage: do not mutate it.
export function asArray(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return v.split('');
  if (v instanceof PyTuple) return v.a;
  if (v instanceof PyRange) {
    if (v.len > 1000) hooks.alloc(v.len);
    const out: any[] = new Array(v.len);
    let x = v.start;
    for (let i = 0; i < v.len; i++, x += v.step) out[i] = x;
    return out;
  }
  if (v instanceof PyDict) return dictKeys(v);
  if (v instanceof PySet) return setItems(v);
  if (v instanceof PyDeque) return v.items();
  if (v instanceof PyIter) {
    const rest = v.a.slice(v.i);
    v.i = v.a.length;
    return rest;
  }
  if (v instanceof PyView) {
    if (v.kind === 'keys') return dictKeys(v.d);
    if (v.kind === 'values') return Array.from(v.d.m.values());
    return dictItems(v.d);
  }
  err('TypeError', `You cannot loop over ${aType(v)}: use a list, string, range or similar.`);
}

// ---- equality and ordering ----
export function eq(a: any, b: any): boolean {
  if (a === b) return true;
  const ta = typeof a;
  const tb = typeof b;
  if (ta === 'number' || ta === 'boolean') {
    if (tb === 'number' || tb === 'boolean') return +a === +b;
    if (b instanceof PyFloat) return +a === b.v;
    return false;
  }
  if (ta === 'string' || a === null) return false;
  if (tb !== 'object' || b === null) {
    return false;
  }
  if (a instanceof PyFloat) {
    if (b instanceof PyFloat) return a.v === b.v;
    return false;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!eq(a[i], b[i])) return false;
    return true;
  }
  if (a instanceof PyTuple) {
    if (!(b instanceof PyTuple) || a.a.length !== b.a.length) return false;
    for (let i = 0; i < a.a.length; i++) if (!eq(a.a[i], b.a[i])) return false;
    return true;
  }
  if (a instanceof PyDict) {
    if (!(b instanceof PyDict) || a.m.size !== b.m.size) return false;
    for (const [k, v] of a.m) {
      if (!b.m.has(k) || !eq(v, b.m.get(k))) return false;
    }
    return true;
  }
  if (a instanceof PySet) {
    if (!(b instanceof PySet) || a.m.size !== b.m.size) return false;
    for (const k of a.m.keys()) if (!b.m.has(k)) return false;
    return true;
  }
  if (a instanceof PyDeque) {
    if (!(b instanceof PyDeque)) return false;
    return eq(a.items(), b.items());
  }
  if (a instanceof PyRange) {
    return b instanceof PyRange && eq(asArray(a), asArray(b));
  }
  if (a instanceof PyBound) return b instanceof PyBound && a.self === b.self && a.fn === b.fn;
  return false;
}

// Three-way comparison for ordering. Returns NaN for unordered floats. Throws TypeError for mixed types.
export function cmp3(a: any, b: any, op: string): number {
  const ta = typeof a;
  const tb = typeof b;
  if (ta === 'number' && tb === 'number') return a < b ? -1 : a > b ? 1 : 0;
  if (ta === 'string' && tb === 'string') return a < b ? -1 : a > b ? 1 : 0;
  if (isNumber(a) && isNumber(b)) {
    const x = numVal(a);
    const y = numVal(b);
    return x < y ? -1 : x > y ? 1 : x === y ? 0 : NaN;
  }
  const seqA = Array.isArray(a) ? a : a instanceof PyTuple ? a.a : null;
  const seqB = Array.isArray(b) ? b : b instanceof PyTuple ? b.a : null;
  if (seqA && seqB && Array.isArray(a) === Array.isArray(b)) {
    const n = Math.min(seqA.length, seqB.length);
    for (let i = 0; i < n; i++) {
      if (!eq(seqA[i], seqB[i])) return cmp3(seqA[i], seqB[i], op);
    }
    return seqA.length < seqB.length ? -1 : seqA.length > seqB.length ? 1 : 0;
  }
  if (a instanceof PySet && b instanceof PySet) {
    // subset ordering
    const sub = (x: PySet, y: PySet) => { for (const k of x.m.keys()) if (!y.m.has(k)) return false; return true; };
    const ab = sub(a, b);
    const ba = sub(b, a);
    return ab && ba ? 0 : ab ? -1 : ba ? 1 : NaN;
  }
  err('TypeError', `Cannot compare ${aType(a)} with ${aType(b)} using '${op}'.`);
}

export function compareOp(op: string, a: any, b: any): boolean {
  const r = cmp3(a, b, op);
  switch (op) {
    case '<': return r < 0;
    case '<=': return r <= 0;
    case '>': return r > 0;
    default: return r >= 0;
  }
}

// ---- repr and str ----
export function strRepr(s: string): string {
  let q = "'";
  if (s.indexOf("'") >= 0 && s.indexOf('"') < 0) q = '"';
  let out = q;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const code = s.charCodeAt(i);
    if (c === '\\') out += '\\\\';
    else if (c === q) out += '\\' + q;
    else if (c === '\n') out += '\\n';
    else if (c === '\r') out += '\\r';
    else if (c === '\t') out += '\\t';
    else if (code < 32 || code === 127) out += '\\x' + (code < 16 ? '0' : '') + code.toString(16);
    else out += c;
  }
  return out + q;
}

let reprBudget = 0;

export function repr(v: any, depth = 0): string {
  if (depth === 0) reprBudget = 1_000_000;
  else if (--reprBudget < 0) err('ValueError', 'That value is too big to print.');
  switch (typeof v) {
    case 'number': return String(v);
    case 'boolean': return v ? 'True' : 'False';
    case 'string': return strRepr(v);
    case 'object': break;
    default: return 'None';
  }
  if (v === null) return 'None';
  if (depth > 40) return '...';
  if (Array.isArray(v)) return '[' + v.map((x) => repr(x, depth + 1)).join(', ') + ']';
  if (v instanceof PyFloat) return floatRepr(v.v);
  if (v instanceof PyTuple) {
    if (v.a.length === 1) return '(' + repr(v.a[0], depth + 1) + ',)';
    return '(' + v.a.map((x) => repr(x, depth + 1)).join(', ') + ')';
  }
  if (v instanceof PyDict) {
    const parts: string[] = [];
    const ks = dictKeys(v);
    let i = 0;
    for (const val of v.m.values()) parts.push(repr(ks[i++], depth + 1) + ': ' + repr(val, depth + 1));
    return '{' + parts.join(', ') + '}';
  }
  if (v instanceof PySet) {
    if (v.m.size === 0) return 'set()';
    return '{' + setItems(v).map((x) => repr(x, depth + 1)).join(', ') + '}';
  }
  if (v instanceof PyDeque) return 'deque([' + v.items().map((x) => repr(x, depth + 1)).join(', ') + '])';
  if (v instanceof PyRange) return v.step === 1 ? `range(${v.start}, ${v.stop})` : `range(${v.start}, ${v.stop}, ${v.step})`;
  if (v instanceof PyView) return 'dict_' + v.kind + '(' + repr(asArray(v), depth + 1) + ')';
  if (v instanceof PyInstance) {
    const m = v.cls.ns.get('__repr__');
    if (m instanceof PyFunc) {
      const r = hooks.callUser(m, [v]);
      if (typeof r !== 'string') err('TypeError', '__repr__ must return a str.');
      return r;
    }
    return `<${v.cls.name} object>`;
  }
  if (v instanceof PyFunc) return `<function ${v.name}>`;
  if (v instanceof PyBound) return `<bound method ${v.fn.name}>`;
  if (v instanceof PyBuiltin) return v.ty ? `<class '${v.name}'>` : `<built-in function ${v.name}>`;
  if (v instanceof PyClass) return `<class '${v.name}'>`;
  if (v instanceof PyExcClass) return `<class '${v.kind}'>`;
  if (v instanceof PyModule) return `<module '${v.name}'>`;
  if (v instanceof PyExc) return v.kind + '(' + v.args.map((x) => repr(x, depth + 1)).join(', ') + ')';
  if (v instanceof PyIter) return `<${v.name} object>`;
  return '<object>';
}

export function str(v: any): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null) {
    if (v instanceof PyInstance) {
      const m = v.cls.ns.get('__str__');
      if (m instanceof PyFunc) {
        const r = hooks.callUser(m, [v]);
        if (typeof r !== 'string') err('TypeError', '__str__ must return a str.');
        return r;
      }
    } else if (v instanceof PyExc) {
      if (v.kind === 'KeyError' && v.args.length === 1) return repr(v.args[0]);
      return v.args.length === 1 ? str(v.args[0]) : v.args.length === 0 ? '' : repr(new PyTuple(v.args));
    }
  }
  return repr(v);
}

// ---- membership ----
export function contains(c: any, x: any): boolean {
  if (Array.isArray(c)) {
    for (let i = 0; i < c.length; i++) if (eq(c[i], x)) return true;
    return false;
  }
  if (typeof c === 'string') {
    if (typeof x !== 'string') err('TypeError', `The left side of 'in' must be a str when searching a str, not ${aType(x)}.`);
    return c.indexOf(x) >= 0;
  }
  if (c instanceof PyDict) return c.m.has(nk(x));
  if (c instanceof PySet) return c.m.has(nk(x));
  if (c instanceof PyTuple) {
    for (const y of c.a) if (eq(y, x)) return true;
    return false;
  }
  if (c instanceof PyRange) {
    if (!isNumber(x)) return false;
    const n = numVal(x);
    if (!Number.isInteger(n)) return false;
    if (c.step > 0 ? n < c.start || n >= c.stop : n > c.start || n <= c.stop) return false;
    return (n - c.start) % c.step === 0;
  }
  if (c instanceof PyView) {
    if (c.kind === 'keys') return c.d.m.has(nk(x));
    return contains(asArray(c), x);
  }
  if (c instanceof PyDeque || c instanceof PyIter) return contains(asArray(c), x);
  err('TypeError', `Cannot use 'in' on ${aType(c)}: it is not a container.`);
}

export function containerSize(v: any): number {
  if (Array.isArray(v)) return v.length;
  if (typeof v === 'string') return v.length;
  if (v instanceof PyTuple) return v.a.length;
  if (v instanceof PyDict || v instanceof PySet) return v.m.size;
  if (v instanceof PyRange) return v.len;
  if (v instanceof PyDeque) return v.size();
  if (v instanceof PyView) return v.d.m.size;
  return 1;
}
