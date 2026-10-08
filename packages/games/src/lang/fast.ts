// The fast evaluator: compiles the AST into JS closures. Used by run() and callFunction().
import type { Node } from './types.ts';
import {
  Frame, MAX_INT, PyBound, PyBuiltin, PyClass, PyDeque, PyDict, PyExc, PyExcClass, PyFloat, PyFunc, PyInstance, PyIter,
  PyModule, PyRange, PySet, PyTuple, SnekThrow,
  asArray, compareOp, contains, dictSet, eq, err, setAdd, str, tname, truthy,
} from './values.ts';
import type { Rt } from './runtime.ts';
import { mkPos } from './runtime.ts';
import {
  Slice, binop, delItem, getItem, getSlice, invert, negate, overflow, setItem, setSlice, unaryPlus, unpackArray,
} from './ops.ts';
import { excFromCall, formatValue, getModule, makeBuiltins, methodTable, noAttr, typeMethod } from './builtins.ts';
import type { Ctx } from './builtins.ts';

export type Ev = (f: Frame) => any;
export type Ex = (f: Frame) => number; // 0 normal, 1 break, 2 continue, 3 return

interface FuncInfo {
  np: number;
  star: number;
  names: string[];
  index: Map<string, number>;
  defIdx: number[];
}

function plural(n: number, w: string): string {
  return `${n} ${w}${n === 1 ? '' : 's'}`;
}

export function funcInfo(node: Node): FuncInfo {
  let info = node.info as FuncInfo | undefined;
  if (info) return info;
  const params: any[] = node.params;
  const index = new Map<string, number>();
  const defIdx: number[] = [];
  let star = -1;
  let d = 0;
  params.forEach((p, i) => {
    index.set(p.name, i);
    if (p.star) star = i;
    defIdx.push(p.def ? d++ : -1);
  });
  info = { np: params.length, star, names: params.map((p) => p.name), index, defIdx };
  node.info = info;
  return info;
}

export class Interp {
  rt: Rt;
  c: Ctx;
  B: Map<string, any>;
  hostIndex: Map<string, number> = new Map();
  hostVals: any[] = [];
  mods: Map<string, PyModule> = new Map();
  key = '';

  constructor(rt: Rt, hostNames: string[]) {
    this.rt = rt;
    this.c = { rt, call: (f, args, kw) => this.callValue(f, args, kw) };
    this.B = makeBuiltins(this.c);
    hostNames.forEach((n, i) => this.hostIndex.set(n, i));
    this.hostVals = new Array(hostNames.length).fill(null);
  }

  // ---- calls ----
  callValue(fn: any, args: any[], kw: Map<string, any> | null): any {
    if (fn instanceof PyFunc) return this.callUser(fn, args, kw);
    if (fn instanceof PyBuiltin) return fn.fn(args, kw);
    if (fn instanceof PyBound) {
      const a = new Array(args.length + 1);
      a[0] = fn.self;
      for (let i = 0; i < args.length; i++) a[i + 1] = args[i];
      return this.callUser(fn.fn, a, kw);
    }
    if (fn instanceof PyClass) return this.instantiate(fn, args, kw);
    if (fn instanceof PyExcClass) return excFromCall(fn.kind, args);
    return err('TypeError', `You cannot call ${/^[aeiou]/.test(tname(fn)) ? 'an' : 'a'} ${tname(fn)}: only functions can be called.`);
  }

  instantiate(cls: PyClass, args: any[], kw: Map<string, any> | null): any {
    const inst = new PyInstance(cls);
    this.rt.alloc(1);
    const init = cls.ns.get('__init__');
    if (init instanceof PyFunc) {
      const a = new Array(args.length + 1);
      a[0] = inst;
      for (let i = 0; i < args.length; i++) a[i + 1] = args[i];
      const r = this.callUser(init, a, kw);
      if (r !== null) err('TypeError', '__init__() must not return a value.');
    } else if (args.length > 0 || (kw && kw.size > 0)) {
      err('TypeError', `The class ${cls.name}() takes no arguments because it has no __init__ method.`);
    }
    return inst;
  }

  bindArgs(fn: PyFunc, fr: Frame, args: any[], kw: Map<string, any> | null): void {
    const info = funcInfo(fn.node);
    const v = fr.v;
    const np = info.np;
    const nargs = args.length;
    if (info.star < 0 && kw === null) {
      if (nargs > np) {
        err('TypeError', `The function ${fn.name}() takes ${plural(np, 'argument')} but ${nargs} ${nargs === 1 ? 'was' : 'were'} given.`);
      }
      for (let i = 0; i < nargs; i++) v[i] = args[i];
      for (let i = nargs; i < np; i++) {
        const d = info.defIdx[i];
        if (d < 0) this.missing(fn, info, v, nargs);
        v[i] = fn.defaults[d];
      }
      return;
    }
    const nPos = info.star >= 0 ? info.star : np;
    const n = Math.min(nargs, nPos);
    for (let i = 0; i < n; i++) v[i] = args[i];
    if (info.star >= 0) v[info.star] = new PyTuple(args.slice(nPos));
    else if (nargs > np) {
      err('TypeError', `The function ${fn.name}() takes ${plural(np, 'argument')} but ${nargs} ${nargs === 1 ? 'was' : 'were'} given.`);
    }
    if (kw) {
      for (const [k, val] of kw) {
        const idx = info.index.get(k);
        if (idx === undefined || idx === info.star) err('TypeError', `The function ${fn.name}() has no argument named '${k}'.`);
        if (v[idx!] !== undefined) err('TypeError', `The function ${fn.name}() got the argument '${k}' twice.`);
        v[idx!] = val;
      }
    }
    for (let i = 0; i < np; i++) {
      if (v[i] === undefined) {
        const d = info.defIdx[i];
        if (d < 0) this.missing(fn, info, v, nargs);
        v[i] = fn.defaults[d];
      }
    }
  }

  missing(fn: PyFunc, info: FuncInfo, v: any[], nargs: number): never {
    const miss: string[] = [];
    for (let i = 0; i < info.np; i++) {
      if (i >= nargs && v[i] === undefined && info.defIdx[i] < 0 && i !== info.star) miss.push(`'${info.names[i]}'`);
    }
    return err('TypeError', `The function ${fn.name}() needs ${plural(miss.length, 'more argument')} (${miss.join(', ')}), but ${miss.length === 1 ? 'it was' : 'they were'} not given.`);
  }

  callUser(fn: PyFunc, args: any[], kw: Map<string, any> | null): any {
    const rt = this.rt;
    const node = fn.node;
    const sc = node.sc;
    if (rt.depth >= rt.maxDepth) {
      rt.fatal('TooDeep', `Your function called itself too many times (more than ${rt.maxDepth} levels deep): check that it has a case that stops.`);
    }
    const fr = new Frame(sc.nslots, fn.parent, sc);
    this.bindArgs(fn, fr, args, kw);
    rt.depth++;
    rt.frames[rt.depth] = fr;
    const savedPos = rt.pos;
    const body = fn.body ?? (fn.body = this.bodyFor(node));
    const code = body(fr);
    rt.depth--;
    rt.pos = savedPos;
    return code === 3 ? fr.ret : null;
  }

  bodyFor(node: Node): Ex {
    if (node.k === 'lambda') {
      const e = this.expr(node.body);
      return (f) => { f.ret = e(f); return 3; };
    }
    return this.block(node.body);
  }

  // ---- attributes ----
  getAttr(o: any, name: string): any {
    if (o instanceof PyInstance) {
      const v = o.attrs.get(name);
      if (v !== undefined) return v;
      const cv = o.cls.ns.get(name);
      if (cv !== undefined) return cv instanceof PyFunc ? new PyBound(o, cv) : cv;
      return noAttr(o, name);
    }
    if (o instanceof PyModule) {
      const v = o.attrs.get(name);
      return v !== undefined ? v : noAttr(o, name);
    }
    if (o instanceof PyClass) {
      const v = o.ns.get(name);
      return v !== undefined ? v : noAttr(o, name);
    }
    if (o instanceof PyExc && name === 'args') return new PyTuple(o.args.slice());
    if (o instanceof PyBuiltin && o.ty) {
      const m = typeMethod(this.c, o.ty, name);
      if (m) return m;
    }
    const tbl = methodTable(o);
    if (tbl !== null) {
      const m = tbl[name];
      if (m !== undefined) {
        const c = this.c;
        return new PyBuiltin(name, (args, kw) => m(c, o, args, kw));
      }
    }
    return noAttr(o, name);
  }

  setAttr(o: any, name: string, v: any): void {
    if (o instanceof PyInstance) {
      if (!o.attrs.has(name)) this.rt.alloc(1);
      o.attrs.set(name, v);
      return;
    }
    if (o instanceof PyClass) {
      if (!o.ns.has(name)) this.rt.alloc(1);
      o.ns.set(name, v);
      return;
    }
    err('AttributeError', `You cannot set the attribute '${name}' on ${/^[aeiou]/.test(tname(o)) ? 'an' : 'a'} ${tname(o)}.`);
  }

  callMethod(o: any, name: string, args: any[], kw: Map<string, any> | null): any {
    const tbl = methodTable(o);
    if (tbl !== null) {
      const m = tbl[name];
      if (m === undefined) return noAttr(o, name);
      return m(this.c, o, args, kw);
    }
    if (o instanceof PyInstance) {
      const v = o.attrs.get(name);
      if (v !== undefined) return this.callValue(v, args, kw);
      const cv = o.cls.ns.get(name);
      if (cv === undefined) return noAttr(o, name);
      if (cv instanceof PyFunc) {
        const a = new Array(args.length + 1);
        a[0] = o;
        for (let i = 0; i < args.length; i++) a[i + 1] = args[i];
        return this.callUser(cv, a, kw);
      }
      return this.callValue(cv, args, kw);
    }
    return this.callValue(this.getAttr(o, name), args, kw);
  }

  getModule(name: string): PyModule {
    let m = this.mods.get(name);
    if (!m) {
      m = getModule(this.c, name);
      this.mods.set(name, m);
    }
    return m;
  }

  // ---- expressions ----
  nameLoad(n: Node): Ev {
    const rt = this.rt;
    const id: string = n.id;
    const h: number = n.h;
    const s: number = n.s;
    if (h === 0) {
      return (f) => {
        rt.ops++;
        const v = f.v[s];
        if (v === undefined) unbound(id);
        return v;
      };
    }
    if (h === 1) {
      return (f) => {
        rt.ops++;
        const v = f.p!.v[s];
        if (v === undefined) unbound(id);
        return v;
      };
    }
    if (h > 1) {
      return (f) => {
        rt.ops++;
        let g: Frame = f;
        for (let i = 0; i < h; i++) g = g.p!;
        const v = g.v[s];
        if (v === undefined) unbound(id);
        return v;
      };
    }
    const hi = this.hostIndex.get(id);
    if (hi !== undefined) {
      const hv = this.hostVals;
      return () => { rt.ops++; return hv[hi]; };
    }
    const b = this.B.get(id);
    if (b !== undefined) return () => { rt.ops++; return b; };
    return () => {
      rt.ops++;
      return err('NameError', `The name '${id}' is not defined: check the spelling, or give it a value first.`);
    };
  }

  expr(n: Node): Ev {
    const rt = this.rt;
    switch (n.k) {
      case 'num': { const v = n.v; return () => { rt.ops++; return v; }; }
      case 'float': { const v = new PyFloat(n.v); return () => { rt.ops++; return v; }; }
      case 'str': { const v = n.v; return () => { rt.ops++; return v; }; }
      case 'const': { const v = n.v; return () => { rt.ops++; return v; }; }
      case 'name': return this.nameLoad(n);
      case 'fstr': return this.fstr(n);
      case 'list': {
        const evs = n.elts.map((e: Node) => this.expr(e));
        const len = evs.length;
        return (f) => {
          rt.ops++;
          const a = new Array(len);
          for (let i = 0; i < len; i++) a[i] = evs[i](f);
          rt.alloc(len);
          return a;
        };
      }
      case 'tuple': {
        const evs = n.elts.map((e: Node) => this.expr(e));
        const len = evs.length;
        return (f) => {
          rt.ops++;
          const a = new Array(len);
          for (let i = 0; i < len; i++) a[i] = evs[i](f);
          rt.alloc(len);
          return new PyTuple(a);
        };
      }
      case 'set': {
        const evs = n.elts.map((e: Node) => this.expr(e));
        return (f) => {
          rt.ops++;
          const s = new PySet();
          for (let i = 0; i < evs.length; i++) setAdd(s, evs[i](f));
          rt.alloc(s.m.size);
          return s;
        };
      }
      case 'dict': {
        const ks = n.keys.map((e: Node) => this.expr(e));
        const vs = n.values.map((e: Node) => this.expr(e));
        return (f) => {
          rt.ops++;
          const d = new PyDict();
          for (let i = 0; i < ks.length; i++) {
            const k = ks[i](f);
            dictSet(d, k, vs[i](f));
          }
          rt.alloc(d.m.size);
          return d;
        };
      }
      case 'binop': return this.binopExpr(n);
      case 'unary': {
        const e = this.expr(n.e);
        switch (n.op) {
          case '-': return (f) => { rt.ops++; const v = e(f); return typeof v === 'number' ? (v === 0 ? 0 : -v) : negate(v); };
          case '+': return (f) => { rt.ops++; return unaryPlus(e(f)); };
          default: return (f) => { rt.ops++; return invert(e(f)); };
        }
      }
      case 'not': { const e = this.expr(n.e); return (f) => { rt.ops++; return !truthy(e(f)); }; }
      case 'bool': {
        const l = this.expr(n.l);
        const r = this.expr(n.r);
        if (n.op === 'and') return (f) => { rt.ops++; const a = l(f); return truthy(a) ? r(f) : a; };
        return (f) => { rt.ops++; const a = l(f); return truthy(a) ? a : r(f); };
      }
      case 'cmp': return this.cmpExpr(n);
      case 'ifexp': {
        const c = this.expr(n.c);
        const a = this.expr(n.a);
        const b = this.expr(n.b);
        return (f) => { rt.ops++; return truthy(c(f)) ? a(f) : b(f); };
      }
      case 'call': return this.callExpr(n);
      case 'attr': {
        const o = this.expr(n.e);
        const name: string = n.name;
        return (f) => { rt.ops++; return this.getAttr(o(f), name); };
      }
      case 'sub': {
        const o = this.expr(n.e);
        if (n.idx.k === 'slice') {
          const sl = this.sliceExpr(n.idx);
          return (f) => { rt.ops++; const obj = o(f); return getSlice(rt, obj, sl(f)); };
        }
        const i = this.expr(n.idx);
        return (f) => {
          rt.ops++;
          const obj = o(f);
          const idx = i(f);
          if (typeof idx === 'number' && Array.isArray(obj)) {
            const len = obj.length;
            if (idx >= 0 && idx < len) return obj[idx];
            if (idx < 0 && idx >= -len) return obj[len + idx];
          }
          return getItem(rt, obj, idx);
        };
      }
      case 'slice': {
        const sl = this.sliceExpr(n);
        return (f) => sl(f);
      }
      case 'lambda': {
        const defs = n.params.filter((p: any) => p.def).map((p: any) => this.expr(p.def));
        return (f) => {
          rt.ops++;
          return new PyFunc('<lambda>', n, f, defs.map((d: Ev) => d(f)));
        };
      }
      case 'comp': return this.compExpr(n);
      case 'star': return err('SyntaxError', 'A starred expression is only allowed in a call.');
      default:
        throw new Error('fast: unknown expression ' + n.k);
    }
  }

  sliceExpr(n: Node): (f: Frame) => Slice {
    const lo = n.lo ? this.expr(n.lo) : null;
    const hi = n.hi ? this.expr(n.hi) : null;
    const st = n.step ? this.expr(n.step) : null;
    return (f) => new Slice(lo ? lo(f) : null, hi ? hi(f) : null, st ? st(f) : null);
  }

  fstr(n: Node): Ev {
    const rt = this.rt;
    const mk = (parts: any[]): ((f: Frame) => string) => {
      const items = parts.map((p) => {
        if (typeof p === 'string') return p;
        const e = this.expr(p.e);
        const spec = p.spec && p.spec.length ? mk(p.spec) : null;
        const conv: string | null = p.conv;
        return { e, spec, conv };
      });
      return (f) => {
        let out = '';
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (typeof it === 'string') out += it;
          else {
            const v = it.e(f);
            if (it.spec === null && it.conv === null) out += typeof v === 'string' ? v : str(v);
            else out += formatValue(v, it.spec ? it.spec(f) : '', it.conv);
          }
        }
        return out;
      };
    };
    const build = mk(n.parts);
    return (f) => {
      rt.ops++;
      const s = build(f);
      if (s.length >= 32) rt.alloc(s.length);
      return s;
    };
  }

  binopExpr(n: Node): Ev {
    const rt = this.rt;
    const l = this.expr(n.l);
    const r = this.expr(n.r);
    const op: string = n.op;
    switch (op) {
      case '+':
        return (f) => {
          rt.ops++;
          const a = l(f);
          const b = r(f);
          if (typeof a === 'number' && typeof b === 'number') {
            const s = a + b;
            if (s <= MAX_INT && s >= -MAX_INT) return s;
            overflow();
          }
          return binop(rt, '+', a, b);
        };
      case '-':
        return (f) => {
          rt.ops++;
          const a = l(f);
          const b = r(f);
          if (typeof a === 'number' && typeof b === 'number') {
            const s = a - b;
            if (s <= MAX_INT && s >= -MAX_INT) return s;
            overflow();
          }
          return binop(rt, '-', a, b);
        };
      case '*':
        return (f) => {
          rt.ops++;
          const a = l(f);
          const b = r(f);
          if (typeof a === 'number' && typeof b === 'number') {
            const s = a * b + 0;
            if (s <= MAX_INT && s >= -MAX_INT) return s;
            overflow();
          }
          return binop(rt, '*', a, b);
        };
      case '%':
        return (f) => {
          rt.ops++;
          const a = l(f);
          const b = r(f);
          if (typeof a === 'number' && typeof b === 'number' && b > 0 && a >= 0) return a % b;
          return binop(rt, '%', a, b);
        };
      case '//':
        return (f) => {
          rt.ops++;
          const a = l(f);
          const b = r(f);
          if (typeof a === 'number' && typeof b === 'number' && b > 0 && a >= 0) return (a - (a % b)) / b;
          return binop(rt, '//', a, b);
        };
      default:
        return (f) => {
          rt.ops++;
          const a = l(f);
          return binop(rt, op, a, r(f));
        };
    }
  }

  cmpOne(op: string, a: any, b: any): boolean {
    switch (op) {
      case '<': case '<=': case '>': case '>=': return compareOp(op, a, b);
      case '==': return eq(a, b);
      case '!=': return !eq(a, b);
      case 'is': return a === b;
      case 'is not': return a !== b;
      case 'in': return this.containsCost(a, b);
      default: return !this.containsCost(a, b);
    }
  }

  containsCost(a: any, b: any): boolean {
    if (Array.isArray(b)) this.rt.ops += b.length;
    else if (typeof b === 'string') this.rt.ops += b.length;
    else if (b instanceof PyTuple) this.rt.ops += b.a.length;
    else if (b instanceof PyDeque) this.rt.ops += b.size();
    return contains(b, a);
  }

  cmpExpr(n: Node): Ev {
    const rt = this.rt;
    const first = this.expr(n.first);
    const rest: Ev[] = n.rest.map((x: Node) => this.expr(x));
    const ops: string[] = n.ops;
    if (ops.length === 1) {
      const r = rest[0];
      switch (ops[0]) {
        case '<': return (f) => { rt.ops++; const a = first(f); const b = r(f); return typeof a === 'number' && typeof b === 'number' ? a < b : compareOp('<', a, b); };
        case '<=': return (f) => { rt.ops++; const a = first(f); const b = r(f); return typeof a === 'number' && typeof b === 'number' ? a <= b : compareOp('<=', a, b); };
        case '>': return (f) => { rt.ops++; const a = first(f); const b = r(f); return typeof a === 'number' && typeof b === 'number' ? a > b : compareOp('>', a, b); };
        case '>=': return (f) => { rt.ops++; const a = first(f); const b = r(f); return typeof a === 'number' && typeof b === 'number' ? a >= b : compareOp('>=', a, b); };
        case '==': return (f) => { rt.ops++; const a = first(f); const b = r(f); return typeof a === 'number' && typeof b === 'number' ? a === b : eq(a, b); };
        case '!=': return (f) => { rt.ops++; const a = first(f); const b = r(f); return typeof a === 'number' && typeof b === 'number' ? a !== b : !eq(a, b); };
        case 'is': return (f) => { rt.ops++; const a = first(f); return a === r(f); };
        case 'is not': return (f) => { rt.ops++; const a = first(f); return a !== r(f); };
        default: {
          const op = ops[0];
          return (f) => { rt.ops++; const a = first(f); const b = r(f); return this.cmpOne(op, a, b); };
        }
      }
    }
    return (f) => {
      rt.ops++;
      let a = first(f);
      for (let i = 0; i < ops.length; i++) {
        const b = rest[i](f);
        if (!this.cmpOne(ops[i], a, b)) return false;
        a = b;
      }
      return true;
    };
  }

  // Evaluates call arguments into [args, kw].
  argsEval(n: Node): (f: Frame) => any[] {
    const evs: Ev[] = n.args.map((a: Node) => (a.k === 'star' ? this.expr(a.e) : this.expr(a)));
    const stars: boolean[] = n.args.map((a: Node) => a.k === 'star');
    const len = evs.length;
    if (!n.hasStar) {
      switch (len) {
        case 0: return () => [];
        case 1: { const e0 = evs[0]; return (f) => [e0(f)]; }
        case 2: { const e0 = evs[0]; const e1 = evs[1]; return (f) => { const a = e0(f); return [a, e1(f)]; }; }
        default: return (f) => {
          const a = new Array(len);
          for (let i = 0; i < len; i++) a[i] = evs[i](f);
          return a;
        };
      }
    }
    return (f) => {
      const a: any[] = [];
      for (let i = 0; i < len; i++) {
        const v = evs[i](f);
        if (stars[i]) for (const x of asArray(v)) a.push(x);
        else a.push(v);
      }
      return a;
    };
  }

  kwEval(n: Node): ((f: Frame) => Map<string, any>) | null {
    if (!n.kws.length) return null;
    const names: string[] = n.kws.map((k: any) => k.name);
    const evs: Ev[] = n.kws.map((k: any) => this.expr(k.v));
    return (f) => {
      const m = new Map<string, any>();
      for (let i = 0; i < names.length; i++) m.set(names[i], evs[i](f));
      return m;
    };
  }

  callExpr(n: Node): Ev {
    const rt = this.rt;
    const args = this.argsEval(n);
    const kw = this.kwEval(n);
    const fnode: Node = n.f;
    if (fnode.k === 'attr') {
      const recv = this.expr(fnode.e);
      const name: string = fnode.name;
      return (f) => {
        rt.ops++;
        rt.ops++; // the attribute node
        const o = recv(f);
        const a = args(f);
        return this.callMethod(o, name, a, kw ? kw(f) : null);
      };
    }
    const callee = this.expr(fnode);
    return (f) => {
      rt.ops++;
      const fn = callee(f);
      const a = args(f);
      if (fn instanceof PyFunc && kw === null) return this.callUser(fn, a, null);
      return this.callValue(fn, a, kw ? kw(f) : null);
    };
  }

  compExpr(n: Node): Ev {
    const rt = this.rt;
    const kind: string = n.kind;
    const gens = n.gens.map((g: any) => ({
      iter: this.expr(g.iter),
      store: this.store(g.target),
      ifs: g.ifs.map((x: Node) => this.expr(x)),
    }));
    const elt = this.expr(n.elt);
    const val = n.val ? this.expr(n.val) : null;
    const last = gens.length - 1;
    const run = (i: number, f: Frame, acc: any): void => {
      const g = gens[i];
      const it = g.iter(f);
      let arr: any[];
      let range: PyRange | null = null;
      if (Array.isArray(it)) arr = it;
      else if (it instanceof PyRange) { range = it; arr = []; } else arr = asArray(it);
      const total = range ? range.len : arr.length;
      let x = range ? range.start : 0;
      outer: for (let k = 0; k < (range ? total : arr.length); k++) {
        const item = range ? x : arr[k];
        if (range) x += range.step;
        g.store(f, item);
        if (++rt.ops > rt.maxOps) rt.opsFatal();
        for (let c = 0; c < g.ifs.length; c++) if (!truthy(g.ifs[c](f))) continue outer;
        if (i < last) { run(i + 1, f, acc); continue; }
        if (kind === 'dict') {
          const key = elt(f);
          if (dictSet(acc, key, val!(f))) rt.alloc(1);
        } else if (kind === 'set') {
          if (setAdd(acc, elt(f))) rt.alloc(1);
        } else {
          const v = elt(f);
          rt.alloc(1);
          acc.push(v);
        }
      }
    };
    return (f) => {
      rt.ops++;
      const acc = kind === 'dict' ? new PyDict() : kind === 'set' ? new PySet() : [];
      const tl = rt.temps.length;
      rt.temps.push(acc);
      run(0, f, acc);
      rt.temps.length = tl;
      return kind === 'gen' ? new PyIter(acc as any[], 'generator') : acc;
    };
  }

  // ---- stores ----
  store(t: Node): (f: Frame, v: any) => void {
    const rt = this.rt;
    switch (t.k) {
      case 'name': {
        if (t.h !== 0) throw new Error('fast: assignment to a non-local name');
        const s: number = t.s;
        return (f, v) => { f.v[s] = v; };
      }
      case 'sub': {
        const o = this.expr(t.e);
        if (t.idx.k === 'slice') {
          const sl = this.sliceExpr(t.idx);
          return (f, v) => { const obj = o(f); setSlice(rt, obj, sl(f), v); };
        }
        const i = this.expr(t.idx);
        return (f, v) => {
          const obj = o(f);
          const idx = i(f);
          if (typeof idx === 'number' && Array.isArray(obj)) {
            const len = obj.length;
            if (idx >= 0 && idx < len) { obj[idx] = v; return; }
          }
          setItem(rt, obj, idx, v);
        };
      }
      case 'attr': {
        const o = this.expr(t.e);
        const name: string = t.name;
        return (f, v) => { this.setAttr(o(f), name, v); };
      }
      case 'tuple': case 'list': {
        const stores = t.elts.map((x: Node) => this.store(x));
        const n = stores.length;
        return (f, v) => {
          const items = unpackArray(v, n);
          const copy = items.length > 0 ? items.slice() : items;
          for (let i = 0; i < n; i++) stores[i](f, copy[i]);
        };
      }
      default:
        return err('SyntaxError', 'You cannot assign to this expression.');
    }
  }

  // ---- statements ----
  block(stmts: Node[]): Ex {
    const exs = stmts.map((s) => this.stmt(s));
    const n = exs.length;
    if (n === 0) return () => 0;
    if (n === 1) return exs[0];
    if (n === 2) {
      const a = exs[0];
      const b = exs[1];
      return (f) => { const c = a(f); return c !== 0 ? c : b(f); };
    }
    return (f) => {
      for (let i = 0; i < n; i++) {
        const c = exs[i](f);
        if (c !== 0) return c;
      }
      return 0;
    };
  }

  module(stmts: Node[]): Ex {
    const rt = this.rt;
    const exs = stmts.map((s, i) => {
      if (i === stmts.length - 1 && s.k === 'expr') {
        const e = this.expr(s.e);
        const P = mkPos(s.line, s.col);
        return (f: Frame) => {
          rt.pos = P;
          if (++rt.ops > rt.maxOps) rt.opsFatal();
          rt.lastValue = e(f);
          return 0;
        };
      }
      return this.stmt(s);
    });
    return (f) => {
      for (let i = 0; i < exs.length; i++) {
        const c = exs[i](f);
        if (c !== 0) return c;
      }
      return 0;
    };
  }

  stmt(n: Node): Ex {
    const rt = this.rt;
    const P = mkPos(n.line, n.col);
    switch (n.k) {
      case 'expr': {
        const e = this.expr(n.e);
        return (f) => { rt.pos = P; if (++rt.ops > rt.maxOps) rt.opsFatal(); e(f); return 0; };
      }
      case 'pass':
        return () => { rt.pos = P; if (++rt.ops > rt.maxOps) rt.opsFatal(); return 0; };
      case 'break':
        return () => { rt.pos = P; if (++rt.ops > rt.maxOps) rt.opsFatal(); return 1; };
      case 'continue':
        return () => { rt.pos = P; if (++rt.ops > rt.maxOps) rt.opsFatal(); return 2; };
      case 'return': {
        const e = n.value ? this.expr(n.value) : null;
        return (f) => {
          rt.pos = P;
          if (++rt.ops > rt.maxOps) rt.opsFatal();
          f.ret = e ? e(f) : null;
          return 3;
        };
      }
      case 'assign': return this.assignStmt(n, P);
      case 'aug': return this.augStmt(n, P);
      case 'if': {
        const test = this.expr(n.test);
        const body = this.block(n.body);
        const orelse = this.block(n.orelse);
        return (f) => {
          rt.pos = P;
          if (++rt.ops > rt.maxOps) rt.opsFatal();
          const t = test(f);
          if (t === true || (t !== false && truthy(t))) return body(f);
          return orelse(f);
        };
      }
      case 'while': {
        const test = this.expr(n.test);
        const body = this.block(n.body);
        const orelse = n.orelse.length ? this.block(n.orelse) : null;
        return (f) => {
          for (;;) {
            rt.pos = P;
            if (++rt.ops > rt.maxOps) rt.opsFatal();
            const t = test(f);
            if (!(t === true || (t !== false && truthy(t)))) break;
            const c = body(f);
            if (c === 1) return 0;
            if (c === 3) return 3;
          }
          return orelse ? orelse(f) : 0;
        };
      }
      case 'for': return this.forStmt(n, P);
      case 'def': {
        const defs: Ev[] = n.params.filter((p: any) => p.def).map((p: any) => this.expr(p.def));
        const slot: number = n.slot;
        const name: string = n.name;
        return (f) => {
          rt.pos = P;
          if (++rt.ops > rt.maxOps) rt.opsFatal();
          const dv = defs.length ? defs.map((d) => d(f)) : [];
          f.v[slot] = new PyFunc(name, n, f, dv);
          return 0;
        };
      }
      case 'class': return this.classStmt(n, P);
      case 'try': return this.tryStmt(n, P);
      case 'raise': {
        const e = n.exc ? this.expr(n.exc) : null;
        return (f) => {
          rt.pos = P;
          if (++rt.ops > rt.maxOps) rt.opsFatal();
          if (!e) {
            if (!rt.curExc) err('RuntimeError', 'There is no active exception to re-raise.');
            throw new SnekThrow(rt.curExc!);
          }
          let v = e(f);
          if (v instanceof PyExcClass) v = excFromCall(v.kind, []);
          if (!(v instanceof PyExc)) err('TypeError', 'You can only raise an exception such as ValueError("message").');
          v.pos = P;
          throw new SnekThrow(v);
        };
      }
      case 'assert': {
        const test = this.expr(n.test);
        const msg = n.msg ? this.expr(n.msg) : null;
        return (f) => {
          rt.pos = P;
          if (++rt.ops > rt.maxOps) rt.opsFatal();
          if (!truthy(test(f))) {
            const m = msg ? str(msg(f)) : '';
            const e = new PyExc('AssertionError', m, msg ? [m] : []);
            e.user = true;
            e.pos = P;
            throw new SnekThrow(e);
          }
          return 0;
        };
      }
      case 'del': {
        const dels = n.targets.map((t: Node) => this.delTarget(t));
        return (f) => {
          rt.pos = P;
          if (++rt.ops > rt.maxOps) rt.opsFatal();
          for (let i = 0; i < dels.length; i++) dels[i](f);
          return 0;
        };
      }
      case 'import': {
        return (f) => {
          rt.pos = P;
          if (++rt.ops > rt.maxOps) rt.opsFatal();
          for (const m of n.mods) {
            const root = m.name.split('.')[0];
            f.v[m.slot] = this.getModule(root);
          }
          return 0;
        };
      }
      case 'from': {
        return (f) => {
          rt.pos = P;
          if (++rt.ops > rt.maxOps) rt.opsFatal();
          const mod = this.getModule(n.mod);
          for (const it of n.names) {
            const v = mod.attrs.get(it.name);
            if (v === undefined) err('NameError', `The module '${n.mod}' has no '${it.name}' in Snek.`);
            f.v[it.slot] = v;
          }
          return 0;
        };
      }
      default:
        throw new Error('fast: unknown statement ' + n.k);
    }
  }

  delTarget(t: Node): (f: Frame) => void {
    switch (t.k) {
      case 'name': {
        const s: number = t.s;
        const id: string = t.id;
        return (f) => {
          if (f.v[s] === undefined) unbound(id);
          f.v[s] = undefined;
        };
      }
      case 'sub': {
        const o = this.expr(t.e);
        const i = this.expr(t.idx);
        return (f) => { const obj = o(f); delItem(obj, i(f)); };
      }
      case 'attr': {
        const o = this.expr(t.e);
        const name: string = t.name;
        return (f) => {
          const obj = o(f);
          if (!(obj instanceof PyInstance) || !obj.attrs.delete(name)) err('AttributeError', `There is no attribute '${name}' to delete.`);
        };
      }
      case 'tuple': case 'list': {
        const ds = t.elts.map((x: Node) => this.delTarget(x));
        return (f) => { for (const d of ds) d(f); };
      }
      default:
        return err('SyntaxError', 'You cannot delete this expression.');
    }
  }

  assignStmt(n: Node, P: number): Ex {
    const rt = this.rt;
    const val = this.expr(n.value);
    if (n.targets.length === 1) {
      const t: Node = n.targets[0];
      if (t.k === 'name') {
        if (t.h !== 0) throw new Error('fast: assignment to a non-local name');
        const s: number = t.s;
        return (f) => {
          rt.pos = P;
          if (++rt.ops > rt.maxOps) rt.opsFatal();
          f.v[s] = val(f);
          return 0;
        };
      }
      if (t.k === 'tuple' && n.value.k === 'tuple' && t.elts.length === n.value.elts.length) {
        const rhs: Ev[] = n.value.elts.map((x: Node) => this.expr(x));
        const stores = t.elts.map((x: Node) => this.store(x));
        const m = rhs.length;
        if (m === 2) {
          const r0 = rhs[0];
          const r1 = rhs[1];
          const s0 = stores[0];
          const s1 = stores[1];
          return (f) => {
            rt.pos = P;
            if (++rt.ops > rt.maxOps) rt.opsFatal();
            rt.ops++;
            const a = r0(f);
            const b = r1(f);
            s0(f, a);
            s1(f, b);
            return 0;
          };
        }
        return (f) => {
          rt.pos = P;
          if (++rt.ops > rt.maxOps) rt.opsFatal();
          rt.ops++;
          const vals = new Array(m);
          for (let i = 0; i < m; i++) vals[i] = rhs[i](f);
          for (let i = 0; i < m; i++) stores[i](f, vals[i]);
          return 0;
        };
      }
    }
    const stores = n.targets.map((t: Node) => this.store(t));
    return (f) => {
      rt.pos = P;
      if (++rt.ops > rt.maxOps) rt.opsFatal();
      const v = val(f);
      for (let i = 0; i < stores.length; i++) stores[i](f, v);
      return 0;
    };
  }

  augBin(op: string, cur: any, r: any): any {
    if (op === '+' && Array.isArray(cur)) {
      const items = asArray(r);
      const k = items.length;
      this.rt.alloc(k);
      this.rt.ops += k;
      if (items === cur) { const copy = cur.slice(); for (let i = 0; i < k; i++) cur.push(copy[i]); } else for (let i = 0; i < k; i++) cur.push(items[i]);
      return cur;
    }
    return binop(this.rt, op, cur, r);
  }

  augStmt(n: Node, P: number): Ex {
    const rt = this.rt;
    const op: string = n.op;
    const val = this.expr(n.value);
    const t: Node = n.target;
    if (t.k === 'name') {
      const s: number = t.s;
      const id: string = t.id;
      const h: number = t.h;
      if (h !== 0) throw new Error('fast: assignment to a non-local name');
      if (op === '+') {
        return (f) => {
          rt.pos = P;
          if (++rt.ops > rt.maxOps) rt.opsFatal();
          const cur = f.v[s];
          if (cur === undefined) unbound(id);
          rt.ops++;
          const r = val(f);
          if (typeof cur === 'number' && typeof r === 'number') {
            const x = cur + r;
            if (x > MAX_INT || x < -MAX_INT) overflow();
            f.v[s] = x;
          } else f.v[s] = this.augBin('+', cur, r);
          return 0;
        };
      }
      return (f) => {
        rt.pos = P;
        if (++rt.ops > rt.maxOps) rt.opsFatal();
        const cur = f.v[s];
        if (cur === undefined) unbound(id);
        rt.ops++;
        f.v[s] = this.augBin(op, cur, val(f));
        return 0;
      };
    }
    if (t.k === 'sub' && t.idx.k !== 'slice') {
      const o = this.expr(t.e);
      const i = this.expr(t.idx);
      return (f) => {
        rt.pos = P;
        if (++rt.ops > rt.maxOps) rt.opsFatal();
        const obj = o(f);
        const idx = i(f);
        const cur = getItem(rt, obj, idx);
        rt.ops++;
        setItem(rt, obj, idx, this.augBin(op, cur, val(f)));
        return 0;
      };
    }
    if (t.k === 'attr') {
      const o = this.expr(t.e);
      const name: string = t.name;
      return (f) => {
        rt.pos = P;
        if (++rt.ops > rt.maxOps) rt.opsFatal();
        const obj = o(f);
        const cur = this.getAttr(obj, name);
        rt.ops++;
        this.setAttr(obj, name, this.augBin(op, cur, val(f)));
        return 0;
      };
    }
    return err('SyntaxError', 'You cannot use an augmented assignment such as += on this expression.');
  }

  forStmt(n: Node, P: number): Ex {
    const rt = this.rt;
    const iter = this.expr(n.iter);
    const body = this.block(n.body);
    const orelse = n.orelse.length ? this.block(n.orelse) : null;
    const target: Node = n.target;
    const simple = target.k === 'name' && target.h === 0;
    const slot: number = simple ? target.s : -1;
    const st = simple ? null : this.store(target);
    return (f) => {
      rt.pos = P;
      if (++rt.ops > rt.maxOps) rt.opsFatal();
      const it = iter(f);
      const v = f.v;
      if (Array.isArray(it)) {
        for (let i = 0; i < it.length; i++) {
          rt.pos = P;
          if (++rt.ops > rt.maxOps) rt.opsFatal();
          if (simple) v[slot] = it[i]; else st!(f, it[i]);
          const c = body(f);
          if (c === 1) return 0;
          if (c === 3) return 3;
        }
      } else if (it instanceof PyRange) {
        let x = it.start;
        const step = it.step;
        for (let i = 0; i < it.len; i++, x += step) {
          rt.pos = P;
          if (++rt.ops > rt.maxOps) rt.opsFatal();
          if (simple) v[slot] = x; else st!(f, x);
          const c = body(f);
          if (c === 1) return 0;
          if (c === 3) return 3;
        }
      } else {
        const arr = asArray(it);
        for (let i = 0; i < arr.length; i++) {
          rt.pos = P;
          if (++rt.ops > rt.maxOps) rt.opsFatal();
          if (simple) v[slot] = arr[i]; else st!(f, arr[i]);
          const c = body(f);
          if (c === 1) return 0;
          if (c === 3) return 3;
        }
      }
      return orelse ? orelse(f) : 0;
    };
  }

  classStmt(n: Node, P: number): Ex {
    const rt = this.rt;
    const sc = n.sc;
    const body = this.block(n.body);
    const slot: number = n.slot;
    const name: string = n.name;
    return (f) => {
      rt.pos = P;
      if (++rt.ops > rt.maxOps) rt.opsFatal();
      const cf = new Frame(sc.nslots, f, sc);
      body(cf);
      f.v[slot] = this.makeClass(name, sc, cf);
      return 0;
    };
  }

  makeClass(name: string, sc: any, cf: Frame): PyClass {
    const ns = new Map<string, any>();
    for (let i = 0; i < sc.slotNames.length; i++) {
      const nm = sc.slotNames[i];
      if (nm !== null && cf.v[i] !== undefined) ns.set(nm, cf.v[i]);
    }
    return new PyClass(name, ns);
  }

  matchHandler(types: any, exc: PyExc): boolean {
    if (types instanceof PyExcClass) return types.kind === 'Exception' || types.kind === exc.kind;
    if (types instanceof PyTuple) return types.a.some((t: any) => this.matchHandler(t, exc));
    return err('TypeError', 'An except clause must name an exception such as ValueError.');
  }

  tryStmt(n: Node, P: number): Ex {
    const rt = this.rt;
    const body = this.block(n.body);
    const orelse = n.orelse.length ? this.block(n.orelse) : null;
    const final = n.final.length ? this.block(n.final) : null;
    const handlers = n.handlers.map((h: any) => ({
      types: h.types ? this.expr(h.types) : null,
      slot: h.name ? h.slot : -1,
      body: this.block(h.body),
    }));
    return (f) => {
      rt.pos = P;
      if (++rt.ops > rt.maxOps) rt.opsFatal();
      let code = 0;
      let pending: any = null;
      let hasPending = false;
      const depth = rt.depth;
      const tl = rt.temps.length;
      try {
        let ok = false;
        try {
          code = body(f);
          ok = true;
        } catch (e) {
          if (!(e instanceof SnekThrow) || handlers.length === 0) throw e;
          rt.depth = depth;
          rt.temps.length = tl;
          if (!e.exc.pos) e.exc.pos = rt.pos;
          let handled = false;
          for (let i = 0; i < handlers.length; i++) {
            const h = handlers[i];
            if (h.types === null || this.matchHandler(h.types(f), e.exc)) {
              handled = true;
              if (h.slot >= 0) f.v[h.slot] = e.exc;
              const prev = rt.curExc;
              rt.curExc = e.exc;
              try {
                code = h.body(f);
              } finally {
                rt.curExc = prev;
              }
              break;
            }
          }
          if (!handled) throw e;
        }
        if (ok && code === 0 && orelse) code = orelse(f);
      } catch (e2) {
        if (!final) throw e2;
        pending = e2;
        hasPending = true;
      }
      if (final) {
        const fc = final(f);
        if (fc !== 0) return fc;
        if (hasPending) throw pending;
      }
      return code;
    };
  }
}

function unbound(id: string): never {
  return err('NameError', `The variable '${id}' is used before it has been given a value.`);
}

