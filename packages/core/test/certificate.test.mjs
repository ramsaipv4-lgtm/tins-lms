// AC-58
import test from 'node:test';
import assert from 'node:assert/strict';
import { certificateId, verifyCertificateId } from '../src/index.ts';

const secret = new TextEncoder().encode('test-secret-cert');
const other = new TextEncoder().encode('other-secret');

test('AC-58 format, determinism, tamper detection', async () => {
  const id = await certificateId(secret, 'p1', 'prog1', 1700000000000);
  assert.match(id, /^[0-9A-HJKMNP-TV-Z]{12}$/);
  assert.equal(await certificateId(secret, 'p1', 'prog1', 1700000000000), id);
  assert.equal(await verifyCertificateId(id, secret, 'p1', 'prog1', 1700000000000), true);
  assert.equal(await verifyCertificateId(id, secret, 'p2', 'prog1', 1700000000000), false);
  assert.equal(await verifyCertificateId(id, secret, 'p1', 'prog2', 1700000000000), false);
  assert.equal(await verifyCertificateId(id, secret, 'p1', 'prog1', 1700000000001), false);
  assert.equal(await verifyCertificateId(id, other, 'p1', 'prog1', 1700000000000), false);
  assert.equal(await verifyCertificateId(id.slice(1), secret, 'p1', 'prog1', 1700000000000), false);
});
