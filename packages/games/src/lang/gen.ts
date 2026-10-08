// The stepping evaluator: a generator-based walker used only by step(). Statements and the parts of
// expressions that contain calls run here (so line and call events can be yielded); everything else
// reuses the fast closures.
import type { Node, StepEvent } from './types.ts';
import {
  Frame, PyBound, PyBuiltin, PyClass, PyDict, PyExc, PyExcClass, PyFunc, PyIter, PyInstance, PyModule, PyRange,
  PySet, PyTuple, SnekThrow,
  asArray, dictSet, err, setAdd, str, truthy,
} from './values.ts';
import { mkPos } from './runtime.ts';
import { Slice, binop, getItem, getSlice, invert, negate, unaryPlus } from './ops.ts';
import { excFromCall, formatValue } from './builtins.ts';
import { toJS } from './convert.ts';
import type { Ev, Ex, Interp } from './fast.ts';

type G<T> = Generator<StepEvent, T, undefined>;

function hasCall(n: any): boolean {
  if (n === null || typeof n !== 'object') return false;
  if (n._hc !== undefined) return n._hc;
  let r = false;
  switch (n.k) {
    case 'call': r = true; break;
    case 'num': case 'float': case 'str': case 'const': case 'name': case 'lambda': r = false; break;
    case 'fstr':
      r = n.parts.some((p: any) => typeof p !== 'string' && (hasCall(p.e) || (p.spec && p.spec.some((s: any) => typeof s !== 'string' && hasCall(s.e)))));
      break;
    case 'list': case 'tuple': case 'set': r = n.elts.some(hasCall); break;
    case 'dict': r = n.keys.some(hasCall) || n.values.some(hasCall); break;
    case 'binop': case 'bool': r = hasCall(n.l) || hasCall(n.r); break;
    case 'unary': case 'not': case 'star': case 'attr': r = hasCall(n.e); break;
    case 'cmp': r = hasCall(n.first) || n.rest.some(hasCall); break;
    case 'ifexp': r = hasCall(n.c) || hasCall(n.a) || hasCall(n.b); break;
    case 'sub': r = hasCall(n.e) || hasCall(n.idx); break;
    case 'slice': r = hasCall(n.lo) || hasCall(n.hi) || hasCall(n.step); break;
    case 'comp':
      r = hasCall(n.elt) || hasCall(n.val) || n.gens.some((g: any) => hasCall(g.iter) || g.ifs.some(hasCall));
      break;
    default: r = false;
  }
  n._hc = r;
  return r;
}

const SKIP = (v: any) => v instanceof PyFunc || v instanceof PyBound || v instanceof PyBuiltin || v instanceof PyClass || v instanceof PyModule || v instanceof PyExcClass;

export class Stepper {
  I: Interp;
  fast: Map<Node, Ev> = new Map();
  fastStmt: Map<Node, Ex> = new Map();
  stores: Map<Node, (f: Frame, v: any) => void> = new Map();

  constructor(I: Interp) {
    this.I = I;
  }

  fe(n: Node): Ev {
    let e = this.fast.get(n);
    if (!e) { e = this.I.expr(n); this.fast.set(n, e); }
    return e;
  }
  fs(n: Node): Ex {
    let e = this.fastStmt.get(n);
    if (!e) { e = this.I.stmt(n); this.fastStmt.set(n, e); }
    return e;
  }
  st(n: Node): (f: Frame, v: any) => void {
    let e = this.stores.get(n);
    if (!e) { e = this.I.store(n); this.stores.set(n, e); }
    return e;
  }

  snapshot(f: Frame): Record<string, unknown> {
    const sc = f.s;
    const out: Record<string, unknown> = {};
    const names: (string | null)[] = sc.slotNames;
    for (let i = 0; i < names.length; i++) {
      const nm = names[i];
      if (nm === null) continue;
      const v = f.v[i];
      if (v === undefined || SKIP(v)) continue;
      Object.defineProperty(out, nm, { value: toJS(v), enumerable: true, writable: true, configurable: true });
    }
    return out;
  }

  // A line event, or null when this frame's last event was for the same line (CPython only reports
  // a new line, or a jump back to a loop header, which `again` forces).
  lineEv(n: Node, f: Frame, again = false): StepEvent | null {
    if (!again && f.ll === n.line) return null;
    f.ll = n.line;
    return { kind: 'line', line: n.line, vars: this.snapshot(f) };
  }

  tick(P: number): void {
    const rt = this.I.rt;
    rt.pos = P;
    if (++rt.ops > rt.maxOps) rt.opsFatal();
  }

  // ---- statements ----
  *runModule(stmts: Node[], f: Frame): G<number> {
    const rt = this.I.rt;
    for (let i = 0; i < stmts.length; i++) {
      const s = stmts[i];
      if (i === stmts.length - 1 && s.k === 'expr') {
        { const ev = this.lineEv(s, f); if (ev) yield ev; }
        this.tick(mkPos(s.line, s.col));
        rt.lastValue = yield* this.ev(s.e, f);
        return 0;
      }
      const c = yield* this.stmt(s, f);
      if (c !== 0) return c;
    }
    return 0;
  }

  *block(stmts: Node[], f: Frame): G<number> {
    for (let i = 0; i < stmts.length; i++) {
      const c = yield* this.stmt(stmts[i], f);
      if (c !== 0) return c;
    }
    return 0;
  }

  *stmt(n: Node, f: Frame): G<number> {
    const rt = this.I.rt;
    const P = mkPos(n.line, n.col);
    switch (n.k) {
      case 'if': {
        { const ev = this.lineEv(n, f); if (ev) yield ev; }
        this.tick(P);
        const t = hasCall(n.test) ? yield* this.ev(n.test, f) : this.fe(n.test)(f);
        if (truthy(t)) return yield* this.block(n.body, f);
        return yield* this.block(n.orelse, f);
      }
      case 'while': {
        for (let first = true; ; first = false) {
          { const ev = this.lineEv(n, f, !first); if (ev) yield ev; }
          this.tick(P);
          const t = hasCall(n.test) ? yield* this.ev(n.test, f) : this.fe(n.test)(f);
          if (!truthy(t)) break;
          const c = yield* this.block(n.body, f);
          if (c === 1) return 0;
          if (c === 3) return 3;
        }
        return n.orelse.length ? yield* this.block(n.orelse, f) : 0;
      }
      case 'for': return yield* this.forStmt(n, f, P);
      case 'try': return yield* this.tryStmt(n, f, P);
      case 'expr': {
        { const ev = this.lineEv(n, f); if (ev) yield ev; }
        if (!hasCall(n.e)) return this.fs(n)(f);
        this.tick(P);
        yield* this.ev(n.e, f);
        return 0;
      }
      case 'assign': {
        { const ev = this.lineEv(n, f); if (ev) yield ev; }
        if (!hasCall(n.value)) return this.fs(n)(f);
        this.tick(P);
        const v = yield* this.ev(n.value, f);
        for (const t of n.targets) this.st(t)(f, v);
        return 0;
      }
      case 'aug': {
        { const ev = this.lineEv(n, f); if (ev) yield ev; }
        if (!hasCall(n.value)) return this.fs(n)(f);
        this.tick(P);
        const t: Node = n.target;
        if (t.k === 'name') {
          const cur = f.v[t.s];
          if (cur === undefined) err('NameError', `The variable '${t.id}' is used before it has been given a value.`);
          rt.ops++;
          const r = yield* this.ev(n.value, f);
          f.v[t.s] = this.I.augBin(n.op, cur, r);
        } else if (t.k === 'sub' && t.idx.k !== 'slice') {
          const obj = this.fe(t.e)(f);
          const idx = this.fe(t.idx)(f);
          const cur = getItem(rt, obj, idx);
          rt.ops++;
          const r = yield* this.ev(n.value, f);
          this.st(t)(f, this.I.augBin(n.op, cur, r));
          void obj;
        } else {
          const obj = this.fe(t.e)(f);
          const cur = this.I.getAttr(obj, t.name);
          rt.ops++;
          const r = yield* this.ev(n.value, f);
          this.I.setAttr(obj, t.name, this.I.augBin(n.op, cur, r));
        }
        return 0;
      }
      case 'return': {
        { const ev = this.lineEv(n, f); if (ev) yield ev; }
        if (!n.value || !hasCall(n.value)) return this.fs(n)(f);
        this.tick(P);
        f.ret = yield* this.ev(n.value, f);
        return 3;
      }
      case 'assert': {
        { const ev = this.lineEv(n, f); if (ev) yield ev; }
        if (!hasCall(n.test) && !(n.msg && hasCall(n.msg))) return this.fs(n)(f);
        this.tick(P);
        const t = yield* this.ev(n.test, f);
        if (!truthy(t)) {
          const m = n.msg ? str(yield* this.ev(n.msg, f)) : '';
          const e = new PyExc('AssertionError', m, n.msg ? [m] : []);
          e.user = true;
          e.pos = P;
          throw new SnekThrow(e);
        }
        return 0;
      }
      case 'raise': {
        { const ev = this.lineEv(n, f); if (ev) yield ev; }
        if (!n.exc || !hasCall(n.exc)) return this.fs(n)(f);
        this.tick(P);
        let v = yield* this.ev(n.exc, f);
        if (v instanceof PyExcClass) v = excFromCall(v.kind, []);
        if (!(v instanceof PyExc)) err('TypeError', 'You can only raise an exception such as ValueError("message").');
        v.pos = P;
        throw new SnekThrow(v);
      }
      case 'class': {
        { const ev = this.lineEv(n, f); if (ev) yield ev; }
        this.tick(P);
        const sc = n.sc;
        const cf = new Frame(sc.nslots, f, sc);
        { const ev = this.lineEv(n, cf); if (ev) yield ev; } // CPython reports the class line again inside the body
        yield* this.block(n.body, cf);
        f.v[n.slot] = this.I.makeClass(n.name, sc, cf);
        return 0;
      }
      default:
        // pass, break, continue, def, del, import, from
        { const ev = this.lineEv(n, f); if (ev) yield ev; }
        return this.fs(n)(f);
    }
  }

  *forStmt(n: Node, f: Frame, P: number): G<number> {
    const rt = this.I.rt;
    { const ev = this.lineEv(n, f); if (ev) yield ev; }
    this.tick(P);
    const itv = hasCall(n.iter) ? yield* this.ev(n.iter, f) : this.fe(n.iter)(f);
    const store = this.st(n.target);
    let arr: any[];
    let range: PyRange | null = null;
    if (Array.isArray(itv)) arr = itv;
    else if (itv instanceof PyRange) { range = itv; arr = []; } else arr = asArray(itv);
    let k = 0;
    for (;;) {
      if (k > 0) yield this.lineEv(n, f, true)!;
      const len = range ? range.len : arr.length;
      if (k >= len) break;
      rt.pos = P;
      if (++rt.ops > rt.maxOps) rt.opsFatal();
      store(f, range ? range.start + k * range.step : arr[k]);
      k++;
      const c = yield* this.block(n.body, f);
      if (c === 1) return 0;
      if (c === 3) return 3;
    }
    return n.orelse.length ? yield* this.block(n.orelse, f) : 0;
  }

  *tryStmt(n: Node, f: Frame, P: number): G<number> {
    const rt = this.I.rt;
    { const ev = this.lineEv(n, f); if (ev) yield ev; }
    this.tick(P);
    let code = 0;
    let pending: any = null;
    let hasPending = false;
    const depth = rt.depth;
    const tl = rt.temps.length;
    try {
      let ok = false;
      try {
        code = yield* this.block(n.body, f);
        ok = true;
      } catch (e) {
        if (!(e instanceof SnekThrow) || n.handlers.length === 0) throw e;
        rt.depth = depth;
        rt.temps.length = tl;
        if (!e.exc.pos) e.exc.pos = rt.pos;
        let handled = false;
        for (const h of n.handlers) {
          { const ev = this.lineEv(h, f, true); if (ev) yield ev; }
          const types = h.types ? yield* this.ev(h.types, f) : null;
          if (types === null || this.I.matchHandler(types, e.exc)) {
            handled = true;
            if (h.name) f.v[h.slot] = e.exc;
            const prev = rt.curExc;
            rt.curExc = e.exc;
            try {
              code = yield* this.block(h.body, f);
            } finally {
              rt.curExc = prev;
            }
            break;
          }
        }
        if (!handled) throw e;
      }
      if (ok && code === 0 && n.orelse.length) code = yield* this.block(n.orelse, f);
    } catch (e2) {
      if (!n.final.length) throw e2;
      pending = e2;
      hasPending = true;
    }
    if (n.final.length) {
      const fc = yield* this.block(n.final, f);
      if (fc !== 0) return fc;
      if (hasPending) throw pending;
    }
    return code;
  }

  // ---- calls ----
  *callUserG(fn: PyFunc, args: any[], kw: Map<string, any> | null): G<any> {
    const I = this.I;
    const rt = I.rt;
    const node = fn.node;
    const sc = node.sc;
    if (rt.depth >= rt.maxDepth) {
      rt.fatal('TooDeep', `Your function called itself too many times (more than ${rt.maxDepth} levels deep): check that it has a case that stops.`);
    }
    const fr = new Frame(sc.nslots, fn.parent, sc);
    I.bindArgs(fn, fr, args, kw);
    rt.depth++;
    rt.frames[rt.depth] = fr;
    const savedPos = rt.pos;
    if (node.k === 'lambda') {
      { const ev = this.lineEv(node, fr); if (ev) yield ev; }
      fr.ret = yield* this.ev(node.body, fr);
    } else {
      const code = yield* this.block(node.body, fr);
      if (code !== 3) fr.ret = null;
    }
    rt.depth--;
    rt.pos = savedPos;
    return fr.ret;
  }

  *callValueG(fn: any, args: any[], kw: Map<string, any> | null, line: number): G<any> {
    const I = this.I;
    if (fn instanceof PyFunc) return yield* this.callUserG(fn, args, kw);
    if (fn instanceof PyBuiltin) {
      if (fn.host) yield { kind: 'call', line, name: fn.name, args: args.map((x) => toJS(x)) };
      return fn.fn(args, kw);
    }
    if (fn instanceof PyBound) return yield* this.callUserG(fn.fn, [fn.self, ...args], kw);
    if (fn instanceof PyClass) {
      const inst = new PyInstance(fn);
      I.rt.alloc(1);
      const init = fn.ns.get('__init__');
      if (init instanceof PyFunc) {
        const r = yield* this.callUserG(init, [inst, ...args], kw);
        if (r !== null) err('TypeError', '__init__() must not return a value.');
      } else if (args.length > 0 || (kw && kw.size > 0)) {
        err('TypeError', `The class ${fn.name}() takes no arguments because it has no __init__ method.`);
      }
      return inst;
    }
    return I.callValue(fn, args, kw);
  }

  *evArgs(n: Node, f: Frame): G<any[]> {
    const out: any[] = [];
    for (const a of n.args) {
      if (a.k === 'star') {
        const v = yield* this.ev(a.e, f);
        for (const x of asArray(v)) out.push(x);
      } else out.push(yield* this.ev(a, f));
    }
    return out;
  }

  *evKw(n: Node, f: Frame): G<Map<string, any> | null> {
    if (!n.kws.length) return null;
    const m = new Map<string, any>();
    for (const k of n.kws) m.set(k.name, yield* this.ev(k.v, f));
    return m;
  }

  *callG(n: Node, f: Frame): G<any> {
    const rt = this.I.rt;
    rt.ops++;
    const fnode: Node = n.f;
    if (fnode.k === 'attr') {
      rt.ops++;
      const o = yield* this.ev(fnode.e, f);
      const args = yield* this.evArgs(n, f);
      const kw = yield* this.evKw(n, f);
      if (o instanceof PyInstance) {
        const v = o.attrs.get(fnode.name);
        if (v !== undefined) return yield* this.callValueG(v, args, kw, n.line);
        const cv = o.cls.ns.get(fnode.name);
        if (cv instanceof PyFunc) return yield* this.callUserG(cv, [o, ...args], kw);
      }
      return this.I.callMethod(o, fnode.name, args, kw);
    }
    const fn = yield* this.ev(fnode, f);
    const args = yield* this.evArgs(n, f);
    const kw = yield* this.evKw(n, f);
    return yield* this.callValueG(fn, args, kw, n.line);
  }

  *fparts(parts: any[], f: Frame): G<string> {
    let out = '';
    for (const p of parts) {
      if (typeof p === 'string') { out += p; continue; }
      const v = yield* this.ev(p.e, f);
      if (!p.spec && p.conv === null) out += str(v);
      else out += formatValue(v, p.spec ? yield* this.fparts(p.spec, f) : '', p.conv);
    }
    return out;
  }

  // ---- expressions containing calls ----
  *ev(n: Node, f: Frame): G<any> {
    if (!hasCall(n)) return this.fe(n)(f);
    const rt = this.I.rt;
    switch (n.k) {
      case 'call': return yield* this.callG(n, f);
      case 'binop': {
        rt.ops++;
        const a = yield* this.ev(n.l, f);
        const b = yield* this.ev(n.r, f);
        return binop(rt, n.op, a, b);
      }
      case 'unary': {
        rt.ops++;
        const v = yield* this.ev(n.e, f);
        return n.op === '-' ? negate(v) : n.op === '+' ? unaryPlus(v) : invert(v);
      }
      case 'not': rt.ops++; return !truthy(yield* this.ev(n.e, f));
      case 'bool': {
        rt.ops++;
        const a = yield* this.ev(n.l, f);
        if (n.op === 'and') return truthy(a) ? yield* this.ev(n.r, f) : a;
        return truthy(a) ? a : yield* this.ev(n.r, f);
      }
      case 'cmp': {
        rt.ops++;
        let a = yield* this.ev(n.first, f);
        for (let i = 0; i < n.ops.length; i++) {
          const b = yield* this.ev(n.rest[i], f);
          if (!this.I.cmpOne(n.ops[i], a, b)) return false;
          a = b;
        }
        return true;
      }
      case 'ifexp': {
        rt.ops++;
        return truthy(yield* this.ev(n.c, f)) ? yield* this.ev(n.a, f) : yield* this.ev(n.b, f);
      }
      case 'attr': {
        rt.ops++;
        const o = yield* this.ev(n.e, f);
        return this.I.getAttr(o, n.name);
      }
      case 'sub': {
        rt.ops++;
        const o = yield* this.ev(n.e, f);
        if (n.idx.k === 'slice') {
          const lo = n.idx.lo ? yield* this.ev(n.idx.lo, f) : null;
          const hi = n.idx.hi ? yield* this.ev(n.idx.hi, f) : null;
          const st = n.idx.step ? yield* this.ev(n.idx.step, f) : null;
          return getSlice(rt, o, new Slice(lo, hi, st));
        }
        const i = yield* this.ev(n.idx, f);
        return getItem(rt, o, i);
      }
      case 'list': case 'tuple': {
        rt.ops++;
        const a: any[] = [];
        for (const e of n.elts) a.push(yield* this.ev(e, f));
        rt.alloc(a.length);
        return n.k === 'list' ? a : new PyTuple(a);
      }
      case 'set': {
        rt.ops++;
        const s = new PySet();
        for (const e of n.elts) setAdd(s, yield* this.ev(e, f));
        rt.alloc(s.m.size);
        return s;
      }
      case 'dict': {
        rt.ops++;
        const d = new PyDict();
        for (let i = 0; i < n.keys.length; i++) {
          const k = yield* this.ev(n.keys[i], f);
          dictSet(d, k, yield* this.ev(n.values[i], f));
        }
        rt.alloc(d.m.size);
        return d;
      }
      case 'fstr': {
        rt.ops++;
        const s = yield* this.fparts(n.parts, f);
        if (s.length >= 32) rt.alloc(s.length);
        return s;
      }
      case 'comp': return yield* this.compG(n, f);
      default:
        return this.fe(n)(f);
    }
  }

  *compG(n: Node, f: Frame): G<any> {
    const rt = this.I.rt;
    rt.ops++;
    const kind: string = n.kind;
    const acc: any = kind === 'dict' ? new PyDict() : kind === 'set' ? new PySet() : [];
    const tl = rt.temps.length;
    rt.temps.push(acc);
    const last = n.gens.length - 1;
    const self = this;
    function* run(i: number): G<void> {
      const g = n.gens[i];
      const itv = yield* self.ev(g.iter, f);
      const store = self.st(g.target);
      const arr = asArray(itv).slice();
      outer: for (let k = 0; k < arr.length; k++) {
        store(f, arr[k]);
        if (++rt.ops > rt.maxOps) rt.opsFatal();
        for (const c of g.ifs) if (!truthy(yield* self.ev(c, f))) continue outer;
        if (i < last) { yield* run(i + 1); continue; }
        if (kind === 'dict') {
          const key = yield* self.ev(n.elt, f);
          if (dictSet(acc, key, yield* self.ev(n.val, f))) rt.alloc(1);
        } else if (kind === 'set') {
          if (setAdd(acc, yield* self.ev(n.elt, f))) rt.alloc(1);
        } else {
          const v = yield* self.ev(n.elt, f);
          rt.alloc(1);
          acc.push(v);
        }
      }
    }
    yield* run(0);
    rt.temps.length = tl;
    return kind === 'gen' ? new PyIter(acc, 'generator') : acc;
  }
}

