// Tokenizer for Snek: Python-style indentation, strings, numbers, operators.
import { CompileError } from './types.ts';

export interface Token {
  t: 'NAME' | 'NUM' | 'FLOAT' | 'STR' | 'OP' | 'NEWLINE' | 'INDENT' | 'DEDENT' | 'EOF';
  v: any;
  line: number;
  col: number;
  f?: boolean; // f-string
  raw?: boolean; // raw string (no escapes)
}

const MAX_INT = 9007199254740991;

const OPS3 = ['**=', '//=', '>>=', '<<='];
const OPS2 = ['**', '//', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '->', ':='];
const OPS1 = '+-*/%()[]{},:.;=<>&|^~@';

function isIdStart(c: string): boolean {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c > '\x7f';
}
function isDigit(c: string): boolean {
  return c >= '0' && c <= '9';
}
function isIdPart(c: string): boolean {
  return isIdStart(c) || isDigit(c);
}

export function decodeEscapes(s: string, line: number, col: number): string {
  if (s.indexOf('\\') < 0) return s;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '\\') { out += c; continue; }
    i++;
    const d = s[i];
    switch (d) {
      case 'n': out += '\n'; break;
      case 't': out += '\t'; break;
      case 'r': out += '\r'; break;
      case '0': out += '\0'; break;
      case '\\': out += '\\'; break;
      case "'": out += "'"; break;
      case '"': out += '"'; break;
      case 'a': out += '\x07'; break;
      case 'b': out += '\b'; break;
      case 'f': out += '\f'; break;
      case 'v': out += '\v'; break;
      case '\n': break;
      case 'x': {
        const h = s.slice(i + 1, i + 3);
        if (!/^[0-9a-fA-F]{2}$/.test(h)) throw new CompileError('SyntaxError', line, col, 'This string has a bad \\x escape.');
        out += String.fromCharCode(parseInt(h, 16));
        i += 2;
        break;
      }
      case 'u': {
        const h = s.slice(i + 1, i + 5);
        if (!/^[0-9a-fA-F]{4}$/.test(h)) throw new CompileError('SyntaxError', line, col, 'This string has a bad \\u escape.');
        out += String.fromCharCode(parseInt(h, 16));
        i += 4;
        break;
      }
      default:
        out += '\\' + (d === undefined ? '' : d);
    }
  }
  return out;
}

export function tokenize(src: string, firstLine = 1): Token[] {
  const toks: Token[] = [];
  const n = src.length;
  let i = 0;
  let line = firstLine;
  let lineStart = 0;
  const indents: number[] = [0];
  const parens: { ch: string; line: number; col: number }[] = [];
  let atLineStart = true;
  const err = (kind: any, l: number, c: number, m: string) => new CompileError(kind, l, c, m);

  while (i < n) {
    if (atLineStart && parens.length === 0) {
      // measure indentation
      let width = 0;
      let j = i;
      while (j < n) {
        const c = src[j];
        if (c === ' ') width++;
        else if (c === '\t') width = (Math.floor(width / 8) + 1) * 8;
        else if (c === '\f') width = 0;
        else break;
        j++;
      }
      if (j >= n) { i = j; break; }
      const c = src[j];
      if (c === '\n' || c === '\r' || c === '#') {
        // blank or comment-only line
        while (j < n && src[j] !== '\n') j++;
        if (j < n) { j++; line++; lineStart = j; }
        i = j;
        continue;
      }
      if (c === '\\' && (src[j + 1] === '\n' || (src[j + 1] === '\r' && src[j + 2] === '\n'))) {
        // a line holding only a continuation: treat as blank
      }
      const col = j - lineStart + 1;
      const top = indents[indents.length - 1];
      if (width > top) {
        indents.push(width);
        toks.push({ t: 'INDENT', v: null, line, col });
      } else if (width < top) {
        while (indents[indents.length - 1] > width) {
          indents.pop();
          toks.push({ t: 'DEDENT', v: null, line, col });
        }
        if (indents[indents.length - 1] !== width) {
          throw err('IndentationError', line, col, 'Unindent does not match any outer indent level: line this up with an earlier line.');
        }
      }
      i = j;
      atLineStart = false;
    }
    const c = src[i];
    const col = i - lineStart + 1;
    if (c === ' ' || c === '\t' || c === '\f') { i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '#') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '\n') {
      i++;
      if (parens.length === 0) {
        const last = toks[toks.length - 1];
        if (last && last.t !== 'NEWLINE' && last.t !== 'INDENT' && last.t !== 'DEDENT') {
          toks.push({ t: 'NEWLINE', v: null, line, col });
        }
        atLineStart = true;
      }
      line++;
      lineStart = i;
      continue;
    }
    if (c === '\\') {
      let j = i + 1;
      if (src[j] === '\r') j++;
      if (src[j] === '\n') {
        i = j + 1;
        line++;
        lineStart = i;
        continue;
      }
      throw err('SyntaxError', line, col, 'A backslash must be the last character on its line.');
    }
    // numbers
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1] || ''))) {
      let j = i;
      let isFloat = false;
      let text: string;
      if (c === '0' && /[xXoObB]/.test(src[i + 1] || '')) {
        const base = /[xX]/.test(src[i + 1]) ? 16 : /[oO]/.test(src[i + 1]) ? 8 : 2;
        j = i + 2;
        while (j < n && /[0-9a-fA-F_]/.test(src[j])) j++;
        text = src.slice(i + 2, j).replace(/_/g, '');
        const v = parseInt(text, base);
        if (text === '' || Number.isNaN(v)) throw err('SyntaxError', line, col, 'This number is not written correctly.');
        if (v > MAX_INT) throw err('OverflowError', line, col, 'This number is too big: Snek ints stay within 9007199254740991.');
        toks.push({ t: 'NUM', v, line, col });
        i = j;
        continue;
      }
      while (j < n && (isDigit(src[j]) || src[j] === '_')) j++;
      if (src[j] === '.') {
        isFloat = true;
        j++;
        while (j < n && (isDigit(src[j]) || src[j] === '_')) j++;
      }
      if ((src[j] === 'e' || src[j] === 'E') && (isDigit(src[j + 1] || '') || ((src[j + 1] === '+' || src[j + 1] === '-') && isDigit(src[j + 2] || '')))) {
        isFloat = true;
        j += 2;
        while (j < n && isDigit(src[j])) j++;
      }
      text = src.slice(i, j).replace(/_/g, '');
      if (!isFloat && /^0\d/.test(text)) throw err('SyntaxError', line, col, 'A number cannot start with 0 unless it is 0 itself.');
      if (j < n && isIdStart(src[j])) throw err('SyntaxError', line, col, 'A number cannot be followed directly by letters.');
      const v = Number(text);
      if (isFloat) toks.push({ t: 'FLOAT', v, line, col });
      else {
        if (v > MAX_INT) throw err('OverflowError', line, col, 'This number is too big: Snek ints stay within 9007199254740991.');
        toks.push({ t: 'NUM', v, line, col });
      }
      i = j;
      continue;
    }
    // names and string prefixes
    if (isIdStart(c)) {
      let j = i;
      while (j < n && isIdPart(src[j])) j++;
      const word = src.slice(i, j);
      const q = src[j];
      if ((q === '"' || q === "'") && /^(r|f|rf|fr|u)$/i.test(word)) {
        const lw = word.toLowerCase();
        i = j;
        i = readString(i, lw.indexOf('f') >= 0, lw.indexOf('r') >= 0, col);
        continue;
      }
      toks.push({ t: 'NAME', v: word, line, col });
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      i = readString(i, false, false, col);
      continue;
    }
    // operators
    let op = '';
    const s3 = src.substr(i, 3);
    const s2 = src.substr(i, 2);
    if (OPS3.indexOf(s3) >= 0) op = s3;
    else if (OPS2.indexOf(s2) >= 0) op = s2;
    else if (OPS1.indexOf(c) >= 0) op = c;
    if (op === '') {
      if (c === '!') throw err('SyntaxError', line, col, "Unexpected '!': use 'not' or '!=' instead.");
      if (c === '$' || c === '?' || c === '`') throw err('SyntaxError', line, col, `Unexpected character '${c}'.`);
      throw err('SyntaxError', line, col, `Unexpected character '${c}'.`);
    }
    if (op === '(' || op === '[' || op === '{') parens.push({ ch: op, line, col });
    else if (op === ')' || op === ']' || op === '}') {
      const open = parens.pop();
      const want = op === ')' ? '(' : op === ']' ? '[' : '{';
      if (!open || open.ch !== want) {
        throw err('SyntaxError', line, col, `Unmatched '${op}': there is no matching '${want}'.`);
      }
    }
    toks.push({ t: 'OP', v: op, line, col });
    i += op.length;
  }
  if (parens.length > 0) {
    const p = parens[parens.length - 1];
    throw err('SyntaxError', p.line, p.col, `'${p.ch}' was never closed.`);
  }
  const last = toks[toks.length - 1];
  if (last && last.t !== 'NEWLINE' && last.t !== 'DEDENT' && last.t !== 'INDENT') {
    toks.push({ t: 'NEWLINE', v: null, line, col: i - lineStart + 1 });
  }
  while (indents.length > 1) {
    indents.pop();
    toks.push({ t: 'DEDENT', v: null, line, col: 1 });
  }
  toks.push({ t: 'EOF', v: null, line, col: i - lineStart + 1 });
  return toks;

  function readString(start: number, isF: boolean, isRaw: boolean, tcol: number): number {
    const q = src[start];
    const startLine = line;
    let triple = false;
    let j = start + 1;
    if (src[j] === q && src[j + 1] === q) { triple = true; j += 2; }
    const bodyStart = j;
    while (true) {
      if (j >= n) throw err('SyntaxError', startLine, tcol, 'This string is never closed.');
      const ch = src[j];
      if (ch === '\\') {
        if (src[j + 1] === '\n') { line++; lineStart = j + 2; }
        j += 2;
        continue;
      }
      if (ch === '\n') {
        if (!triple) throw err('SyntaxError', startLine, tcol, 'This string is never closed.');
        line++;
        lineStart = j + 1;
        j++;
        continue;
      }
      if (ch === q) {
        if (!triple) break;
        if (src[j + 1] === q && src[j + 2] === q) break;
      }
      j++;
    }
    const body = src.slice(bodyStart, j);
    const end = j + (triple ? 3 : 1);
    const tok: Token = { t: 'STR', v: body, line: startLine, col: tcol, f: isF, raw: isRaw };
    toks.push(tok);
    return end;
  }
}
