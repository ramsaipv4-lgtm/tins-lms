// Recursive-descent parser for Snek (a Python subset). Produces a loosely typed AST.
import { CompileError } from './types.ts';
import type { Node, SnekErrorKind } from './types.ts';
import { tokenize, decodeEscapes } from './lexer.ts';
import type { Token } from './lexer.ts';

const KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del',
  'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
  'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
]);

const UNSUPPORTED: Record<string, string> = Object.assign(Object.create(null), {
  global: "Snek does not support 'global': pass values in and return them instead.",
  nonlocal: "Snek does not support 'nonlocal': pass values in and return them instead.",
  with: "Snek does not support 'with' blocks.",
  yield: "Snek does not support 'yield' (generators).",
  async: "Snek does not support 'async' code.",
  await: "Snek does not support 'await'.",
});

const AUG_OPS = ['+=', '-=', '*=', '/=', '//=', '%=', '**=', '&=', '|=', '^=', '<<=', '>>='];
const ALLOWED_MODULES = ['math', 'collections', 'heapq'];

function mk(k: string, t: { line: number; col: number }, props: Record<string, any>): Node {
  return { k, line: t.line, col: t.col, ...props };
}

class Parser {
  toks: Token[];
  p = 0;
  inFunc = 0;
  loop = 0;
  constructor(toks: Token[]) {
    this.toks = toks;
  }

  peek(): Token {
    return this.toks[this.p];
  }
  peekAt(o: number): Token {
    return this.toks[Math.min(this.p + o, this.toks.length - 1)];
  }
  next(): Token {
    const t = this.toks[this.p];
    if (this.p < this.toks.length - 1) this.p++;
    return t;
  }
  isOp(v: string): boolean {
    const t = this.toks[this.p];
    return t.t === 'OP' && t.v === v;
  }
  isKw(v: string): boolean {
    const t = this.toks[this.p];
    return t.t === 'NAME' && t.v === v;
  }
  fail(kind: SnekErrorKind, t: Token, msg: string): never {
    throw new CompileError(kind, t.line, t.col, msg);
  }
  describe(t: Token): string {
    switch (t.t) {
      case 'NEWLINE': return 'the end of the line';
      case 'EOF': return 'the end of the program';
      case 'INDENT': return 'an indent';
      case 'DEDENT': return 'a dedent';
      case 'STR': return 'a string';
      case 'NUM': case 'FLOAT': return `number ${t.v}`;
      default: return `'${t.v}'`;
    }
  }
  unexpected(t: Token): never {
    if (t.t === 'INDENT') this.fail('IndentationError', t, 'Unexpected indent: this line is indented more than the code above it.');
    if (t.t === 'NAME' && UNSUPPORTED[t.v]) this.fail('SyntaxError', t, UNSUPPORTED[t.v]);
    this.fail('SyntaxError', t, `Unexpected ${this.describe(t).replace(/^the /, '')}: check this line for a missing or extra piece.`);
  }
  expectOp(v: string, what?: string): Token {
    const t = this.peek();
    if (t.t === 'OP' && t.v === v) return this.next();
    if (v === ':') this.fail('SyntaxError', t, `Expected ':' ${what ?? 'at the end of this line'}, but found ${this.describe(t)}.`);
    this.fail('SyntaxError', t, `Expected '${v}' ${what ?? ''}but found ${this.describe(t)}.`);
  }
  expectKw(v: string): Token {
    const t = this.peek();
    if (t.t === 'NAME' && t.v === v) return this.next();
    this.fail('SyntaxError', t, `Expected '${v}' but found ${this.describe(t)}.`);
  }
  expectName(): Token {
    const t = this.peek();
    if (t.t === 'NAME' && !KEYWORDS.has(t.v)) return this.next();
    if (t.t === 'NAME' && UNSUPPORTED[t.v]) this.unexpected(t);
    this.fail('SyntaxError', t, `Expected a name but found ${this.describe(t)}.`);
  }

  // ---- statements ----
  parseModule(): Node[] {
    const body: Node[] = [];
    while (this.peek().t !== 'EOF') {
      this.parseStatement(body);
    }
    return body;
  }

  parseStatement(out: Node[]): void {
    const t = this.peek();
    if (t.t === 'INDENT') this.unexpected(t);
    if (t.t === 'DEDENT') this.fail('IndentationError', t, 'Unexpected dedent: this line is indented less than expected.');
    if (t.t === 'NEWLINE') { this.next(); return; }
    if (t.t === 'NAME') {
      switch (t.v) {
        case 'if': out.push(this.parseIf()); return;
        case 'while': out.push(this.parseWhile()); return;
        case 'for': out.push(this.parseFor()); return;
        case 'def': out.push(this.parseDef()); return;
        case 'class': out.push(this.parseClass()); return;
        case 'try': out.push(this.parseTry()); return;
        case 'with': case 'async': case 'global': case 'nonlocal': case 'yield': case 'await':
          this.fail('SyntaxError', t, UNSUPPORTED[t.v]);
      }
    }
    if (t.t === 'OP' && t.v === '@') this.fail('SyntaxError', t, "Snek does not support decorators ('@').");
    this.parseSimpleLine(out);
  }

  parseSimpleLine(out: Node[]): void {
    out.push(this.parseSimple());
    while (this.isOp(';')) {
      this.next();
      if (this.peek().t === 'NEWLINE') break;
      out.push(this.parseSimple());
    }
    const t = this.peek();
    if (t.t === 'NEWLINE') this.next();
    else if (t.t !== 'EOF') this.unexpected(t);
  }

  parseBlock(what: string, headerLine: number): Node[] {
    this.expectOp(':');
    const body: Node[] = [];
    if (this.peek().t === 'NEWLINE') {
      this.next();
      const t = this.peek();
      if (t.t !== 'INDENT') {
        this.fail('IndentationError', t, `Expected an indented block after ${what} on line ${headerLine}: indent the next line.`);
      }
      this.next();
      while (this.peek().t !== 'DEDENT' && this.peek().t !== 'EOF') this.parseStatement(body);
      if (this.peek().t === 'DEDENT') this.next();
    } else {
      this.parseSimpleLine(body);
    }
    return body;
  }

  parseIf(): Node {
    const t = this.next(); // if / elif
    const test = this.parseTest();
    const body = this.parseBlock(`'${t.v}'`, t.line);
    let orelse: Node[] = [];
    if (this.isKw('elif')) {
      orelse = [this.parseIf()];
    } else if (this.isKw('else')) {
      const e = this.next();
      orelse = this.parseBlock("'else'", e.line);
    }
    return mk('if', t, { test, body, orelse });
  }

  parseWhile(): Node {
    const t = this.next();
    const test = this.parseTest();
    this.loop++;
    const body = this.parseBlock("'while'", t.line);
    this.loop--;
    let orelse: Node[] = [];
    if (this.isKw('else')) {
      const e = this.next();
      orelse = this.parseBlock("'else'", e.line);
    }
    return mk('while', t, { test, body, orelse });
  }

  parseFor(): Node {
    const t = this.next();
    const target = this.parseTargetList();
    this.expectKw('in');
    const iter = this.parseTestList();
    this.loop++;
    const body = this.parseBlock("'for'", t.line);
    this.loop--;
    let orelse: Node[] = [];
    if (this.isKw('else')) {
      const e = this.next();
      orelse = this.parseBlock("'else'", e.line);
    }
    return mk('for', t, { target, iter, body, orelse });
  }

  parseParams(closer: string): any[] {
    const params: any[] = [];
    const seen = new Set<string>();
    let sawDefault = false;
    while (!(closer === ')' ? this.isOp(')') : this.isOp(':'))) {
      const t = this.peek();
      if (this.isOp('**')) this.fail('SyntaxError', t, "Snek does not support '**' parameters.");
      let star = false;
      if (this.isOp('*')) {
        this.next();
        star = true;
      }
      const nt = this.expectName();
      if (seen.has(nt.v)) this.fail('SyntaxError', nt, `The parameter '${nt.v}' appears twice.`);
      seen.add(nt.v);
      if (closer === ')' && this.isOp(':')) {
        this.next();
        this.parseTest(); // annotation, ignored
      }
      let def: Node | null = null;
      if (this.isOp('=')) {
        if (star) this.fail('SyntaxError', t, 'A *parameter cannot have a default value.');
        this.next();
        def = this.parseTest();
        sawDefault = true;
      } else if (sawDefault && !star) {
        this.fail('SyntaxError', nt, 'A parameter without a default cannot follow one with a default.');
      }
      params.push({ name: nt.v, def, star, line: nt.line, col: nt.col });
      if (this.isOp(',')) this.next();
      else break;
    }
    return params;
  }

  parseDef(): Node {
    const t = this.next();
    const nt = this.expectName();
    this.expectOp('(', 'after the function name, ');
    const params = this.parseParams(')');
    this.expectOp(')', 'to close the parameters, ');
    if (this.isOp('->')) {
      this.next();
      this.parseTest();
    }
    const [inFunc, loop] = [this.inFunc, this.loop];
    this.inFunc = 1;
    this.loop = 0;
    const body = this.parseBlock(`'def ${nt.v}'`, t.line);
    this.inFunc = inFunc;
    this.loop = loop;
    return mk('def', t, { name: nt.v, params, body });
  }

  parseClass(): Node {
    const t = this.next();
    const nt = this.expectName();
    if (this.isOp('(')) {
      this.next();
      if (!this.isOp(')')) this.fail('SyntaxError', this.peek(), 'Snek classes cannot inherit from other classes.');
      this.next();
    }
    const [inFunc, loop] = [this.inFunc, this.loop];
    this.inFunc = 0;
    this.loop = 0;
    const body = this.parseBlock(`'class ${nt.v}'`, t.line);
    this.inFunc = inFunc;
    this.loop = loop;
    return mk('class', t, { name: nt.v, body });
  }

  parseTry(): Node {
    const t = this.next();
    const body = this.parseBlock("'try'", t.line);
    const handlers: any[] = [];
    let orelse: Node[] = [];
    let final: Node[] = [];
    while (this.isKw('except')) {
      const e = this.next();
      let types: Node | null = null;
      let name: string | null = null;
      if (!this.isOp(':')) {
        types = this.parseTest();
        if (this.isKw('as')) {
          this.next();
          name = this.expectName().v;
        }
      }
      const hb = this.parseBlock("'except'", e.line);
      handlers.push({ types, name, body: hb, line: e.line, col: e.col });
    }
    if (handlers.length > 0 && this.isKw('else')) {
      const e = this.next();
      orelse = this.parseBlock("'else'", e.line);
    }
    if (this.isKw('finally')) {
      const e = this.next();
      final = this.parseBlock("'finally'", e.line);
    }
    if (handlers.length === 0 && final.length === 0) {
      this.fail('SyntaxError', this.peek(), "A 'try' block needs an 'except' or 'finally' block after it.");
    }
    return mk('try', t, { body, handlers, orelse, final });
  }

  parseSimple(): Node {
    const t = this.peek();
    if (t.t === 'NAME') {
      switch (t.v) {
        case 'pass': this.next(); return mk('pass', t, {});
        case 'break': case 'continue':
          if (!this.loop) this.fail('SyntaxError', t, `'${t.v}' only works inside a loop.`);
          this.next();
          return mk(t.v, t, {});
        case 'return': {
          if (!this.inFunc) this.fail('SyntaxError', t, "'return' only works inside a function.");
          this.next();
          let value: Node | null = null;
          if (this.peek().t !== 'NEWLINE' && this.peek().t !== 'EOF' && !this.isOp(';')) value = this.parseTestList();
          return mk('return', t, { value });
        }
        case 'del': {
          this.next();
          const first = this.parseBitOr();
          const targets = [first];
          while (this.isOp(',')) {
            this.next();
            if (this.peek().t === 'NEWLINE') break;
            targets.push(this.parseBitOr());
          }
          return mk('del', t, { targets: targets.map((x) => this.toTarget(x, true)) });
        }
        case 'assert': {
          this.next();
          const test = this.parseTest();
          let msg: Node | null = null;
          if (this.isOp(',')) {
            this.next();
            msg = this.parseTest();
          }
          return mk('assert', t, { test, msg });
        }
        case 'raise': {
          this.next();
          let exc: Node | null = null;
          if (this.peek().t !== 'NEWLINE' && this.peek().t !== 'EOF' && !this.isOp(';')) {
            exc = this.parseTest();
            if (this.isKw('from')) this.fail('SyntaxError', this.peek(), "Snek does not support 'raise ... from ...'.");
          }
          return mk('raise', t, { exc });
        }
        case 'import': return this.parseImport();
        case 'from': return this.parseFrom();
        case 'print': {
          const n = this.peekAt(1);
          if (n.t === 'STR' || n.t === 'NUM' || n.t === 'FLOAT' || (n.t === 'NAME' && !KEYWORDS.has(n.v))) {
            this.fail('SyntaxError', t, 'Missing parentheses: write print(...) with brackets around what you print.');
          }
          break;
        }
        case 'global': case 'nonlocal': case 'with': case 'yield': case 'async': case 'await':
          this.fail('SyntaxError', t, UNSUPPORTED[t.v]);
      }
    }
    // expression, assignment or augmented assignment
    const first = this.parseTestList();
    const op = this.peek();
    if (op.t === 'OP' && op.v === '=') {
      const targets: Node[] = [this.toTarget(first)];
      let value: Node = first;
      while (this.isOp('=')) {
        this.next();
        value = this.parseTestList();
        if (this.isOp('=')) targets.push(this.toTarget(value));
      }
      return mk('assign', t, { targets, value });
    }
    if (op.t === 'OP' && AUG_OPS.indexOf(op.v) >= 0) {
      this.next();
      if (first.k === 'tuple' || first.k === 'list') this.fail('SyntaxError', op, 'You cannot use an augmented assignment such as += on several targets at once.');
      const target = this.toTarget(first);
      const value = this.parseTestList();
      return mk('aug', t, { target, op: op.v.slice(0, -1), value });
    }
    if (op.t === 'OP' && op.v === ':' && first.k === 'name') {
      // annotated assignment: x: int = 3
      this.next();
      this.parseTest();
      if (this.isOp('=')) {
        this.next();
        const value = this.parseTestList();
        return mk('assign', t, { targets: [this.toTarget(first)], value });
      }
      return mk('pass', t, {});
    }
    return mk('expr', t, { e: first });
  }

  parseImport(): Node {
    const t = this.next();
    const mods: any[] = [];
    do {
      if (mods.length) this.next();
      const nt = this.expectName();
      let name = nt.v;
      while (this.isOp('.')) {
        this.next();
        name += '.' + this.expectName().v;
      }
      let as: string | null = null;
      if (this.isKw('as')) {
        this.next();
        as = this.expectName().v;
      }
      this.checkModule(name, nt);
      mods.push({ name, as });
    } while (this.isOp(','));
    return mk('import', t, { mods });
  }

  checkModule(name: string, t: Token): void {
    const root = name.split('.')[0];
    if (ALLOWED_MODULES.indexOf(name) < 0) {
      throw new CompileError('NotAllowed', t.line, t.col, `Importing '${root}' is not allowed: Snek only has the modules math, collections and heapq.`);
    }
  }

  parseFrom(): Node {
    const t = this.next();
    const nt = this.expectName();
    let name = nt.v;
    while (this.isOp('.')) {
      this.next();
      name += '.' + this.expectName().v;
    }
    this.checkModule(name, nt);
    this.expectKw('import');
    const names: any[] = [];
    if (this.isOp('*')) this.fail('SyntaxError', this.peek(), "Snek does not support 'import *': name what you need.");
    const paren = this.isOp('(');
    if (paren) this.next();
    do {
      if (names.length) this.next();
      if (paren && this.isOp(')')) break;
      const it = this.expectName();
      let as: string | null = null;
      if (this.isKw('as')) {
        this.next();
        as = this.expectName().v;
      }
      names.push({ name: it.v, as, line: it.line, col: it.col });
    } while (this.isOp(','));
    if (paren) this.expectOp(')');
    return mk('from', t, { mod: name, names });
  }

  toTarget(e: Node, forDel = false): Node {
    switch (e.k) {
      case 'name': case 'attr': case 'sub':
        return e;
      case 'tuple': case 'list':
        if (forDel) return e;
        return { ...e, k: 'tuple', elts: e.elts.map((x: Node) => this.toTarget(x)) };
      case 'num': case 'float': case 'str': case 'fstr': case 'const':
        throw new CompileError('SyntaxError', e.line, e.col, 'You cannot assign to a literal value; the left side of = must be a name.');
      case 'call':
        throw new CompileError('SyntaxError', e.line, e.col, 'You cannot assign to a function call; the left side of = must be a name.');
      default:
        throw new CompileError('SyntaxError', e.line, e.col, 'You cannot assign to this expression; the left side of = must be a name.');
    }
  }

  // for-loop and comprehension targets: a comma list of bit-or level expressions
  parseTargetList(): Node {
    const first = this.parseBitOr();
    if (!this.isOp(',')) return this.toTarget(first);
    const elts = [first];
    while (this.isOp(',')) {
      this.next();
      if (this.isKw('in')) break;
      elts.push(this.parseBitOr());
    }
    return this.toTarget(mk('tuple', first, { elts }));
  }

  // ---- expressions ----
  parseTestList(): Node {
    const first = this.parseTest();
    if (!this.isOp(',')) return first;
    const elts = [first];
    while (this.isOp(',')) {
      this.next();
      const t = this.peek();
      if (t.t === 'NEWLINE' || t.t === 'EOF' || (t.t === 'OP' && (t.v === '=' || t.v === ')' || t.v === ']' || t.v === '}' || t.v === ':' || t.v === ';')) || (t.t === 'NAME' && t.v === 'in')) break;
      elts.push(this.parseTest());
    }
    return mk('tuple', first, { elts });
  }

  parseTest(): Node {
    const t = this.peek();
    if (t.t === 'NAME' && t.v === 'lambda') return this.parseLambda();
    const e = this.parseOr();
    if (this.isKw('if')) {
      this.next();
      const c = this.parseOr();
      this.expectKw('else');
      const b = this.parseTest();
      return mk('ifexp', e, { c, a: e, b });
    }
    return e;
  }

  parseLambda(): Node {
    const t = this.next();
    const params = this.parseParams(':');
    this.expectOp(':');
    const body = this.parseTest();
    return mk('lambda', t, { params, body });
  }

  parseOr(): Node {
    let l = this.parseAnd();
    while (this.isKw('or')) {
      this.next();
      const r = this.parseAnd();
      l = mk('bool', l, { op: 'or', l, r });
    }
    return l;
  }
  parseAnd(): Node {
    let l = this.parseNot();
    while (this.isKw('and')) {
      this.next();
      const r = this.parseNot();
      l = mk('bool', l, { op: 'and', l, r });
    }
    return l;
  }
  parseNot(): Node {
    if (this.isKw('not')) {
      const t = this.next();
      const e = this.parseNot();
      return mk('not', t, { e });
    }
    return this.parseComparison();
  }

  parseComparison(): Node {
    const first = this.parseBitOr();
    const ops: string[] = [];
    const rest: Node[] = [];
    while (true) {
      const t = this.peek();
      let op: string | null = null;
      if (t.t === 'OP' && (t.v === '<' || t.v === '>' || t.v === '==' || t.v === '>=' || t.v === '<=' || t.v === '!=')) {
        op = t.v;
        this.next();
      } else if (t.t === 'NAME' && t.v === 'in') {
        op = 'in';
        this.next();
      } else if (t.t === 'NAME' && t.v === 'not' && this.peekAt(1).t === 'NAME' && this.peekAt(1).v === 'in') {
        this.next();
        this.next();
        op = 'not in';
      } else if (t.t === 'NAME' && t.v === 'is') {
        this.next();
        if (this.isKw('not')) {
          this.next();
          op = 'is not';
        } else op = 'is';
      }
      if (op === null) break;
      ops.push(op);
      rest.push(this.parseBitOr());
    }
    if (ops.length === 0) return first;
    return mk('cmp', first, { first, ops, rest });
  }

  binLevel(sub: () => Node, ops: string[]): Node {
    let l = sub.call(this);
    while (true) {
      const t = this.peek();
      if (t.t === 'OP' && ops.indexOf(t.v) >= 0) {
        this.next();
        const r = sub.call(this);
        l = mk('binop', l, { op: t.v, l, r });
      } else break;
    }
    return l;
  }
  parseBitOr(): Node { return this.binLevel(this.parseBitXor, ['|']); }
  parseBitXor(): Node { return this.binLevel(this.parseBitAnd, ['^']); }
  parseBitAnd(): Node { return this.binLevel(this.parseShift, ['&']); }
  parseShift(): Node { return this.binLevel(this.parseArith, ['<<', '>>']); }
  parseArith(): Node { return this.binLevel(this.parseTerm, ['+', '-']); }
  parseTerm(): Node { return this.binLevel(this.parseFactor, ['*', '/', '//', '%', '@']); }

  parseFactor(): Node {
    const t = this.peek();
    if (t.t === 'OP' && (t.v === '-' || t.v === '+' || t.v === '~')) {
      this.next();
      const e = this.parseFactor();
      return mk('unary', t, { op: t.v, e });
    }
    return this.parsePower();
  }

  parsePower(): Node {
    const base = this.parseAtomExpr();
    if (this.isOp('**')) {
      this.next();
      const r = this.parseFactor();
      return mk('binop', base, { op: '**', l: base, r });
    }
    return base;
  }

  parseAtomExpr(): Node {
    let e = this.parseAtom();
    while (true) {
      const t = this.peek();
      if (t.t !== 'OP') break;
      if (t.v === '.') {
        this.next();
        const nt = this.peek();
        if (nt.t !== 'NAME' || KEYWORDS.has(nt.v)) this.fail('SyntaxError', nt, `Expected an attribute name after '.' but found ${this.describe(nt)}.`);
        this.next();
        if (/^__.*__$/.test(nt.v)) {
          throw new CompileError('NotAllowed', nt.line, nt.col, `Snek does not allow access to '.${nt.v}', because it could reach outside your program.`);
        }
        e = mk('attr', e, { e, name: nt.v });
      } else if (t.v === '(') {
        this.next();
        e = this.parseCallArgs(e);
      } else if (t.v === '[') {
        this.next();
        const idx = this.parseSubscript();
        this.expectOp(']', 'to close the index, ');
        e = mk('sub', e, { e, idx });
      } else break;
    }
    return e;
  }

  parseCallArgs(f: Node): Node {
    const args: Node[] = [];
    const kws: { name: string; v: Node }[] = [];
    let hasStar = false;
    while (!this.isOp(')')) {
      const t = this.peek();
      if (t.t === 'EOF' || t.t === 'NEWLINE') break;
      if (this.isOp('**')) this.fail('SyntaxError', t, "Snek does not support '**' in calls.");
      if (this.isOp('*')) {
        this.next();
        const v = this.parseTest();
        args.push(mk('star', t, { e: v }));
        hasStar = true;
      } else if (t.t === 'NAME' && !KEYWORDS.has(t.v) && this.peekAt(1).t === 'OP' && this.peekAt(1).v === '=') {
        this.next();
        this.next();
        const v = this.parseTest();
        if (kws.some((x) => x.name === t.v)) this.fail('SyntaxError', t, `The keyword '${t.v}' is given twice.`);
        kws.push({ name: t.v, v });
      } else {
        if (kws.length > 0) this.fail('SyntaxError', t, 'A positional argument cannot follow a keyword argument.');
        const v = this.parseTest();
        if (this.isKw('for')) {
          const gens = this.parseCompFor();
          args.push(mk('comp', v, { kind: 'gen', elt: v, val: null, gens }));
        } else args.push(v);
      }
      if (this.isOp(',')) this.next();
      else break;
    }
    this.expectOp(')', 'to close the call, ');
    return mk('call', f, { f, args, kws, hasStar });
  }

  parseSubscript(): Node {
    const items: Node[] = [];
    let isTuple = false;
    while (true) {
      items.push(this.parseSliceItem());
      if (this.isOp(',')) {
        this.next();
        isTuple = true;
        if (this.isOp(']')) break;
      } else break;
    }
    if (!isTuple) return items[0];
    return mk('tuple', items[0], { elts: items });
  }

  parseSliceItem(): Node {
    const t = this.peek();
    let lo: Node | null = null;
    if (!this.isOp(':')) {
      lo = this.parseTest();
      if (!this.isOp(':')) return lo;
    }
    this.expectOp(':');
    let hi: Node | null = null;
    let step: Node | null = null;
    if (!this.isOp(':') && !this.isOp(']') && !this.isOp(',')) hi = this.parseTest();
    if (this.isOp(':')) {
      this.next();
      if (!this.isOp(']') && !this.isOp(',')) step = this.parseTest();
    }
    return mk('slice', t, { lo, hi, step });
  }

  parseCompFor(): any[] {
    const gens: any[] = [];
    while (this.isKw('for')) {
      this.next();
      const target = this.parseTargetList();
      this.expectKw('in');
      const iter = this.parseOr();
      const ifs: Node[] = [];
      while (this.isKw('if')) {
        this.next();
        ifs.push(this.parseOr());
      }
      gens.push({ target, iter, ifs });
    }
    return gens;
  }

  parseAtom(): Node {
    const t = this.peek();
    switch (t.t) {
      case 'NUM': this.next(); return mk('num', t, { v: t.v });
      case 'FLOAT': this.next(); return mk('float', t, { v: t.v });
      case 'STR': return this.parseStrings();
      case 'NAME': {
        if (t.v === 'None') { this.next(); return mk('const', t, { v: null }); }
        if (t.v === 'True') { this.next(); return mk('const', t, { v: true }); }
        if (t.v === 'False') { this.next(); return mk('const', t, { v: false }); }
        if (t.v === 'lambda') return this.parseLambda();
        if (UNSUPPORTED[t.v]) this.fail('SyntaxError', t, UNSUPPORTED[t.v]);
        if (KEYWORDS.has(t.v)) this.unexpected(t);
        this.next();
        return mk('name', t, { id: t.v });
      }
      case 'OP': {
        if (t.v === '(') {
          this.next();
          if (this.isOp(')')) { this.next(); return mk('tuple', t, { elts: [] }); }
          const first = this.parseTest();
          if (this.isKw('for')) {
            const gens = this.parseCompFor();
            this.expectOp(')', 'to close the generator, ');
            return mk('comp', t, { kind: 'gen', elt: first, val: null, gens });
          }
          if (this.isOp(',')) {
            const elts = [first];
            while (this.isOp(',')) {
              this.next();
              if (this.isOp(')')) break;
              elts.push(this.parseTest());
            }
            this.expectOp(')', 'to close the tuple, ');
            return mk('tuple', t, { elts });
          }
          this.expectOp(')', 'to close the bracket, ');
          return first;
        }
        if (t.v === '[') {
          this.next();
          if (this.isOp(']')) { this.next(); return mk('list', t, { elts: [] }); }
          const first = this.parseTest();
          if (this.isKw('for')) {
            const gens = this.parseCompFor();
            this.expectOp(']', 'to close the list, ');
            return mk('comp', t, { kind: 'list', elt: first, val: null, gens });
          }
          const elts = [first];
          while (this.isOp(',')) {
            this.next();
            if (this.isOp(']')) break;
            elts.push(this.parseTest());
          }
          this.expectOp(']', 'to close the list, ');
          return mk('list', t, { elts });
        }
        if (t.v === '{') {
          this.next();
          if (this.isOp('}')) { this.next(); return mk('dict', t, { keys: [], values: [] }); }
          if (this.isOp('**')) this.fail('SyntaxError', this.peek(), "Snek does not support '**' in dict displays.");
          const first = this.parseTest();
          if (this.isOp(':')) {
            this.next();
            const fv = this.parseTest();
            if (this.isKw('for')) {
              const gens = this.parseCompFor();
              this.expectOp('}', 'to close the dict, ');
              return mk('comp', t, { kind: 'dict', elt: first, val: fv, gens });
            }
            const keys = [first];
            const values = [fv];
            while (this.isOp(',')) {
              this.next();
              if (this.isOp('}')) break;
              const k = this.parseTest();
              this.expectOp(':', 'between a dict key and its value, ');
              keys.push(k);
              values.push(this.parseTest());
            }
            this.expectOp('}', 'to close the dict, ');
            return mk('dict', t, { keys, values });
          }
          if (this.isKw('for')) {
            const gens = this.parseCompFor();
            this.expectOp('}', 'to close the set, ');
            return mk('comp', t, { kind: 'set', elt: first, val: null, gens });
          }
          const elts = [first];
          while (this.isOp(',')) {
            this.next();
            if (this.isOp('}')) break;
            elts.push(this.parseTest());
          }
          this.expectOp('}', 'to close the set, ');
          return mk('set', t, { elts });
        }
        break;
      }
    }
    this.unexpected(t);
  }

  parseStrings(): Node {
    const first = this.peek();
    const parts: any[] = [];
    let anyF = false;
    while (this.peek().t === 'STR') {
      const t = this.next();
      if (t.f) {
        anyF = true;
        for (const p of parseFString(t.v, t.line, t.col, !!t.raw)) parts.push(p);
      } else {
        parts.push(t.raw ? t.v : decodeEscapes(t.v, t.line, t.col));
      }
    }
    if (!anyF) return mk('str', first, { v: parts.join('') });
    // merge adjacent literals
    const merged: any[] = [];
    for (const p of parts) {
      if (typeof p === 'string' && typeof merged[merged.length - 1] === 'string') merged[merged.length - 1] += p;
      else merged.push(p);
    }
    return mk('fstr', first, { parts: merged });
  }
}

// Splits an f-string body into literal strings and { e, conv, spec } replacement fields.
function parseFString(body: string, line: number, col: number, raw: boolean): any[] {
  const parts: any[] = [];
  let lit = '';
  let i = 0;
  const n = body.length;
  const flush = () => {
    if (lit !== '') parts.push(raw ? lit : decodeEscapes(lit, line, col));
    lit = '';
  };
  while (i < n) {
    const c = body[i];
    if (c === '{') {
      if (body[i + 1] === '{') { lit += '{'; i += 2; continue; }
      flush();
      // find the end of the expression
      let j = i + 1;
      let depth = 0;
      let quote = '';
      let exprEnd = -1;
      while (j < n) {
        const d = body[j];
        if (quote) {
          if (d === '\\') j++;
          else if (d === quote) quote = '';
        } else if (d === '"' || d === "'") quote = d;
        else if (d === '(' || d === '[' || d === '{') depth++;
        else if (d === ')' || d === ']' || (d === '}' && depth > 0)) depth--;
        else if (depth === 0 && (d === '}' || d === ':' || (d === '!' && body[j + 1] !== '='))) { exprEnd = j; break; }
        j++;
      }
      if (exprEnd < 0) throw new CompileError('SyntaxError', line, col, "This f-string has a '{' that is never closed.");
      const exprSrc = body.slice(i + 1, exprEnd);
      if (exprSrc.trim() === '') throw new CompileError('SyntaxError', line, col, 'This f-string has an empty {} with no expression inside.');
      let conv: string | null = null;
      let spec: any[] | null = null;
      let k = exprEnd;
      if (body[k] === '!') {
        conv = body[k + 1];
        k += 2;
        if (conv !== 'r' && conv !== 's' && conv !== 'a') throw new CompileError('SyntaxError', line, col, "An f-string conversion must be !r, !s or !a.");
      }
      if (body[k] === ':') {
        // spec runs to the matching '}'
        let m = k + 1;
        let d2 = 0;
        while (m < n) {
          if (body[m] === '{') d2++;
          else if (body[m] === '}') {
            if (d2 === 0) break;
            d2--;
          }
          m++;
        }
        if (m >= n) throw new CompileError('SyntaxError', line, col, "This f-string has a '{' that is never closed.");
        spec = parseFString(body.slice(k + 1, m), line, col, true);
        k = m;
      }
      if (body[k] !== '}') throw new CompileError('SyntaxError', line, col, "This f-string has a '{' that is never closed.");
      const toks = tokenize('(' + exprSrc.replace(/\n/g, ' ') + ')', line);
      const ps = new Parser(toks);
      const e = ps.parseTestList();
      if (ps.peek().t !== 'NEWLINE' && ps.peek().t !== 'EOF') ps.unexpected(ps.peek());
      adjustPos(e, line, col);
      parts.push({ e, conv, spec });
      i = k + 1;
      continue;
    }
    if (c === '}') {
      if (body[i + 1] === '}') { lit += '}'; i += 2; continue; }
      throw new CompileError('SyntaxError', line, col, "This f-string has a single '}' ; write '}}' for a literal brace.");
    }
    lit += c;
    i++;
  }
  flush();
  return parts;
}

function adjustPos(e: Node, line: number, col: number): void {
  // nodes parsed from an f-string field report the line of the f-string itself
  const seen = new Set<any>();
  const walk = (x: any) => {
    if (!x || typeof x !== 'object' || seen.has(x)) return;
    seen.add(x);
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (typeof x.k === 'string') { x.line = line; x.col = col; }
    for (const key in x) {
      if (key !== 'line' && key !== 'col') walk(x[key]);
    }
  };
  walk(e);
}

export function parseProgram(src: string): Node[] {
  const toks = tokenize(src);
  return new Parser(toks).parseModule();
}
