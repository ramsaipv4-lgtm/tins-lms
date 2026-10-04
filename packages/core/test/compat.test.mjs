import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSync } from '../src/compat.ts';

test('canSync same version returns sync ok', () => {
  const result = canSync(10, 10);
  assert.deepEqual(result, { ok: true, action: 'sync' });
});

test('canSync client 1 version behind returns upgrade-on-hub ok', () => {
  const result = canSync(9, 10);
  assert.deepEqual(result, { ok: true, action: 'upgrade-on-hub' });
});

test('canSync client 2 versions behind returns upgrade-on-hub ok', () => {
  const result = canSync(8, 10);
  assert.deepEqual(result, { ok: true, action: 'upgrade-on-hub' });
});

test('canSync client more than 2 versions behind returns update-app not ok', () => {
  const result = canSync(7, 10);
  assert.deepEqual(result, { ok: false, action: 'update-app' });
});

test('canSync client 3 versions behind returns update-app', () => {
  const result = canSync(0, 3);
  assert.deepEqual(result, { ok: false, action: 'update-app' });
});

test('canSync client ahead returns update-hub not ok', () => {
  const result = canSync(11, 10);
  assert.deepEqual(result, { ok: false, action: 'update-hub' });
});

test('canSync client 2 ahead returns update-hub', () => {
  const result = canSync(12, 10);
  assert.deepEqual(result, { ok: false, action: 'update-hub' });
});

test('AC-50: all four cases correct', () => {
  // Same version -> sync, ok true
  assert.deepEqual(canSync(5, 5), { ok: true, action: 'sync' });

  // Client 1-2 older -> upgrade-on-hub, ok true
  assert.deepEqual(canSync(4, 5), { ok: true, action: 'upgrade-on-hub' });
  assert.deepEqual(canSync(3, 5), { ok: true, action: 'upgrade-on-hub' });

  // Client more than 2 older -> update-app, ok false
  assert.deepEqual(canSync(2, 5), { ok: false, action: 'update-app' });
  assert.deepEqual(canSync(0, 5), { ok: false, action: 'update-app' });

  // Client newer -> update-hub, ok false
  assert.deepEqual(canSync(6, 5), { ok: false, action: 'update-hub' });
  assert.deepEqual(canSync(10, 5), { ok: false, action: 'update-hub' });
});

test('canSync ok field is true only for sync and upgrade-on-hub', () => {
  // sync should have ok: true
  assert.equal(canSync(10, 10).ok, true);

  // upgrade-on-hub should have ok: true
  assert.equal(canSync(9, 10).ok, true);
  assert.equal(canSync(8, 10).ok, true);

  // update-app should have ok: false
  assert.equal(canSync(7, 10).ok, false);

  // update-hub should have ok: false
  assert.equal(canSync(11, 10).ok, false);
});
