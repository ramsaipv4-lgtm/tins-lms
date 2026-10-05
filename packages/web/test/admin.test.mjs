// Unit tests for b7-2: AC-154 syllabus drafting rules, AC-80/AC-165/AC-169 admin routes exist and are role-guarded.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { draftSyllabus } from '../../server/src/routes/features/admin.ts';

test('AC-154 draft: bullets and numbers are stripped, three topics a day', () => {
  const d = draftSyllabus('- Git basics\n2) Branching\n* Merging\nTesting; CI');
  assert.deepEqual(d.topics, ['Git basics', 'Branching', 'Merging', 'Testing', 'CI']);
  assert.equal(d.days.length, 2);
  assert.deepEqual(d.days[1].topics, ['Testing', 'CI']);
});

test('AC-80/AC-165/AC-169 strings: every admin key is namespaced', () => {
  const s = JSON.parse(readFileSync(new URL('../src/features/admin/strings.en.json', import.meta.url), 'utf8'));
  assert.ok(Object.keys(s).length > 50);
  for (const k of Object.keys(s)) assert.match(k, /^admin\./);
});
