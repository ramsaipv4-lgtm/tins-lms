// AC-42, AC-43, AC-44 (builder's own tests)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildManifest, verifyManifest, tarPack, tarUnpack,
  generateSigningKeys, signPackage, openPackage, utf8Encode,
} from '../src/index.ts';

const files = [
  { path: 'b/notes.md', bytes: utf8Encode('# hi\n') },
  { path: 'a.csv', bytes: utf8Encode('x,y\n1,2\n') },
  { path: 'deep/er/path/empty.bin', bytes: new Uint8Array(0) },
  { path: 'bin.dat', bytes: Uint8Array.from({ length: 1000 }, (_, i) => (i * 7) % 256) },
  { path: 'exact512.txt', bytes: new Uint8Array(512).fill(65) },
];

test('AC-42 manifest sorted; verify reports missing/extra/changed', async () => {
  const m = await buildManifest(files);
  assert.equal(m.version, 1);
  const paths = m.files.map((f) => f.path);
  assert.deepEqual(paths, [...paths].sort());
  assert.deepEqual(await verifyManifest(files, m), { missing: [], extra: [], changed: [] });
  const altered = files.filter((f) => f.path !== 'a.csv').map((f) =>
    f.path === 'bin.dat' ? { path: f.path, bytes: f.bytes.slice().fill(1) } : f);
  altered.push({ path: 'zz.txt', bytes: utf8Encode('x') }, { path: 'yy.txt', bytes: utf8Encode('x') });
  assert.deepEqual(await verifyManifest(altered, m), {
    missing: ['a.csv'], extra: ['yy.txt', 'zz.txt'], changed: ['bin.dat'],
  });
});

test('AC-43 tar round trip and system tar lists same paths', () => {
  const long = 'very/' + 'long-dir-name/'.repeat(8) + 'file.txt';
  const all = [...files, { path: long, bytes: utf8Encode('long') }];
  const archive = tarPack(all);
  assert.equal(archive.length % 512, 0);
  assert.deepEqual(tarUnpack(archive), all);
  const dir = mkdtempSync(join(tmpdir(), 'tar-'));
  try {
    const p = join(dir, 'x.tar');
    writeFileSync(p, archive);
    const listed = execFileSync('tar', ['-tf', p], { encoding: 'utf8' }).split('\n').filter(Boolean);
    assert.deepEqual(listed, all.map((f) => f.path));
  } finally { rmSync(dir, { recursive: true }); }
});

test('AC-44 signed package: ok, tampered, untrusted', async () => {
  const k = await generateSigningKeys();
  const other = await generateSigningKeys();
  const container = await signPackage(tarPack(files), k.privateJwk);
  const ok = await openPackage(container, [k.publicJwk]);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.files, files);
  const bad = container.slice();
  bad[bad.length - 700] ^= 1;
  const r = await openPackage(bad, [k.publicJwk]);
  assert.equal(r.ok, false);
  assert.ok(['bad-signature', 'corrupt'].includes(r.reason));
  assert.deepEqual(await openPackage(container, [other.publicJwk]), { ok: false, reason: 'untrusted' });
  assert.deepEqual(await openPackage(container.slice(0, 5), [k.publicJwk]), { ok: false, reason: 'corrupt' });
});
