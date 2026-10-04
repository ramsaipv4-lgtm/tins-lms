// Unit tests for health.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { healthDigest, runMorningChecklist } from '../src/health.ts';

const H = 3_600_000;
const NOW = Date.UTC(2026, 10, 2, 2, 0);

test('healthDigest basic functionality', async () => {
  const result = await healthDigest({
    now: NOW,
    backups: [{ target: 's3', lastSuccessAt: NOW - 47 * H }],
    syncLagMs: 4000,
    checks: [{ id: 'disk', ok: true }],
  });
  assert.equal(result.status, 'green');
  assert.equal(result.syncLagMs, 4000);
});

test('runMorningChecklist basic functionality', async () => {
  const checks = [
    { id: 'test1', kind: 'offline', run: async () => true },
  ];
  const result = await runMorningChecklist({ now: NOW, online: true, checks });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'test1');
});
