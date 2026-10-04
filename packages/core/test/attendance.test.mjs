// AC-11, AC-12
import test from 'node:test';
import assert from 'node:assert/strict';
import { attendanceCode, verifyAttendanceCode } from '../src/index.ts';

const secret = new TextEncoder().encode('test-secret-attendance');
const other = new TextEncoder().encode('another-secret');

test('AC-11 six digits, stable in a period, changes next period', async () => {
  const t = 1_700_000_040_000; // multiple of 60s
  const a = await attendanceCode(secret, t);
  assert.match(a, /^\d{6}$/);
  assert.equal(await attendanceCode(secret, t + 59_999), a);
  assert.notEqual(await attendanceCode(secret, t + 60_000), a);
  let padded = false;
  for (let i = 0; i < 200 && !padded; i++) padded = (await attendanceCode(secret, t + i * 60_000)).startsWith('0');
  assert.ok(padded, 'leading zeros are kept');
});

test('AC-12 accepts current and previous, rejects older or other secret', async () => {
  for (const p of [60, 120]) {
    const t = 1_700_000_040_000;
    const step = p * 1000;
    const old = await attendanceCode(secret, t, p);
    assert.equal(await verifyAttendanceCode(old, secret, t, p), true);
    assert.equal(await verifyAttendanceCode(old, secret, t + step, p), true);
    assert.equal(await verifyAttendanceCode(old, secret, t + 2 * step, p), false);
    assert.equal(await verifyAttendanceCode(old, other, t, p), false);
  }
});
