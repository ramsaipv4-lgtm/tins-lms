// Integration I-8: the static server compresses text files and leaves the rest alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { serveWeb, pickEncoding } from '../src/core/static.ts';

function site() {
  const d = mkdtempSync(join(tmpdir(), 'lms-static-'));
  mkdirSync(join(d, 'assets'));
  writeFileSync(join(d, 'index.html'), '<!doctype html><title>x</title>' + ' '.repeat(2000));
  writeFileSync(join(d, 'assets', 'app.js'), 'console.log("hello");\n'.repeat(500));
  writeFileSync(join(d, 'assets', 'tiny.js'), 'x');
  writeFileSync(join(d, 'icon.png'), Buffer.alloc(4000, 7));
  return d;
}

test('pickEncoding prefers brotli, then gzip, and honours q=0', () => {
  assert.equal(pickEncoding('gzip, deflate, br'), 'br');
  assert.equal(pickEncoding('gzip'), 'gzip');
  assert.equal(pickEncoding('br;q=0, gzip'), 'gzip');
  assert.equal(pickEncoding(''), null);
});

test('text assets are compressed and decode back to the file', async () => {
  const d = site();
  try {
    for (const [ae, dec] of [['br', brotliDecompressSync], ['gzip', gunzipSync]]) {
      const r = serveWeb(d, '/assets/app.js', ae);
      assert.equal(r.headers.get('content-encoding'), ae);
      assert.equal(r.headers.get('vary'), 'accept-encoding');
      const body = Buffer.from(await r.arrayBuffer());
      assert.ok(body.length < 1000, `compressed ${body.length}`);
      assert.equal(dec(body).toString(), 'console.log("hello");\n'.repeat(500));
    }
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('no encoding, small files and images are sent as they are; SPA fallback still works', async () => {
  const d = site();
  try {
    assert.equal(serveWeb(d, '/assets/app.js', '').headers.get('content-encoding'), null);
    assert.equal(serveWeb(d, '/assets/tiny.js', 'br').headers.get('content-encoding'), null);
    assert.equal(serveWeb(d, '/icon.png', 'br').headers.get('content-encoding'), null);
    const r = serveWeb(d, '/learn/today', 'gzip');
    assert.equal(r.headers.get('cache-control'), 'no-cache');
    assert.match(gunzipSync(Buffer.from(await r.arrayBuffer())).toString(), /<title>x<\/title>/);
    assert.equal(serveWeb(d, '/assets/missing.js', 'br'), null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('b11-1 hashed build files under /assets are immutable; the index is never cached', () => {
  const d = site();
  try {
    assert.equal(serveWeb(d, '/assets/app.js', 'br').headers.get('cache-control'), 'public, max-age=31536000, immutable');
    assert.equal(serveWeb(d, '/', 'br').headers.get('cache-control'), 'no-cache');
  } finally { rmSync(d, { recursive: true, force: true }); }
});
