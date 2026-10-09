// Scope analysis: gives every variable a frame slot so the evaluator never looks names up by string.
import { CompileError } from './types.ts';
import type { Node } from './types.ts';

// Names that would reach outside the program. They are refused when they are not the learner's own variable.
const BANNED = new Set([
  'open', 'eval', 'exec', 'compile', '__import__', 'getattr', 'setattr', 'delattr', 'globals', 'locals', 'vars',
]);

export class Scope {
  kind: 'module' | 'function' | 'class' | 'comp';
  parent: Scope | null;
  names: Map<string, number> = new Map();
  frame: Scope;
  slotNames: (string | null)[] = [];
  nslots = 0;
  constructor(kind: 'module' | 'function' | 'class' | 'comp', parent: Scope | null) {
    this.kind = kind;
    this.parent = parent;
    this.frame = this as Scope;
    if (kind === 'comp' && parent) this.frame = parent.frame;
  }
  declare(name: string): number {
    const have = this.names.get(name);
    if (have !== undefined) return have;
    const f = this.frame;
    const slot = f.nslots++;
    f.slotNames.push(this.kind === 'comp' ? null : name);
    this.names.set(name, slot);
    return slot;
  }
  hidden(): number {
    const f = this.frame;
    f.slotNames.push(null);
    return f.nslots++;
  }
}

function bindTarget(t: Node, scope: Scope): void {
  switch (t.k) {
    case 'name': scope.declare(t.id); break;
    case 'tuple': case 'list': for (const x of t.elts) bindTarget(x, scope); break;
    default: break;
  }
}

function collectBinds(stmts: Node[], scope: Scope): void {
  for (const s of stmts) {
    switch (s.k) {
      case 'assign': for (const t of s.targets) bindTarget(t, scope); break;
      case 'aug': bindTarget(s.target, scope); break;
      case 'for': bindTarget(s.target, scope); collectBinds(s.body, scope); collectBinds(s.orelse, scope); break;
      case 'while': case 'if': collectBinds(s.body, scope); collectBinds(s.orelse, scope); break;
      case 'try':
        collectBinds(s.body, scope);
        for (const h of s.handlers) {
          if (h.name) scope.declare(h.name);
          collectBinds(h.body, scope);
        }
        collectBinds(s.orelse, scope);
        collectBinds(s.final, scope);
        break;
      case 'def': case 'class': scope.declare(s.name); break;
      case 'del': for (const t of s.targets) bindTarget(t, scope); break;
      case 'import': for (const m of s.mods) scope.declare(m.as ?? m.name.split('.')[0]); break;
      case 'from': for (const m of s.names) scope.declare(m.as ?? m.name); break;
      default: break;
    }
  }
}

function lookup(scope: Scope, id: string): { hops: number; slot: number } | null {
  const origin = scope.kind === 'comp' ? scope.frame : scope;
  let s: Scope | null = scope;
  let hops = 0;
  while (s) {
    if (s.kind === 'comp') {
      const slot = s.names.get(id);
      if (slot !== undefined) return { hops, slot };
      s = s.parent;
      continue;
    }
    if (s.kind !== 'class' || s === origin) {
      const slot = s.names.get(id);
      if (slot !== undefined) return { hops, slot };
    }
    s = s.parent;
    hops++;
  }
  return null;
}

function resolveName(n: Node, scope: Scope): void {
  const r = lookup(scope, n.id);
  if (r) {
    n.h = r.hops;
    n.s = r.slot;
  } else {
    n.h = -1;
    n.s = -1;
    if (BANNED.has(n.id)) {
      throw new CompileError('NotAllowed', n.line, n.col, `Snek does not allow '${n.id}', because it could reach outside your program.`);
    }
  }
}

function resolveTarget(t: Node, scope: Scope): void {
  switch (t.k) {
    case 'name': resolveName(t, scope); break;
    case 'tuple': case 'list': for (const x of t.elts) resolveTarget(x, scope); break;
    default: resolveExpr(t, scope);
  }
}

function resolveFunc(n: Node, scope: Scope): void {
  // n is a def or lambda; defaults belong to the enclosing scope
  for (const p of n.params) if (p.def) resolveExpr(p.def, scope);
  const sc = new Scope('function', scope);
  for (const p of n.params) sc.declare(p.name);
  n.sc = sc;
  if (n.k === 'lambda') {
    resolveExpr(n.body, sc);
  } else {
    collectBinds(n.body, sc);
    resolveStmts(n.body, sc);
  }
}

export function resolveExpr(e: Node, scope: Scope): void {
  switch (e.k) {
    case 'name': resolveName(e, scope); break;
    case 'num': case 'float': case 'str': case 'const': break;
    case 'fstr':
      for (const p of e.parts) {
        if (typeof p !== 'string') {
          resolveExpr(p.e, scope);
          if (p.spec) for (const sp of p.spec) if (typeof sp !== 'string') resolveExpr(sp.e, scope);
        }
      }
      break;
    case 'list': case 'tuple': case 'set': for (const x of e.elts) resolveExpr(x, scope); break;
    case 'dict': for (const x of e.keys) resolveExpr(x, scope); for (const x of e.values) resolveExpr(x, scope); break;
    case 'binop': case 'bool': resolveExpr(e.l, scope); resolveExpr(e.r, scope); break;
    case 'unary': case 'not': resolveExpr(e.e, scope); break;
    case 'cmp': resolveExpr(e.first, scope); for (const x of e.rest) resolveExpr(x, scope); break;
    case 'ifexp': resolveExpr(e.c, scope); resolveExpr(e.a, scope); resolveExpr(e.b, scope); break;
    case 'call':
      resolveExpr(e.f, scope);
      for (const a of e.args) resolveExpr(a, scope);
      for (const k of e.kws) resolveExpr(k.v, scope);
      break;
    case 'star': resolveExpr(e.e, scope); break;
    case 'attr': resolveExpr(e.e, scope); break;
    case 'sub': resolveExpr(e.e, scope); resolveExpr(e.idx, scope); break;
    case 'slice':
      if (e.lo) resolveExpr(e.lo, scope);
      if (e.hi) resolveExpr(e.hi, scope);
      if (e.step) resolveExpr(e.step, scope);
      break;
    case 'lambda': resolveFunc(e, scope); break;
    case 'comp': {
      const sc = new Scope('comp', scope);
      for (const g of e.gens) bindTarget(g.target, sc);
      e.sc = sc;
      e.gens.forEach((g: any, i: number) => {
        resolveExpr(g.iter, i === 0 ? scope : sc);
        resolveTarget(g.target, sc);
        for (const c of g.ifs) resolveExpr(c, sc);
      });
      resolveExpr(e.elt, sc);
      if (e.val) resolveExpr(e.val, sc);
      break;
    }
    default:
      throw new Error('resolve: unknown expression ' + e.k);
  }
}

export function resolveStmts(stmts: Node[], scope: Scope): void {
  for (const s of stmts) resolveStmt(s, scope);
}

function resolveStmt(s: Node, scope: Scope): void {
  switch (s.k) {
    case 'expr': resolveExpr(s.e, scope); break;
    case 'assign':
      resolveExpr(s.value, scope);
      for (const t of s.targets) resolveTarget(t, scope);
      break;
    case 'aug':
      resolveExpr(s.value, scope);
      resolveTarget(s.target, scope);
      break;
    case 'pass': case 'break': case 'continue': case 'import': case 'from':
      if (s.k === 'import') for (const m of s.mods) m.slot = lookup(scope, m.as ?? m.name.split('.')[0])!.slot;
      if (s.k === 'from') for (const m of s.names) m.slot = lookup(scope, m.as ?? m.name)!.slot;
      break;
    case 'return': if (s.value) resolveExpr(s.value, scope); break;
    case 'del': for (const t of s.targets) resolveTarget(t, scope); break;
    case 'assert': resolveExpr(s.test, scope); if (s.msg) resolveExpr(s.msg, scope); break;
    case 'raise': if (s.exc) resolveExpr(s.exc, scope); break;
    case 'if': case 'while':
      resolveExpr(s.test, scope);
      resolveStmts(s.body, scope);
      resolveStmts(s.orelse, scope);
      break;
    case 'for':
      resolveExpr(s.iter, scope);
      resolveTarget(s.target, scope);
      resolveStmts(s.body, scope);
      resolveStmts(s.orelse, scope);
      break;
    case 'def': {
      s.slot = lookup(scope, s.name)!.slot;
      resolveFunc(s, scope);
      break;
    }
    case 'class': {
      s.slot = lookup(scope, s.name)!.slot;
      const sc = new Scope('class', scope);
      collectBinds(s.body, sc);
      s.sc = sc;
      resolveStmts(s.body, sc);
      break;
    }
    case 'try':
      resolveStmts(s.body, scope);
      for (const h of s.handlers) {
        if (h.types) resolveExpr(h.types, scope);
        if (h.name) h.slot = lookup(scope, h.name)!.slot;
        resolveStmts(h.body, scope);
      }
      resolveStmts(s.orelse, scope);
      resolveStmts(s.final, scope);
      break;
    default:
      throw new Error('resolve: unknown statement ' + s.k);
  }
}

export function resolveModule(body: Node[]): Scope {
  const sc = new Scope('module', null);
  collectBinds(body, sc);
  resolveStmts(body, sc);
  return sc;
}
