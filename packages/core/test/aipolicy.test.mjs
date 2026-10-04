// AC-27
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiAllowed, aiUsageSummary } from '../src/index.ts';

test('AC-27 off allows nothing; allowed allows everything; explain-only allows chat only', () => {
  // off allows nothing
  assert.equal(aiAllowed('off', 'chat'), false);
  assert.equal(aiAllowed('off', 'repo-write'), false);
  assert.equal(aiAllowed('off', 'run-command'), false);

  // allowed allows everything
  assert.equal(aiAllowed('allowed', 'chat'), true);
  assert.equal(aiAllowed('allowed', 'repo-write'), true);
  assert.equal(aiAllowed('allowed', 'run-command'), true);

  // explain-only allows chat only
  assert.equal(aiAllowed('explain-only', 'chat'), true);
  assert.equal(aiAllowed('explain-only', 'repo-write'), false);
  assert.equal(aiAllowed('explain-only', 'run-command'), false);
});

test('AC-27 summary reads correctly', () => {
  // AI off
  assert.equal(aiUsageSummary('off', []), 'AI off');
  assert.equal(aiUsageSummary('off', [{ at: 1000, toolKind: 'chat' }]), 'AI off');

  // AI allowed with no usage
  assert.equal(aiUsageSummary('allowed', []), 'AI allowed; used 0 times');

  // AI allowed with usage
  assert.equal(aiUsageSummary('allowed', [{ at: 1000, toolKind: 'chat' }]), 'AI allowed; used 1 times');
  assert.equal(
    aiUsageSummary('allowed', [
      { at: 1000, toolKind: 'chat' },
      { at: 2000, toolKind: 'repo-write' },
      { at: 3000, toolKind: 'run-command' },
    ]),
    'AI allowed; used 3 times'
  );

  // AI explain-only with no usage
  assert.equal(aiUsageSummary('explain-only', []), 'AI explain-only; used 0 times');

  // AI explain-only with usage
  assert.equal(aiUsageSummary('explain-only', [{ at: 1000, toolKind: 'chat' }]), 'AI explain-only; used 1 times');
  assert.equal(
    aiUsageSummary('explain-only', [
      { at: 1000, toolKind: 'chat' },
      { at: 2000, toolKind: 'chat' },
    ]),
    'AI explain-only; used 2 times'
  );
});
