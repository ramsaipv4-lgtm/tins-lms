// AC-13
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyPairingState, issuePairing, claimPairing } from '../src/index.ts';

test('AC-13 claim once, then used; expired; unknown; no mutation', () => {
  const s0 = emptyPairingState();
  const s1 = issuePairing(s0, 'ABC123', 1000);
  assert.deepEqual(s0, emptyPairingState());
  const snap = JSON.stringify(s1);
  const c1 = claimPairing(s1, 'ABC123', 'dev1', 2000);
  assert.equal(c1.result, 'ok');
  assert.equal(JSON.stringify(s1), snap);
  assert.equal(claimPairing(c1.state, 'ABC123', 'dev2', 3000).result, 'used');
  assert.equal(claimPairing(s1, 'ABC123', 'dev1', 1000 + 5 * 60_000 + 1).result, 'expired');
  assert.equal(claimPairing(s1, 'NOPE', 'dev1', 2000).result, 'unknown');
  assert.equal(claimPairing(s1, 'toString', 'dev1', 2000).result, 'unknown');
  const s2 = issuePairing(s0, 'X', 0, 100);
  assert.equal(claimPairing(s2, 'X', 'd', 101).result, 'expired');
});
