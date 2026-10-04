import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkExplanation } from '../src/explain.ts';

const CHECKLIST = {
  concepts: [
    { id: 'dns', anyOf: ['domain name system', 'dns'] },
    { id: 'ttl', anyOf: ['time to live', 'ttl'] },
    { id: 'cache', anyOf: ['cache'] },
    { id: 'resolver', anyOf: ['resolver', 'recursive server'] },
  ],
  misconceptions: [
    { id: 'instant-propagation', anyOf: ['changes instantly', 'updates immediately'] },
    { id: 'dns-is-http', anyOf: ['dns uses http'] },
  ],
};

const sorted = (a) => [...a].sort();

test('AC-34 synonyms cover concepts, absent ones are missing, misconceptions are reported', () => {
  const t = 'When you type a name, the DOMAIN NAME SYSTEM finds the address. Each answer has a Time to Live, '
    + 'and it is cached for that long. Honestly, I think a record change updates immediately everywhere!';
  const r = checkExplanation(t, CHECKLIST);
  assert.deepEqual(sorted(r.covered), ['dns', 'ttl']);
  assert.deepEqual(sorted(r.missing), ['cache', 'resolver'], '"cached" must not match "cache"');
  assert.deepEqual(r.misconceptions, ['instant-propagation']);
});

test('AC-34 matching ignores case and punctuation and needs whole words', () => {
  const r = checkExplanation('The resolver asks others; its cache (TTL) helps. DNS!', CHECKLIST);
  assert.deepEqual(sorted(r.covered), ['cache', 'dns', 'resolver', 'ttl']);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.misconceptions, []);

  const partial = checkExplanation('The resolvers use a cachet and dnssec over a recursive servers farm', CHECKLIST);
  assert.deepEqual(partial.covered, [], 'partial words never match');
  assert.deepEqual(sorted(partial.missing), ['cache', 'dns', 'resolver', 'ttl']);

  const listed = checkExplanation('It is cached.', { concepts: [{ id: 'cache', anyOf: ['cache', 'cached'] }], misconceptions: [] });
  assert.deepEqual(listed.covered, ['cache'], '"cached" matches when listed');
});
