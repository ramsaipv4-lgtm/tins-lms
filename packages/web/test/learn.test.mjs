// learn group (AC-84, AC-85, AC-92, AC-93, AC-155, AC-163): every used string key exists, routes are declared,
// and the free-text answer matcher behaves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('../src/features/learn/', import.meta.url).pathname;
const strings = JSON.parse(readFileSync(join(DIR, 'strings.en.json'), 'utf8'));

test('learn: every used string key exists and every key is in the learn group', () => {
  const used = new Set();
  for (const f of readdirSync(DIR).filter((x) => /\.tsx?$/.test(x))) {
    for (const m of readFileSync(join(DIR, f), 'utf8').matchAll(/['"`](learn\.[A-Za-z0-9_.]+)['"`]/g)) used.add(m[1]);
  }
  const dynamic = /\.(state|choice|err)\.$|^learn\.cards\.(again|hard|good|easy)$/;
  for (const k of used) if (!dynamic.test(k)) assert.ok(k in strings, `missing string ${k}`);
  for (const k of ['learn.catchup.state.attended', 'learn.catchup.state.locked', 'learn.exit.choice.unclear', 'learn.exit.choice.clear', 'learn.first.err.generic']) assert.ok(k in strings, k);
  for (const k of Object.keys(strings)) assert.ok(k.startsWith('learn.'), k);
});

test('learn: routes cover the learner day screens and the trainer tally', () => {
  const src = readFileSync(join(DIR, 'index.tsx'), 'utf8');
  for (const p of ['/learn/catch-up', '/learn/cards', '/learn/error-notebook', '/learn/quick-learn', '/learn/explain', '/learn/exit-ticket', '/teach/exit-ticket']) {
    assert.ok(src.includes(`'${p}'`), `route ${p}`);
  }
});

test('learn: free-text diagnostic answers match on the key words', async () => {
  const { answerMatches } = await import('../../server/src/routes/features/learn.ts');
  assert.equal(answerMatches('Kettle  new!', 'kettle new'), true);
  assert.equal(answerMatches('you run kettle new to start', 'kettle new'), true);
  assert.equal(answerMatches('kettle', 'kettle new'), false);
  assert.equal(answerMatches('', 'kettle new'), false);
});
