// Number formatting that matches CPython 3.14: float repr, fixed-point rounding, f-string format specs.

export function floatRepr(x: number): string {
  if (x !== x) return 'nan';
  if (x === Infinity) return 'inf';
  if (x === -Infinity) return '-inf';
  if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0';
  const m = /^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(x.toExponential());
  if (!m) return String(x);
  const sign = m[1];
  const digits = m[2] + (m[3] || '');
  const exp = parseInt(m[4], 10);
  if (exp >= -4 && exp < 16) {
    if (exp >= 0) {
      const intPart = digits.length > exp + 1 ? digits.slice(0, exp + 1) : digits + '0'.repeat(exp + 1 - digits.length);
      const frac = digits.length > exp + 1 ? digits.slice(exp + 1) : '0';
      return sign + intPart + '.' + frac;
    }
    return sign + '0.' + '0'.repeat(-exp - 1) + digits;
  }
  const mant = digits.length > 1 ? digits[0] + '.' + digits.slice(1) : digits;
  const e = Math.abs(exp);
  return sign + mant + 'e' + (exp < 0 ? '-' : '+') + (e < 10 ? '0' + e : String(e));
}

// Round |x| to nd decimals, half to even on the exact binary value, and return the digits as a string.
export function fixed(x: number, nd: number): string {
  if (x !== x) return 'nan';
  if (x === Infinity) return 'inf';
  if (x === -Infinity) return '-inf';
  const neg = x < 0 || Object.is(x, -0);
  const a = Math.abs(x);
  let body: string;
  if (a >= 1e21) {
    body = BigInt(a).toString() + (nd > 0 ? '.' + '0'.repeat(nd) : '');
  } else {
    const s = a.toFixed(Math.min(100, nd + 40));
    const dot = s.indexOf('.');
    const intStr = dot < 0 ? s : s.slice(0, dot);
    const frac = dot < 0 ? '' : s.slice(dot + 1);
    const keep = frac.slice(0, nd);
    const rest = frac.slice(nd);
    let digits = BigInt(intStr + keep);
    const first = rest.charCodeAt(0) - 48;
    let up = false;
    if (first > 5) up = true;
    else if (first === 5) {
      if (/[1-9]/.test(rest.slice(1))) up = true;
      else up = (digits & 1n) === 1n;
    }
    if (up) digits += 1n;
    let ds = digits.toString();
    if (nd > 0) {
      if (ds.length <= nd) ds = '0'.repeat(nd - ds.length + 1) + ds;
      body = ds.slice(0, ds.length - nd) + '.' + ds.slice(ds.length - nd);
    } else body = ds;
  }
  return (neg ? '-' : '') + body;
}

export function expFormat(x: number, prec: number, upper: boolean): string {
  if (!isFinite(x)) return x !== x ? 'nan' : x < 0 ? '-inf' : 'inf';
  let s = x.toExponential(Math.min(100, prec));
  s = s.replace(/e([+-])(\d)$/, 'e$10$2');
  return upper ? s.toUpperCase() : s;
}

export interface Spec {
  fill: string;
  align: string;
  sign: string;
  zero: boolean;
  width: number;
  group: string;
  prec: number;
  type: string;
}

export function parseSpec(spec: string): Spec | null {
  if (spec.length > 40) return null;
  const m = /^(?:(.)?([<>^=]))?([+\- ])?(#)?(0)?(\d+)?([,_])?(?:\.(\d+))?([a-zA-Z%])?$/s.exec(spec);
  if (!m) return null;
  return {
    fill: m[1] ?? ' ',
    align: m[2] ?? '',
    sign: m[3] ?? '',
    zero: !!m[5],
    width: m[6] ? parseInt(m[6], 10) : 0,
    group: m[7] ?? '',
    prec: m[8] !== undefined ? parseInt(m[8], 10) : -1,
    type: m[9] ?? '',
  };
}

function groupDigits(intPart: string, sep: string): string {
  let out = '';
  for (let i = 0; i < intPart.length; i++) {
    if (i > 0 && (intPart.length - i) % 3 === 0) out += sep;
    out += intPart[i];
  }
  return out;
}

// Pads a rendered value to spec.width. `numeric` selects right alignment as the default.
export function pad(body: string, sp: Spec, numeric: boolean): string {
  if (body.length >= sp.width) return body;
  const n = sp.width - body.length;
  let align = sp.align;
  if (sp.zero && !sp.align && numeric) {
    // sign-aware zero padding
    const sgn = /^[+\- ]/.test(body) ? body[0] : '';
    return sgn + '0'.repeat(n) + body.slice(sgn.length);
  }
  if (!align) align = numeric ? '>' : '<';
  const f = sp.fill;
  if (align === '<') return body + f.repeat(n);
  if (align === '>') return f.repeat(n) + body;
  if (align === '^') {
    const left = Math.floor(n / 2);
    return f.repeat(left) + body + f.repeat(n - left);
  }
  // '=': pad after the sign
  const sgn = /^[+\- ]/.test(body) ? body[0] : '';
  return sgn + f.repeat(n) + body.slice(sgn.length);
}

// Applies the sign flag and digit grouping to a rendered non-negative-or-negative number.
export function signAndGroup(text: string, sp: Spec): string {
  let neg = false;
  if (text[0] === '-') { neg = true; text = text.slice(1); }
  if (sp.group) {
    const dot = text.indexOf('.');
    const ip = dot < 0 ? text : text.slice(0, dot);
    const rest = dot < 0 ? '' : text.slice(dot);
    if (/^\d+$/.test(ip)) text = groupDigits(ip, sp.group) + rest;
  }
  if (neg) return '-' + text;
  if (sp.sign === '+') return '+' + text;
  if (sp.sign === ' ') return ' ' + text;
  return text;
}
