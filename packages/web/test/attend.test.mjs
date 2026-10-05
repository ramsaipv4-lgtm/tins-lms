// attend group (AC-82, AC-89, AC-90, AC-159, AC-160): every t('attend.*') key used in the sources exists in strings.en.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('../src/features/attend/', import.meta.url).pathname;
const strings = JSON.parse(readFileSync(join(DIR, 'strings.en.json'), 'utf8'));

test('attend: every used string key exists', () => {
  const used = new Set();
  for (const f of readdirSync(DIR).filter((x) => /\.tsx?$/.test(x))) {
    for (const m of readFileSync(join(DIR, f), 'utf8').matchAll(/['"`](attend\.[A-Za-z0-9_.]+)['"`]/g)) used.add(m[1]);
  }
  const dynamic = /\.(state|level|reason|reports)\.$/;
  for (const k of used) if (!dynamic.test(k)) assert.ok(k in strings, `missing string ${k}`);
  for (const k of ['attend.state.verified', 'attend.state.dropped', 'attend.level.risk', 'attend.reason.last_shift_score']) assert.ok(k in strings);
});
