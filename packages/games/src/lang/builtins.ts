// Builtin functions, methods of the builtin types, and the math / collections / heapq modules.
import {
  MAX_INT, PyBound, PyBuiltin, PyClass, PyDeque, PyDict, PyExc, PyExcClass, PyFloat, PyFunc, PyInstance, PyIter,
  PyModule, PyRange, PySet, PyTuple, PyView,
  asArray, cmp3, containerSize, dictDel, dictKeys, dictSet, eq, err, isNumber, nk,
  aType, numVal, repr, setAdd, str, strRepr, tname, truthy,
} from './values.ts';
import type { Rt } from './runtime.ts';
import { binop, floorMod, intPow, overflow } from './ops.ts';
import { expFormat, fixed, floatRepr, pad, parseSpec, signAndGroup } from './format.ts';

export interface Ctx {
  rt: Rt;
  call: (f: any, args: any[], kw: Map<string, any> | null) => any;
}

type Method = (c: Ctx, self: any, args: any[], kw: Map<string, any> | null) => any;

function art(t: string): string {
  return (/^[aeiouAEIOU]/.test(t) ? 'an ' : 'a ') + t;
}

function plural(n: number, w: string): string {
  return `${n} ${w}${n === 1 ? '' : 's'}`;
}

function argc(name: string, args: any[], min: number, max: number): void {
  if (args.length < min || args.length > max) {
    if (min === max) err('TypeError', `${name}() needs ${plural(min, 'argument')}, but ${args.length} ${args.length === 1 ? 'was' : 'were'} given.`);
    err('TypeError', `${name}() needs ${min} to ${max} arguments, but ${args.length} ${args.length === 1 ? 'was' : 'were'} given.`);
  }
}

function noKw(name: string, kw: Map<string, any> | null): void {
  if (kw && kw.size > 0) err('TypeError', `${name}() got an unexpected keyword argument '${kw.keys().next().value}'.`);
}

function onlyKw(name: string, kw: Map<string, any> | null, allowed: string[]): void {
  if (!kw) return;
  for (const k of kw.keys()) if (allowed.indexOf(k) < 0) err('TypeError', `${name}() got an unexpected keyword argument '${k}'.`);
}

function needInt(name: string, v: any, what = 'an int'): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return err('TypeError', `${name}() needs ${what}, but got ${art(tname(v))}.`);
}

export function lessCmp(a: any, b: any): number {
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  const r = cmp3(a, b, '<');
  return r !== r ? 0 : r;
}

function nlogn(n: number): number {
  return n < 2 ? n : Math.ceil(n * Math.log2(n));
}

function sortArray(c: Ctx, arr: any[], key: any, reverse: boolean): any[] {
  const n = arr.length;
  c.rt.ops += nlogn(n);
  if (n < 2) return arr;
  if (key === null || key === undefined) {
    arr.sort(reverse ? (a, b) => lessCmp(b, a) : lessCmp);
    return arr;
  }
  const keys = new Array(n);
  for (let i = 0; i < n; i++) keys[i] = c.call(key, [arr[i]], null);
  const idx = new Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  idx.sort(reverse ? (i, j) => lessCmp(keys[j], keys[i]) : (i, j) => lessCmp(keys[i], keys[j]));
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = arr[idx[i]];
  for (let i = 0; i < n; i++) arr[i] = out[i];
  return arr;
}

// ---- number conversion ----
function roundHalfEven(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

function toIntSafe(x: number): number {
  if (!isFinite(x)) err('OverflowError', 'Cannot turn an infinite or not-a-number float into an int.');
  if (Math.abs(x) > MAX_INT) overflow();
  return x + 0;
}

function parseIntStr(s: string, base: number): number {
  const t = s.trim().replace(/_/g, '');
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, base);
  const re = new RegExp('^[+-]?[' + digits + ']+$', 'i');
  let u = t;
  if (base === 16) u = u.replace(/^([+-]?)0x/i, '$1');
  else if (base === 8) u = u.replace(/^([+-]?)0o/i, '$1');
  else if (base === 2) u = u.replace(/^([+-]?)0b/i, '$1');
  if (!re.test(u)) err('ValueError', `Cannot turn ${strRepr(s)} into an int.`);
  const v = parseInt(u, base);
  if (Math.abs(v) > MAX_INT) overflow();
  return v;
}

function parseFloatStr(s: string): number {
  const t = s.trim().replace(/_/g, '').toLowerCase();
  if (/^[+-]?(inf|infinity)$/.test(t)) return t[0] === '-' ? -Infinity : Infinity;
  if (/^[+-]?nan$/.test(t)) return NaN;
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/.test(t)) err('ValueError', `Cannot turn ${strRepr(s)} into a float.`);
  return Number(t);
}

export function formatValue(v: any, spec: string, conv: string | null): string {
  if (conv === 'r' || conv === 'a') v = repr(v);
  else if (conv === 's') v = str(v);
  if (spec === '') return str(v);
  const sp = parseSpec(spec);
  if (!sp) return err('ValueError', `The format spec '${spec}' is not valid.`);
  const t = sp.type;
  if (typeof v === 'string') {
    if (t !== '' && t !== 's') err('ValueError', `The format code '${t}' cannot be used with a str.`);
    return pad(sp.prec >= 0 ? v.slice(0, sp.prec) : v, sp, false);
  }
  if (typeof v === 'number' || typeof v === 'boolean') {
    const n = numVal(v);
    switch (t) {
      case '': case 'd':
        if (sp.prec >= 0) err('ValueError', 'A precision cannot be used with an int format.');
        return pad(signAndGroup(String(n), sp), sp, true);
      case 'x': case 'X': case 'o': case 'b': {
        const base = t === 'o' ? 8 : t === 'b' ? 2 : 16;
        let s = Math.abs(n).toString(base);
        if (t === 'X') s = s.toUpperCase();
        return pad(signAndGroup((n < 0 ? '-' : '') + s, sp), sp, true);
      }
      case 'f': case 'F': case 'e': case 'E': case '%':
        return floatFormat(n, sp);
      default:
        return err('ValueError', `The format code '${t}' cannot be used with an int.`);
    }
  }
  if (v instanceof PyFloat) {
    switch (t) {
      case '':
        return pad(signAndGroup(floatRepr(v.v), sp), sp, true);
      case 'f': case 'F': case 'e': case 'E': case '%':
        return floatFormat(v.v, sp);
      default:
        return err('ValueError', `The format code '${t}' cannot be used with a float.`);
    }
  }
  return pad(str(v), sp, false);
}

function floatFormat(x: number, sp: any): string {
  const prec = sp.prec < 0 ? 6 : sp.prec;
  const body = sp.type === '%' ? fixed(x * 100, prec) + '%' : sp.type === 'e' || sp.type === 'E' ? expFormat(x, prec, sp.type === 'E') : fixed(x, prec);
  return pad(signAndGroup(body, sp), sp, true);
}

// ---- string methods ----
function strArg(name: string, v: any, what = 'a str'): string {
  if (typeof v !== 'string') err('TypeError', `${name} needs ${what}, but got ${art(tname(v))}.`);
  return v;
}

function stripChars(s: string, chars: any, left: boolean, right: boolean): string {
  if (chars === undefined || chars === null) {
    let a = 0;
    let b = s.length;
    if (left) while (a < b && /\s/.test(s[a])) a++;
    if (right) while (b > a && /\s/.test(s[b - 1])) b--;
    return s.slice(a, b);
  }
  const set = strArg('strip()', chars);
  let a = 0;
  let b = s.length;
  if (left) while (a < b && set.indexOf(s[a]) >= 0) a++;
  if (right) while (b > a && set.indexOf(s[b - 1]) >= 0) b--;
  return s.slice(a, b);
}

const strMethods: Record<string, Method> = {
  capitalize: (c, s) => { c.rt.ops += s.length; return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); },
  title: (c, s) => { c.rt.ops += s.length; return s.toLowerCase().replace(/(^|[^a-z])([a-z])/g, (_m, a, b) => a + b.toUpperCase()); },
  upper: (c, s) => { c.rt.ops += s.length; return s.toUpperCase(); },
  lower: (c, s) => { c.rt.ops += s.length; return s.toLowerCase(); },
  strip: (c, s, a) => { argc('strip', a, 0, 1); c.rt.ops += s.length; return stripChars(s, a[0], true, true); },
  lstrip: (c, s, a) => { argc('lstrip', a, 0, 1); c.rt.ops += s.length; return stripChars(s, a[0], true, false); },
  rstrip: (c, s, a) => { argc('rstrip', a, 0, 1); c.rt.ops += s.length; return stripChars(s, a[0], false, true); },
  split: (c, s, a) => {
    argc('split', a, 0, 2);
    c.rt.ops += s.length;
    const sep = a[0] ?? null;
    let max = a.length > 1 ? needInt('split', a[1]) : -1;
    if (sep !== null && strArg('split()', sep) === '') err('ValueError', 'split() cannot use an empty separator.');
    let parts = sep === null ? s.split(/\s+/).filter((x) => x !== '') : s.split(sep);
    if (max >= 0 && parts.length > max + 1) {
      // keep the rest of the text unsplit after max splits
      let rest = s;
      const head: string[] = [];
      while (head.length < max) {
        let i: number;
        let len: number;
        if (sep === null) { const m = /\s+/.exec(rest.replace(/^\s+/, '')); const t = rest.replace(/^\s+/, ''); if (!m) break; head.push(t.slice(0, m.index)); rest = t.slice(m.index + m[0].length); continue; }
        i = rest.indexOf(sep); len = sep.length;
        if (i < 0) break;
        head.push(rest.slice(0, i));
        rest = rest.slice(i + len);
      }
      parts = head.concat([rest]);
    }
    c.rt.alloc(parts.length);
    return parts;
  },
  join: (c, s, a) => {
    argc('join', a, 1, 1);
    const items = asArray(a[0]);
    c.rt.ops += items.length;
    for (let i = 0; i < items.length; i++) {
      if (typeof items[i] !== 'string') err('TypeError', `join() needs strings, but item ${i} is ${art(tname(items[i]))}: convert it with str() first.`);
    }
    const r = items.join(s);
    if (r.length >= 32) c.rt.alloc(r.length);
    return r;
  },
  replace: (c, s, a) => {
    argc('replace', a, 2, 3);
    const old = strArg('replace()', a[0]);
    const nw = strArg('replace()', a[1]);
    c.rt.ops += s.length;
    let r: string;
    if (a.length === 3) {
      let count = needInt('replace', a[2]);
      if (count < 0) r = s.split(old).join(nw);
      else {
        r = '';
        let rest = s;
        while (count > 0) {
          const i = rest.indexOf(old);
          if (i < 0 || old === '') break;
          r += rest.slice(0, i) + nw;
          rest = rest.slice(i + old.length);
          count--;
        }
        r += rest;
      }
    } else r = old === '' ? s.split('').join(nw) : s.split(old).join(nw);
    if (r.length >= 32) c.rt.alloc(r.length);
    return r;
  },
  find: (c, s, a) => { argc('find', a, 1, 3); c.rt.ops += s.length; return s.indexOf(strArg('find()', a[0]), a[1] === undefined ? 0 : needInt('find', a[1])); },
  index: (c, s, a) => {
    argc('index', a, 1, 3);
    c.rt.ops += s.length;
    const i = s.indexOf(strArg('index()', a[0]), a[1] === undefined ? 0 : needInt('index', a[1]));
    if (i < 0) err('ValueError', `The text ${strRepr(a[0])} was not found in the string.`);
    return i;
  },
  count: (c, s, a) => {
    argc('count', a, 1, 1);
    const sub = strArg('count()', a[0]);
    c.rt.ops += s.length;
    if (sub === '') return s.length + 1;
    let n = 0;
    let i = 0;
    while ((i = s.indexOf(sub, i)) >= 0) { n++; i += sub.length; }
    return n;
  },
  startswith: (c, s, a) => {
    argc('startswith', a, 1, 1);
    if (a[0] instanceof PyTuple) return a[0].a.some((x: any) => s.startsWith(strArg('startswith()', x)));
    return s.startsWith(strArg('startswith()', a[0]));
  },
  endswith: (c, s, a) => {
    argc('endswith', a, 1, 1);
    if (a[0] instanceof PyTuple) return a[0].a.some((x: any) => s.endsWith(strArg('endswith()', x)));
    return s.endsWith(strArg('endswith()', a[0]));
  },
  isdigit: (c, s) => /^[0-9]+$/.test(s),
  isalpha: (c, s) => /^\p{L}+$/u.test(s),
  isalnum: (c, s) => /^[\p{L}0-9]+$/u.test(s),
  ljust: (c, s, a) => { argc('ljust', a, 1, 2); const f = a[1] === undefined ? ' ' : strArg('ljust()', a[1]); return s.padEnd(needInt('ljust', a[0]), f); },
  rjust: (c, s, a) => { argc('rjust', a, 1, 2); const f = a[1] === undefined ? ' ' : strArg('rjust()', a[1]); return s.padStart(needInt('rjust', a[0]), f); },
};

// ---- list methods ----
function checkIndexArg(name: string, v: any): number {
  return needInt(name, v);
}

const listMethods: Record<string, Method> = {
  append: (c, l, a) => { argc('append', a, 1, 1); c.rt.alloc(1); l.push(a[0]); return null; },
  pop: (c, l, a) => {
    argc('pop', a, 0, 1);
    if (l.length === 0) err('IndexError', 'You cannot pop from an empty list.');
    if (a.length === 0) return l.pop();
    let i = checkIndexArg('pop', a[0]);
    if (i < 0) i += l.length;
    if (i < 0 || i >= l.length) err('IndexError', `The pop index ${a[0]} is out of range: the list has ${l.length} items.`);
    c.rt.ops += l.length - i;
    return l.splice(i, 1)[0];
  },
  insert: (c, l, a) => {
    argc('insert', a, 2, 2);
    let i = checkIndexArg('insert', a[0]);
    if (i < 0) i = Math.max(0, i + l.length);
    if (i > l.length) i = l.length;
    c.rt.alloc(1);
    c.rt.ops += l.length - i;
    l.splice(i, 0, a[1]);
    return null;
  },
  remove: (c, l, a) => {
    argc('remove', a, 1, 1);
    for (let i = 0; i < l.length; i++) {
      c.rt.ops++;
      if (eq(l[i], a[0])) { c.rt.ops += l.length - i; l.splice(i, 1); return null; }
    }
    return err('ValueError', `The value ${repr(a[0])} is not in the list, so it cannot be removed.`);
  },
  index: (c, l, a) => {
    argc('index', a, 1, 1);
    for (let i = 0; i < l.length; i++) { c.rt.ops++; if (eq(l[i], a[0])) return i; }
    return err('ValueError', `The value ${repr(a[0])} is not in the list.`);
  },
  count: (c, l, a) => {
    argc('count', a, 1, 1);
    let n = 0;
    c.rt.ops += l.length;
    for (let i = 0; i < l.length; i++) if (eq(l[i], a[0])) n++;
    return n;
  },
  extend: (c, l, a) => {
    argc('extend', a, 1, 1);
    const items = asArray(a[0]);
    const n = items.length;
    c.rt.alloc(n);
    c.rt.ops += n;
    if (items === l) { const copy = l.slice(); for (let i = 0; i < n; i++) l.push(copy[i]); return null; }
    for (let i = 0; i < n; i++) l.push(items[i]);
    return null;
  },
  sort: (c, l, a, kw) => {
    if (a.length > 0) err('TypeError', 'sort() takes no positional arguments; use key= and reverse= by name.');
    onlyKw('sort', kw, ['key', 'reverse']);
    sortArray(c, l, kw ? kw.get('key') ?? null : null, kw ? truthy(kw.get('reverse')) : false);
    return null;
  },
  reverse: (c, l) => { c.rt.ops += l.length; l.reverse(); return null; },
  copy: (c, l) => { c.rt.alloc(l.length); c.rt.ops += l.length; return l.slice(); },
  clear: (c, l) => { l.length = 0; return null; },
};

// ---- dict methods ----
const dictMethods: Record<string, Method> = {
  get: (c, d, a) => {
    argc('get', a, 1, 2);
    const v = d.m.get(nk(a[0]));
    return v === undefined ? (a.length > 1 ? a[1] : null) : v;
  },
  items: (c, d) => new PyView('items', d),
  keys: (c, d) => new PyView('keys', d),
  values: (c, d) => new PyView('values', d),
  setdefault: (c, d, a) => {
    argc('setdefault', a, 1, 2);
    const v = d.m.get(nk(a[0]));
    if (v !== undefined) return v;
    const dv = a.length > 1 ? a[1] : null;
    c.rt.alloc(1);
    dictSet(d, a[0], dv);
    return dv;
  },
  pop: (c, d, a) => {
    argc('pop', a, 1, 2);
    const n = nk(a[0]);
    const v = d.m.get(n);
    if (v === undefined) {
      if (a.length > 1) return a[1];
      return err('KeyError', `The key ${repr(a[0])} is not in the dict.`);
    }
    dictDel(d, a[0]);
    return v;
  },
  update: (c, d, a, kw) => {
    argc('update', a, 0, 1);
    if (a.length === 1) {
      if (a[0] instanceof PyDict) {
        const ks = dictKeys(a[0]);
        let i = 0;
        for (const v of a[0].m.values()) { if (dictSet(d, ks[i++], v)) c.rt.alloc(1); }
      } else {
        for (const p of asArray(a[0])) {
          const pair = asArray(p);
          if (pair.length !== 2) err('ValueError', 'update() needs pairs of (key, value).');
          if (dictSet(d, pair[0], pair[1])) c.rt.alloc(1);
        }
      }
    }
    if (kw) for (const [k, v] of kw) if (dictSet(d, k, v)) c.rt.alloc(1);
    return null;
  },
  clear: (c, d) => { d.m.clear(); d.o = null; return null; },
  copy: (c, d) => {
    const n = new PyDict();
    c.rt.alloc(d.m.size);
    c.rt.ops += d.m.size;
    for (const [k, v] of d.m) n.m.set(k, v);
    if (d.o) n.o = new Map(d.o);
    return n;
  },
};

// ---- set methods ----
const setMethods: Record<string, Method> = {
  add: (c, s, a) => { argc('add', a, 1, 1); if (setAdd(s, a[0])) c.rt.alloc(1); return null; },
  discard: (c, s, a) => { argc('discard', a, 1, 1); s.m.delete(nk(a[0])); return null; },
  remove: (c, s, a) => {
    argc('remove', a, 1, 1);
    if (!s.m.delete(nk(a[0]))) err('KeyError', `The item ${repr(a[0])} is not in the set.`);
    return null;
  },
  pop: (c, s) => {
    if (s.m.size === 0) err('KeyError', 'You cannot pop() from an empty set.');
    const k = s.m.keys().next().value;
    const v = s.m.get(k);
    s.m.delete(k);
    return v;
  },
  clear: (c, s) => { s.m.clear(); return null; },
  copy: (c, s) => { const n = new PySet(); c.rt.alloc(s.m.size); for (const [k, v] of s.m) n.m.set(k, v); return n; },
  update: (c, s, a) => { for (const x of a) for (const y of asArray(x)) if (setAdd(s, y)) c.rt.alloc(1); return null; },
};

const dequeMethods: Record<string, Method> = {
  append: (c, d, a) => { argc('append', a, 1, 1); c.rt.alloc(1); d.a.push(a[0]); return null; },
  appendleft: (c, d, a) => {
    argc('appendleft', a, 1, 1);
    c.rt.alloc(1);
    if (d.h > 0) d.a[--d.h] = a[0];
    else d.a.unshift(a[0]);
    return null;
  },
  pop: (c, d) => {
    if (d.size() === 0) err('IndexError', 'You cannot pop from an empty deque.');
    return d.a.pop();
  },
  popleft: (c, d) => {
    if (d.size() === 0) err('IndexError', 'You cannot popleft from an empty deque.');
    const v = d.a[d.h];
    d.a[d.h] = undefined;
    d.h++;
    if (d.h > 32 && d.h * 2 > d.a.length) { d.a = d.a.slice(d.h); d.h = 0; }
    return v;
  },
  extend: (c, d, a) => { argc('extend', a, 1, 1); const items = asArray(a[0]).slice(); c.rt.alloc(items.length); for (const x of items) d.a.push(x); return null; },
  clear: (c, d) => { d.a = []; d.h = 0; return null; },
};

const tupleMethods: Record<string, Method> = {
  count: (c, t, a) => { let n = 0; for (const x of t.a) if (eq(x, a[0])) n++; c.rt.ops += t.a.length; return n; },
  index: (c, t, a) => {
    for (let i = 0; i < t.a.length; i++) { c.rt.ops++; if (eq(t.a[i], a[0])) return i; }
    return err('ValueError', `The value ${repr(a[0])} is not in the tuple.`);
  },
};

// Method tables must not inherit from Object.prototype ("constructor", "toString" ...).
for (const t of [strMethods, listMethods, dictMethods, setMethods, dequeMethods, tupleMethods]) Object.setPrototypeOf(t, null);

export function methodTable(o: any): Record<string, Method> | null {
  if (typeof o === 'string') return strMethods;
  if (Array.isArray(o)) return listMethods;
  if (o instanceof PyDict) return dictMethods;
  if (o instanceof PySet) return setMethods;
  if (o instanceof PyDeque) return dequeMethods;
  if (o instanceof PyTuple) return tupleMethods;
  return null;
}

// `str.lower`, `list.append` ...: a method looked up on the type, which takes the receiver as its first argument.
export function typeMethod(c: Ctx, ty: string, name: string): PyBuiltin | undefined {
  const tbl = ty === 'str' ? strMethods : ty === 'list' ? listMethods : ty === 'dict' ? dictMethods : ty === 'set' ? setMethods : ty === 'tuple' ? tupleMethods : ty === 'deque' ? dequeMethods : null;
  const m = tbl && tbl[name];
  if (!m) return undefined;
  return new PyBuiltin(`${ty}.${name}`, (args, kw) => {
    if (args.length === 0 || methodTable(args[0]) !== tbl) err('TypeError', `${ty}.${name}() needs ${ty === 'list' ? 'a list' : 'a ' + ty} as its first argument.`);
    return m(c, args[0], args.slice(1), kw);
  });
}

export function noAttr(o: any, name: string): never {
  if (typeof o === 'string' && name === 'format') {
    return err('AttributeError', "Snek strings have no format() method: write an f-string such as f\"{x}\" instead.");
  }
  if (o instanceof PyInstance) return err('AttributeError', `The ${o.cls.name} object has no attribute '${name}'.`);
  if (o instanceof PyModule) return err('AttributeError', `The module '${o.name}' has no '${name}' in Snek.`);
  if (o instanceof PyClass) return err('AttributeError', `The class ${o.name} has no attribute '${name}'.`);
  return err('AttributeError', `${aType(o)[0].toUpperCase()}${aType(o).slice(1)} has no attribute '${name}'.`);
}

// ---- heapq ----
function siftDown(c: Ctx, h: any[], start: number, pos: number): void {
  const item = h[pos];
  while (pos > start) {
    const parent = (pos - 1) >> 1;
    c.rt.ops++;
    if (lessCmp(item, h[parent]) < 0) { h[pos] = h[parent]; pos = parent; } else break;
  }
  h[pos] = item;
}
function siftUp(c: Ctx, h: any[], pos: number): void {
  const end = h.length;
  const start = pos;
  const item = h[pos];
  let child = 2 * pos + 1;
  while (child < end) {
    const right = child + 1;
    c.rt.ops++;
    if (right < end && lessCmp(h[child], h[right]) >= 0) child = right;
    h[pos] = h[child];
    pos = child;
    child = 2 * pos + 1;
  }
  h[pos] = item;
  siftDown(c, h, start, pos);
}

function needList(name: string, v: any): any[] {
  if (!Array.isArray(v)) err('TypeError', `${name}() needs a list as its first argument, but got ${art(tname(v))}.`);
  return v;
}

function makeHeapq(c: Ctx): PyModule {
  const m = new Map<string, any>();
  m.set('heappush', new PyBuiltin('heappush', (a) => {
    argc('heappush', a, 2, 2);
    const h = needList('heappush', a[0]);
    c.rt.alloc(1);
    h.push(a[1]);
    siftDown(c, h, 0, h.length - 1);
    return null;
  }));
  m.set('heappop', new PyBuiltin('heappop', (a) => {
    argc('heappop', a, 1, 1);
    const h = needList('heappop', a[0]);
    if (h.length === 0) err('IndexError', 'You cannot heappop from an empty heap.');
    const last = h.pop();
    if (h.length === 0) return last;
    const top = h[0];
    h[0] = last;
    siftUp(c, h, 0);
    return top;
  }));
  m.set('heapify', new PyBuiltin('heapify', (a) => {
    argc('heapify', a, 1, 1);
    const h = needList('heapify', a[0]);
    for (let i = (h.length >> 1) - 1; i >= 0; i--) siftUp(c, h, i);
    return null;
  }));
  return new PyModule('heapq', m);
}

function makeMath(c: Ctx): PyModule {
  const m = new Map<string, any>();
  const f1 = (name: string, fn: (x: number) => number, toInt = false) => {
    m.set(name, new PyBuiltin(name, (a) => {
      argc(name, a, 1, 1);
      if (!isNumber(a[0])) err('TypeError', `math.${name}() needs a number, but got ${art(tname(a[0]))}.`);
      const r = fn(numVal(a[0]));
      return toInt ? toIntSafe(r) : new PyFloat(r);
    }));
  };
  f1('floor', Math.floor, true);
  f1('ceil', Math.ceil, true);
  f1('trunc', Math.trunc, true);
  f1('fabs', Math.abs);
  f1('sin', Math.sin);
  f1('cos', Math.cos);
  m.set('sqrt', new PyBuiltin('sqrt', (a) => {
    argc('sqrt', a, 1, 1);
    if (!isNumber(a[0])) err('TypeError', `math.sqrt() needs a number, but got ${art(tname(a[0]))}.`);
    const x = numVal(a[0]);
    if (x < 0) err('ValueError', 'math.sqrt() needs a number that is zero or more.');
    return new PyFloat(Math.sqrt(x));
  }));
  const logf = (name: string, fn: (x: number) => number) => {
    m.set(name, new PyBuiltin(name, (a) => {
      argc(name, a, 1, name === 'log' ? 2 : 1);
      const x = numVal(a[0]);
      if (!(x > 0)) err('ValueError', `math.${name}() needs a number greater than zero.`);
      if (name === 'log' && a.length === 2) return new PyFloat(Math.log(x) / Math.log(numVal(a[1])));
      return new PyFloat(fn(x));
    }));
  };
  logf('log', Math.log);
  logf('log10', Math.log10);
  m.set('pow', new PyBuiltin('pow', (a) => { argc('pow', a, 2, 2); return new PyFloat(Math.pow(numVal(a[0]), numVal(a[1]))); }));
  m.set('gcd', new PyBuiltin('gcd', (a) => {
    argc('gcd', a, 2, 2);
    let x = Math.abs(needInt('gcd', a[0]));
    let y = Math.abs(needInt('gcd', a[1]));
    while (y) { [x, y] = [y, x % y]; }
    return x;
  }));
  m.set('inf', new PyFloat(Infinity));
  m.set('nan', new PyFloat(NaN));
  m.set('pi', new PyFloat(Math.PI));
  m.set('e', new PyFloat(Math.E));
  return new PyModule('math', m);
}

function makeCollections(c: Ctx): PyModule {
  const m = new Map<string, any>();
  m.set('deque', new PyBuiltin('deque', (a, kw) => {
    argc('deque', a, 0, 1);
    onlyKw('deque', kw, []);
    const items = a.length ? asArray(a[0]).slice() : [];
    c.rt.alloc(items.length);
    return new PyDeque(items);
  }, 'deque'));
  return new PyModule('collections', m);
}

export function getModule(c: Ctx, name: string): PyModule {
  switch (name) {
    case 'math': return makeMath(c);
    case 'heapq': return makeHeapq(c);
    default: return makeCollections(c);
  }
}

// ---- builtin functions ----
const EXC_NAMES = [
  'Exception', 'ValueError', 'TypeError', 'IndexError', 'KeyError', 'ZeroDivisionError', 'NameError',
  'AttributeError', 'OverflowError', 'EOFError', 'RuntimeError', 'AssertionError',
];

export function excFromCall(kind: string, args: any[]): PyExc {
  const msg = args.length === 0 ? '' : args.length === 1 ? str(args[0]) : repr(new PyTuple(args));
  const e = new PyExc(kind, msg, args.slice());
  e.user = true;
  return e;
}

function isInstanceOf(v: any, t: any): boolean {
  if (t instanceof PyTuple) return t.a.some((x: any) => isInstanceOf(v, x));
  if (t instanceof PyBuiltin && t.ty) {
    switch (t.ty) {
      case 'int': return typeof v === 'number' || typeof v === 'boolean';
      case 'bool': return typeof v === 'boolean';
      case 'float': return v instanceof PyFloat;
      case 'str': return typeof v === 'string';
      case 'list': return Array.isArray(v);
      case 'tuple': return v instanceof PyTuple;
      case 'dict': return v instanceof PyDict;
      case 'set': return v instanceof PySet;
      case 'deque': return v instanceof PyDeque;
      case 'range': return v instanceof PyRange;
      default: return false;
    }
  }
  if (t instanceof PyClass) return v instanceof PyInstance && v.cls === t;
  if (t instanceof PyExcClass) return v instanceof PyExc && (t.kind === 'Exception' || t.kind === v.kind);
  return err('TypeError', 'isinstance() needs a type or a tuple of types as its second argument.');
}

export function makeBuiltins(c: Ctx): Map<string, any> {
  const rt = c.rt;
  const B = new Map<string, any>();
  const def = (name: string, fn: (args: any[], kw: Map<string, any> | null) => any, ty: string | null = null) => {
    B.set(name, new PyBuiltin(name, fn, ty));
  };

  for (const n of EXC_NAMES) B.set(n, new PyExcClass(n));

  def('print', (args, kw) => {
    onlyKw('print', kw, ['sep', 'end', 'file', 'flush']);
    let sep = ' ';
    let end = '\n';
    if (kw) {
      const s = kw.get('sep');
      if (s !== undefined && s !== null) sep = strArg('print() sep=', s);
      const e = kw.get('end');
      if (e !== undefined && e !== null) end = strArg('print() end=', e);
    }
    let line = '';
    for (let i = 0; i < args.length; i++) {
      if (i > 0) line += sep;
      line += str(args[i]);
    }
    rt.write(line + end);
    return null;
  });
  def('input', (args) => {
    argc('input', args, 0, 1);
    if (args.length) rt.write(str(args[0]));
    if (rt.inIdx >= rt.input.length) err('EOFError', 'input() found no more lines to read.');
    return String(rt.input[rt.inIdx++]);
  });
  def('len', (args) => {
    argc('len', args, 1, 1);
    const v = args[0];
    if (v instanceof PyIter || typeof v === 'number' || typeof v === 'boolean' || v === null || v instanceof PyFloat || v instanceof PyFunc) {
      err('TypeError', `len() needs a list, string, tuple, dict, set or range, but got ${art(tname(v))}.`);
    }
    if (v instanceof PyInstance) {
      const m = v.cls.ns.get('__len__');
      if (m instanceof PyFunc) return c.call(new PyBound(v, m), [], null);
      err('TypeError', `len() cannot measure ${art(tname(v))}.`);
    }
    return containerSize(v);
  });
  def('abs', (args) => {
    argc('abs', args, 1, 1);
    const v = args[0];
    if (typeof v === 'number') return Math.abs(v);
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v instanceof PyFloat) return new PyFloat(Math.abs(v.v));
    return err('TypeError', `abs() needs a number, but got ${art(tname(v))}.`);
  });
  const minmax = (name: string, sign: number) => (args: any[], kw: Map<string, any> | null) => {
    onlyKw(name, kw, ['key', 'default']);
    let items: any[];
    if (args.length === 1) items = asArray(args[0]);
    else if (args.length > 1) items = args;
    else return err('TypeError', `${name}() needs an iterable or at least two values.`);
    const key = kw ? kw.get('key') ?? null : null;
    if (items.length === 0) {
      if (kw && kw.has('default')) return kw.get('default');
      err('ValueError', `${name}() cannot choose from an empty sequence.`);
    }
    rt.ops += items.length;
    let best = items[0];
    let bestKey = key ? c.call(key, [best], null) : best;
    for (let i = 1; i < items.length; i++) {
      const k = key ? c.call(key, [items[i]], null) : items[i];
      if (lessCmp(k, bestKey) * sign > 0) { best = items[i]; bestKey = k; }
    }
    return best;
  };
  def('min', minmax('min', -1));
  def('max', minmax('max', 1));
  def('sum', (args, kw) => {
    onlyKw('sum', kw, ['start']);
    argc('sum', args, 1, 2);
    const items = asArray(args[0]);
    let acc: any = args.length > 1 ? args[1] : kw && kw.has('start') ? kw.get('start') : 0;
    if (typeof acc === 'string') err('TypeError', "sum() cannot add strings: use ''.join(...) instead.");
    rt.ops += items.length;
    for (let i = 0; i < items.length; i++) {
      const x = items[i];
      if (typeof acc === 'number' && typeof x === 'number') {
        acc += x;
        if (acc > MAX_INT || acc < -MAX_INT) overflow();
      } else acc = binop(rt, '+', acc, x);
    }
    return acc;
  });
  def('sorted', (args, kw) => {
    argc('sorted', args, 1, 1);
    onlyKw('sorted', kw, ['key', 'reverse']);
    const arr = asArray(args[0]).slice();
    rt.alloc(arr.length);
    return sortArray(c, arr, kw ? kw.get('key') ?? null : null, kw ? truthy(kw.get('reverse')) : false);
  });
  def('reversed', (args) => {
    argc('reversed', args, 1, 1);
    const arr = asArray(args[0]).slice().reverse();
    rt.alloc(arr.length);
    rt.ops += arr.length;
    return new PyIter(arr, 'list_reverseiterator');
  });
  def('enumerate', (args, kw) => {
    argc('enumerate', args, 1, 2);
    onlyKw('enumerate', kw, ['start']);
    const start = args.length > 1 ? needInt('enumerate', args[1]) : kw && kw.has('start') ? needInt('enumerate', kw.get('start')) : 0;
    const items = asArray(args[0]);
    rt.alloc(items.length);
    rt.ops += items.length;
    const out = new Array(items.length);
    for (let i = 0; i < items.length; i++) out[i] = new PyTuple([start + i, items[i]]);
    return new PyIter(out, 'enumerate');
  });
  def('zip', (args, kw) => {
    noKw('zip', kw);
    const arrs = args.map(asArray);
    let n = arrs.length ? arrs[0].length : 0;
    for (const a of arrs) n = Math.min(n, a.length);
    rt.alloc(n);
    rt.ops += n;
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = new PyTuple(arrs.map((a) => a[i]));
    return new PyIter(out, 'zip');
  });
  def('map', (args, kw) => {
    noKw('map', kw);
    if (args.length < 2) err('TypeError', 'map() needs a function and at least one iterable.');
    const f = args[0];
    const arrs = args.slice(1).map(asArray);
    let n = arrs[0].length;
    for (const a of arrs) n = Math.min(n, a.length);
    rt.alloc(n);
    rt.ops += n;
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = c.call(f, arrs.map((a) => a[i]), null);
    return new PyIter(out, 'map');
  });
  def('filter', (args, kw) => {
    noKw('filter', kw);
    argc('filter', args, 2, 2);
    const items = asArray(args[1]);
    rt.ops += items.length;
    const out: any[] = [];
    for (let i = 0; i < items.length; i++) {
      if (args[0] === null ? truthy(items[i]) : truthy(c.call(args[0], [items[i]], null))) out.push(items[i]);
    }
    rt.alloc(out.length);
    return new PyIter(out, 'filter');
  });
  def('any', (args) => {
    argc('any', args, 1, 1);
    const items = asArray(args[0]);
    for (let i = 0; i < items.length; i++) { rt.ops++; if (truthy(items[i])) return true; }
    return false;
  });
  def('all', (args) => {
    argc('all', args, 1, 1);
    const items = asArray(args[0]);
    for (let i = 0; i < items.length; i++) { rt.ops++; if (!truthy(items[i])) return false; }
    return true;
  });
  def('ord', (args) => {
    argc('ord', args, 1, 1);
    if (typeof args[0] !== 'string' || args[0].length !== 1) err('TypeError', `ord() needs a single character, but got ${repr(args[0])}.`);
    return args[0].charCodeAt(0);
  });
  def('chr', (args) => {
    argc('chr', args, 1, 1);
    const n = needInt('chr', args[0]);
    if (n < 0 || n > 0x10ffff) err('ValueError', 'chr() needs a number from 0 to 1114111.');
    return String.fromCodePoint(n);
  });
  def('round', (args, kw) => {
    argc('round', args, 1, 2);
    noKw('round', kw);
    const v = args[0];
    const hasNd = args.length > 1 && args[1] !== null;
    if (typeof v === 'number' || typeof v === 'boolean') {
      const x = numVal(v);
      if (!hasNd) return x;
      const nd = needInt('round', args[1]);
      if (nd >= 0) return x;
      const p = intPow(10, -nd);
      const r = floorMod(x, p);
      let base = x - r;
      if (r * 2 > p || (r * 2 === p && floorMod(base / p, 2) === 1)) base += p;
      return base;
    }
    if (v instanceof PyFloat) {
      if (!hasNd) return toIntSafe(roundHalfEven(v.v));
      const nd = needInt('round', args[1]);
      if (!isFinite(v.v)) return v;
      if (nd >= 0) return new PyFloat(Number(fixed(v.v, Math.min(nd, 300))));
      const p = Math.pow(10, -nd);
      return new PyFloat(roundHalfEven(v.v / p) * p);
    }
    return err('TypeError', `round() needs a number, but got ${art(tname(v))}.`);
  });
  def('isinstance', (args) => {
    argc('isinstance', args, 2, 2);
    return isInstanceOf(args[0], args[1]);
  });
  def('range', (args, kw) => {
    noKw('range', kw);
    argc('range', args, 1, 3);
    const n = args.map((x) => {
      if (typeof x === 'number') return x;
      if (typeof x === 'boolean') return x ? 1 : 0;
      return err('TypeError', `range() needs ints, but got ${art(tname(x))}.`);
    });
    if (n.length === 3 && n[2] === 0) err('ValueError', 'range() cannot use a step of zero.');
    if (n.length === 1) return new PyRange(0, n[0], 1);
    return new PyRange(n[0], n[1], n.length === 3 ? n[2] : 1);
  }, 'range');
  def('repr', (args) => { argc('repr', args, 1, 1); return repr(args[0]); });
  def('divmod', (args) => {
    argc('divmod', args, 2, 2);
    return new PyTuple([binop(rt, '//', args[0], args[1]), binop(rt, '%', args[0], args[1])]);
  });
  def('pow', (args) => {
    argc('pow', args, 2, 3);
    if (args.length === 3) {
      let base = needInt('pow', args[0]);
      let e = needInt('pow', args[1]);
      const mod = needInt('pow', args[2]);
      if (mod === 0) err('ValueError', 'pow() cannot use 0 as the modulus.');
      let r = 1;
      base = floorMod(base, mod);
      while (e > 0) {
        if (e % 2 === 1) r = Number((BigInt(r) * BigInt(base)) % BigInt(mod));
        base = Number((BigInt(base) * BigInt(base)) % BigInt(mod));
        e = Math.floor(e / 2);
      }
      return r;
    }
    return binop(rt, '**', args[0], args[1]);
  });

  // ---- type constructors ----
  def('int', (args, kw) => {
    noKw('int', kw);
    argc('int', args, 0, 2);
    if (args.length === 0) return 0;
    const v = args[0];
    if (args.length === 2) return parseIntStr(strArg('int()', v), needInt('int', args[1]));
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v instanceof PyFloat) return toIntSafe(Math.trunc(v.v));
    if (typeof v === 'string') return parseIntStr(v, 10);
    return err('TypeError', `int() cannot turn ${art(tname(v))} into an int.`);
  }, 'int');
  def('float', (args, kw) => {
    noKw('float', kw);
    argc('float', args, 0, 1);
    if (args.length === 0) return new PyFloat(0);
    const v = args[0];
    if (isNumber(v)) return v instanceof PyFloat ? v : new PyFloat(numVal(v));
    if (typeof v === 'string') return new PyFloat(parseFloatStr(v));
    return err('TypeError', `float() cannot turn ${art(tname(v))} into a float.`);
  }, 'float');
  def('str', (args, kw) => {
    noKw('str', kw);
    argc('str', args, 0, 1);
    return args.length ? str(args[0]) : '';
  }, 'str');
  def('bool', (args, kw) => {
    noKw('bool', kw);
    argc('bool', args, 0, 1);
    return args.length ? truthy(args[0]) : false;
  }, 'bool');
  def('list', (args, kw) => {
    noKw('list', kw);
    argc('list', args, 0, 1);
    if (!args.length) return [];
    const items = asArray(args[0]);
    rt.alloc(items.length);
    rt.ops += items.length;
    return items.slice();
  }, 'list');
  def('tuple', (args, kw) => {
    noKw('tuple', kw);
    argc('tuple', args, 0, 1);
    if (!args.length) return new PyTuple([]);
    if (args[0] instanceof PyTuple) return args[0];
    const items = asArray(args[0]);
    rt.alloc(items.length);
    rt.ops += items.length;
    return new PyTuple(items.slice());
  }, 'tuple');
  def('set', (args, kw) => {
    noKw('set', kw);
    argc('set', args, 0, 1);
    const s = new PySet();
    if (args.length) {
      const items = asArray(args[0]);
      rt.ops += items.length;
      for (let i = 0; i < items.length; i++) setAdd(s, items[i]);
      rt.alloc(s.m.size);
    }
    return s;
  }, 'set');
  def('dict', (args, kw) => {
    argc('dict', args, 0, 1);
    const d = new PyDict();
    if (args.length) {
      const src = args[0];
      if (src instanceof PyDict) {
        const ks = dictKeys(src);
        let i = 0;
        for (const v of src.m.values()) dictSet(d, ks[i++], v);
      } else {
        for (const p of asArray(src)) {
          const pair = asArray(p);
          if (pair.length !== 2) err('ValueError', 'dict() needs pairs of (key, value).');
          dictSet(d, pair[0], pair[1]);
        }
      }
    }
    if (kw) for (const [k, v] of kw) dictSet(d, k, v);
    rt.alloc(d.m.size);
    rt.ops += d.m.size;
    return d;
  }, 'dict');
  return B;
}

