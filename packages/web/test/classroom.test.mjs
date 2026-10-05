// classroom group (AC-88, AC-91, AC-152, AC-153, AC-166): string keys exist; routes are well formed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('../src/features/classroom/', import.meta.url).pathname;
const strings = JSON.parse(readFileSync(join(DIR, 'strings.en.json'), 'utf8'));

test('classroom: every used string key exists', () => {
  const used = new Set();
  for (const f of readdirSync(DIR).filter((x) => /\.tsx?$/.test(x))) {
    for (const m of readFileSync(join(DIR, f), 'utf8').matchAll(/['"`](classroom\.[A-Za-z0-9_.-]+)['"`]/g)) used.add(m[1]);
  }
  const dynamic = /\.(state|status|change)\.$/;
  for (const k of used) if (!dynamic.test(k)) assert.ok(k in strings, `missing string ${k}`);
});

test('classroom: dynamic string families are complete', () => {
  for (const s of ['open', 'upheld', 'rejected', 'escalated', 'final-upheld', 'final-rejected']) assert.ok(`classroom.appeal.state.${s}` in strings);
  for (const s of ['pending', 'approved']) assert.ok(`classroom.acc.status.${s}` in strings);
  for (const s of ['suggested', 'accepted', 'rejected']) assert.ok(`classroom.misc.status.${s}` in strings);
  for (const s of ['added', 'changed', 'removed']) assert.ok(`classroom.change.${s}` in strings);
  for (const s of ['verified', 'present', 'active', 'dropped']) assert.ok(`classroom.state.${s}` in strings);
});

test('classroom: every route file exists and has a default export', () => {
  const idx = readFileSync(join(DIR, 'index.tsx'), 'utf8');
  for (const m of idx.matchAll(/import\('\.\/(\w+)\.tsx'\)/g)) {
    assert.match(readFileSync(join(DIR, `${m[1]}.tsx`), 'utf8'), /export default|export \{ \w+ as default \}/, m[1]);
  }
});
