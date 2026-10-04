// AC-25, AC-26
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openAppeal, appealStep, appealTick } from '../src/index.ts';

const APPEAL_WINDOW = 7 * 24 * 60 * 60 * 1000; // 7 days

test('AC-25 opening within 7 days works; after 7 days returns window-closed; unread confirmations opens as upheld', () => {
  const publishedAt = 1000;

  // Within 7 days: should work
  const withinWindow = openAppeal({ id: 'a1', publishedAt, unreadConfirmations: 0 }, publishedAt + 1000);
  assert.ok(withinWindow.ok);
  assert.equal(withinWindow.appeal.state, 'open');

  // At exactly 7 days: should still work
  const atBoundary = openAppeal({ id: 'a1', publishedAt, unreadConfirmations: 0 }, publishedAt + APPEAL_WINDOW);
  assert.ok(atBoundary.ok);
  assert.equal(atBoundary.appeal.state, 'open');

  // After 7 days: window-closed
  const afterWindow = openAppeal({ id: 'a1', publishedAt, unreadConfirmations: 0 }, publishedAt + APPEAL_WINDOW + 1);
  assert.ok(!afterWindow.ok);
  assert.equal(afterWindow.reason, 'window-closed');

  // With unread confirmations: opens as upheld
  const withUnread = openAppeal({ id: 'a1', publishedAt, unreadConfirmations: 1 }, publishedAt + 1000);
  assert.ok(withUnread.ok);
  assert.equal(withUnread.appeal.state, 'upheld');
  assert.equal(withUnread.appeal.reason, 'unread-confirmation');
});

test('AC-26 appealTick escalates after 7 days, not before; final decisions cannot be changed; steps appended to history', () => {
  const publishedAt = 1000;

  // Create an open appeal
  let appeal = {
    state: 'open',
    openedAt: publishedAt,
    history: [],
  };

  // Before 7 days: no escalation
  const beforeEscalation = appealTick(appeal, publishedAt + APPEAL_WINDOW - 1);
  assert.equal(beforeEscalation.state, 'open');
  assert.equal(beforeEscalation.history.length, 0);

  // At exactly 7 days: escalation
  const afterEscalation = appealTick(appeal, publishedAt + APPEAL_WINDOW);
  assert.equal(afterEscalation.state, 'escalated');
  assert.equal(afterEscalation.history.length, 1);
  assert.equal(afterEscalation.history[0].kind, 'escalate');
  assert.equal(afterEscalation.history[0].by, 'system');

  // Apply a step to an open appeal
  appeal = {
    state: 'open',
    openedAt: publishedAt,
    history: [],
  };
  const step1 = appealStep(appeal, { kind: 'uphold', by: 'trainer', at: publishedAt + 1000, outcome: 'uphold' });
  assert.equal(step1.state, 'upheld');
  assert.equal(step1.history.length, 1);
  assert.equal(step1.history[0].kind, 'uphold');
  assert.equal(step1.history[0].outcome, 'uphold');

  // Apply a decide-final step
  const step2 = appealStep(step1, { kind: 'decide-final', by: 'reviewer', at: publishedAt + 2000, outcome: 'uphold' });
  assert.equal(step2.state, 'final-upheld');
  assert.equal(step2.history.length, 2);

  // Try to change a final decision: should not change
  const step3 = appealStep(step2, { kind: 'reject', by: 'trainer', at: publishedAt + 3000, outcome: 'reject' });
  assert.equal(step3.state, 'final-upheld');
  assert.equal(step3.history.length, 2); // No new step added
});
