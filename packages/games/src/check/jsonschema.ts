// A small JSON Schema (2020-12 subset) validator, so the pack check needs no dependency (SPEC §1.1, AGENTS rule 4).
// Supported keywords: type, const, enum, required, properties, additionalProperties, items, minItems, maxItems,
// uniqueItems, minimum, maximum, exclusiveMinimum, minLength, maxLength, pattern, anyOf, oneOf, $ref ("#/$defs/…"),
// and the annotations $schema, $id, $comment, $defs, title, description (ignored).
export interface SchemaError { path: string; message: string }

type Schema = Record<string, any>;

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}
function isType(v: unknown, t: string): boolean {
  const actual = typeOf(v);
  return actual === t || (t === 'number' && actual === 'integer');
}
const show = (v: unknown): string => {
  const s = typeof v === 'string' ? `"${v}"` : JSON.stringify(v);
  return s === undefined ? String(v) : s.length > 60 ? `${s.slice(0, 57)}...` : s;
};

export function validate(schema: Schema, data: unknown): SchemaError[] {
  const errors: SchemaError[] = [];
  const root = schema;

  function resolve(ref: string): Schema {
    if (!ref.startsWith('#/')) throw new Error(`unsupported $ref ${ref}`);
    let node: any = root;
    for (const part of ref.slice(2).split('/')) node = node?.[part.replace(/~1/g, '/').replace(/~0/g, '~')];
    if (!node) throw new Error(`unresolved $ref ${ref}`);
    return node;
  }

  function walk(s: Schema, v: unknown, path: string, out: SchemaError[]): void {
    if (s.$ref) { walk(resolve(s.$ref), v, path, out); return; }
    if (s.type !== undefined) {
      const types = Array.isArray(s.type) ? s.type : [s.type];
      if (!types.some((t: string) => isType(v, t))) {
        out.push({ path, message: `must be ${types.join(' or ')}, not ${typeOf(v)} (${show(v)})` });
        return;
      }
    }
    if (s.const !== undefined && JSON.stringify(v) !== JSON.stringify(s.const)) out.push({ path, message: `must be ${show(s.const)}, not ${show(v)}` });
    if (s.enum && !s.enum.some((e: unknown) => JSON.stringify(e) === JSON.stringify(v))) out.push({ path, message: `${show(v)} is not one of ${s.enum.map(show).join(', ')}` });
    if (typeof v === 'string') {
      if (s.minLength !== undefined && v.length < s.minLength) out.push({ path, message: `must have at least ${s.minLength} character(s)` });
      if (s.maxLength !== undefined && v.length > s.maxLength) out.push({ path, message: `must have at most ${s.maxLength} characters, has ${v.length}` });
      if (s.pattern && !new RegExp(s.pattern, 'u').test(v)) out.push({ path, message: `${show(v)} does not match the ${s.description ?? 'pattern'} ${s.pattern}` });
    }
    if (typeof v === 'number') {
      if (s.minimum !== undefined && v < s.minimum) out.push({ path, message: `must be at least ${s.minimum}, not ${v}` });
      if (s.maximum !== undefined && v > s.maximum) out.push({ path, message: `must be at most ${s.maximum}, not ${v}` });
      if (s.exclusiveMinimum !== undefined && v <= s.exclusiveMinimum) out.push({ path, message: `must be more than ${s.exclusiveMinimum}, not ${v}` });
    }
    if (Array.isArray(v)) {
      if (s.minItems !== undefined && v.length < s.minItems) out.push({ path, message: `must have at least ${s.minItems} item(s)` });
      if (s.maxItems !== undefined && v.length > s.maxItems) out.push({ path, message: `must have at most ${s.maxItems} item(s)` });
      if (s.uniqueItems && new Set(v.map((x) => JSON.stringify(x))).size !== v.length) out.push({ path, message: 'must not repeat an item' });
      if (s.items) v.forEach((item, i) => walk(s.items, item, `${path}/${i}`, out));
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      for (const key of s.required ?? []) if (!(key in o)) out.push({ path, message: `missing required field "${key}"` });
      const props = s.properties ?? {};
      for (const [k, sub] of Object.entries<Schema>(props)) if (k in o) walk(sub, o[k], `${path}/${k}`, out);
      if (s.additionalProperties !== undefined) {
        for (const k of Object.keys(o)) {
          if (k in props) continue;
          if (s.additionalProperties === false) out.push({ path: `${path}/${k}`, message: `unknown field "${k}"` });
          else if (typeof s.additionalProperties === 'object') walk(s.additionalProperties, o[k], `${path}/${k}`, out);
        }
      }
    }
    if (s.anyOf) {
      const tries = s.anyOf.map((sub: Schema) => { const e: SchemaError[] = []; walk(sub, v, path, e); return e; });
      if (!tries.some((e: SchemaError[]) => e.length === 0)) out.push({ path, message: `does not match any allowed shape (${tries[0][0]?.message ?? 'invalid'})` });
    }
    if (s.oneOf) {
      const ok = s.oneOf.filter((sub: Schema) => { const e: SchemaError[] = []; walk(sub, v, path, e); return e.length === 0; }).length;
      if (ok !== 1) out.push({ path, message: ok === 0 ? 'does not match any allowed shape' : 'matches more than one allowed shape' });
    }
  }

  walk(schema, data, '', errors);
  return errors;
}
