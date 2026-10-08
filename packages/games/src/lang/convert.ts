// Conversion between JS values and Snek values (SPEC §13.4 table).
import {
  PyBound, PyBuiltin, PyClass, PyDeque, PyDict, PyExc, PyExcClass, PyFloat, PyFunc, PyInstance, PyIter, PyModule,
  PyRange, PySet, PyTuple, PyView, SnekFatal,
  asArray, dictKeys, dictSet, err, setAdd,
} from './values.ts';
import type { Rt } from './runtime.ts';

let jsBudget = 0;

export function toJS(v: any, depth = 0): any {
  if (depth === 0) jsBudget = 2_000_000;
  else if (--jsBudget < 0) throw new SnekFatal('TooBig', 'That value is too big to hand over.', 0);
  switch (typeof v) {
    case 'number': case 'boolean': case 'string': return v;
    case 'object': break;
    default: return null;
  }
  if (v === null) return null;
  if (depth > 60) return null;
  if (v instanceof PyFloat) return v.v;
  if (Array.isArray(v)) {
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = toJS(v[i], depth + 1);
    return out;
  }
  if (v instanceof PyTuple) return { $tuple: v.a.map((x) => toJS(x, depth + 1)) };
  if (v instanceof PySet) return { $set: Array.from(v.m.values()).map((x) => toJS(x, depth + 1)) };
  if (v instanceof PyDict) {
    const keys = dictKeys(v);
    const vals = Array.from(v.m.values());
    if (keys.every((k) => typeof k === 'string')) {
      const o: Record<string, any> = {};
      for (let i = 0; i < keys.length; i++) {
        Object.defineProperty(o, keys[i], { value: toJS(vals[i], depth + 1), enumerable: true, writable: true, configurable: true });
      }
      return o;
    }
    return { $dict: keys.map((k, i) => [toJS(k, depth + 1), toJS(vals[i], depth + 1)]) };
  }
  if (v instanceof PyInstance) {
    const attrs: Record<string, any> = {};
    for (const [k, x] of v.attrs) Object.defineProperty(attrs, k, { value: toJS(x, depth + 1), enumerable: true, writable: true, configurable: true });
    return { $object: v.cls.name, attrs };
  }
  if (v instanceof PyFunc) return { $function: v.name };
  if (v instanceof PyBound) return { $function: v.fn.name };
  if (v instanceof PyBuiltin) return { $function: v.name };
  if (v instanceof PyClass) return { $function: v.name };
  if (v instanceof PyExcClass) return { $function: v.kind };
  if (v instanceof PyModule) return { $function: v.name };
  if (v instanceof PyDeque || v instanceof PyRange || v instanceof PyIter || v instanceof PyView) {
    return asArray(v).map((x) => toJS(x, depth + 1));
  }
  if (v instanceof PyExc) return { $object: v.kind, attrs: { args: v.args.map((x) => toJS(x, depth + 1)) } };
  return null;
}

export function fromJS(v: any, depth = 0): any {
  switch (typeof v) {
    case 'number':
      if (Number.isSafeInteger(v)) return v === 0 ? 0 : v;
      return new PyFloat(v);
    case 'boolean': case 'string': return v;
    case 'undefined': return null;
    case 'object': break;
    case 'bigint':
      if (v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= -BigInt(Number.MAX_SAFE_INTEGER)) return Number(v);
      return err('OverflowError', 'That number is too big for Snek.');
    default: return null;
  }
  if (v === null) return null;
  if (depth > 60) return err('ValueError', 'That value is nested too deeply to use in Snek.');
  if (Array.isArray(v)) return v.map((x) => fromJS(x, depth + 1));
  if (Object.prototype.hasOwnProperty.call(v, '$float')) return new PyFloat(Number(v.$float));
  if (Object.prototype.hasOwnProperty.call(v, '$tuple') && Array.isArray(v.$tuple)) return new PyTuple(v.$tuple.map((x: any) => fromJS(x, depth + 1)));
  if (Object.prototype.hasOwnProperty.call(v, '$set') && Array.isArray(v.$set)) {
    const s = new PySet();
    for (const x of v.$set) setAdd(s, fromJS(x, depth + 1));
    return s;
  }
  if (Object.prototype.hasOwnProperty.call(v, '$dict') && Array.isArray(v.$dict)) {
    const d = new PyDict();
    for (const p of v.$dict) dictSet(d, fromJS(p[0], depth + 1), fromJS(p[1], depth + 1));
    return d;
  }
  if (typeof v === 'function') return null;
  const d = new PyDict();
  for (const k of Object.keys(v)) dictSet(d, k, fromJS(v[k], depth + 1));
  return d;
}

// A host function ends the run with RuntimeError when it throws (SPEC §13.4): the learner's own
// try/except cannot swallow it, so it travels as a SnekFatal.
export function makeHost(rt: Rt, name: string, fn: (...a: unknown[]) => unknown): PyBuiltin {
  return new PyBuiltin(name, (args) => {
    const js = args.map((x) => toJS(x));
    let r: unknown;
    try {
      r = fn(...js);
    } catch (e: any) {
      const msg = e && typeof e.message === 'string' ? e.message : String(e);
      return rt.fatal('RuntimeError', `The function ${name}() failed: ${msg}`);
    }
    return fromJS(r);
  }, null, true);
}
