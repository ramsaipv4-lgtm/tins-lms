// AC-103 (unit level): statistics, target guard, argument parsing and a full run against an in-process fake hub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { percentile, withinPct } from '../src/stats.ts';
import { assertLocalTarget, runLoadTest } from '../src/loadtest.ts';
import { parseArgs } from '../src/main.ts';

test('AC-103 percentile uses nearest rank and withinPct counts the limit as inside', () => {
  assert.equal(percentile([], 95), 0);
  assert.equal(percentile([5, 1, 3, 2, 4], 80), 4);
  assert.equal(percentile(Array.from({ length: 100 }, (_, i) => i + 1), 95), 95);
  assert.equal(withinPct([100, 1000, 1001, Infinity], 1000), 50);
  assert.equal(withinPct([], 1000), 0);
});

test('AC-103 only loopback targets are accepted', () => {
  assert.equal(assertLocalTarget('http://127.0.0.1:4000').origin, 'http://127.0.0.1:4000');
  assert.equal(assertLocalTarget('http://localhost:4000/x').hostname, 'localhost');
  assert.throws(() => assertLocalTarget('https://example.com'), /non-local/);
  assert.throws(() => assertLocalTarget('not a url'), /invalid/);
});

test('AC-103 parseArgs reads --flag value and --flag=value', () => {
  assert.deepEqual(parseArgs(['loadtest', '--learners', '200', '--target=http://127.0.0.1:1']),
    { command: 'loadtest', flags: { learners: '200', target: 'http://127.0.0.1:1' } });
});

// A tiny fake hub: keeps documents in memory, so "lost writes" can be provoked by dropping some.
function fakeHub({ dropExitTickets = false } = {}) {
  const docs = new Map();
  const srv = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      const send = (s, o, h = {}) => { res.writeHead(s, { 'content-type': 'application/json', ...h }); res.end(JSON.stringify(o)); };
      const url = new URL(req.url, 'http://x');
      const who = (req.headers.cookie ?? '').replace('p=', '');
      if (url.pathname === '/__test/login') { const b = JSON.parse(body); return send(200, { ok: true }, { 'set-cookie': `p=${b.personId}; Path=/` }); }
      if (url.pathname.endsWith('/attendance-code')) return send(200, { code: '123456', secondsLeft: 30 });
      if (url.pathname.endsWith('/attendance')) { docs.set(`attendance:${who}`, 1); return send(200, { ok: true }); }
      if (url.pathname.endsWith('/attempts')) { docs.set(`attempt:${who}`, 1); return send(201, { id: who }); }
      if (url.pathname.endsWith('/_bulk_docs')) {
        for (const d of JSON.parse(body).docs) if (!(dropExitTickets && d.type === 'exitTicket')) docs.set(d.id, 1);
        return send(201, []);
      }
      if (url.pathname.endsWith('/_all_docs')) {
        const prefix = JSON.parse(decodeURIComponent(url.searchParams.get('startkey')));
        return send(200, { rows: [...docs.keys()].filter((k) => k.startsWith(prefix)).map((id) => ({ id })) });
      }
      return send(404, {});
    });
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r({ url: `http://127.0.0.1:${srv.address().port}`, stop: () => srv.close() })));
}

test('AC-103 a healthy hub passes with every write kept', async () => {
  const hub = await fakeHub();
  try {
    const s = await runLoadTest({ target: hub.url, learners: 20 });
    assert.equal(s.pass, true);
    assert.equal(s.quizAnswers, 20);
    assert.equal(s.lostWrites, 0);
    assert.ok(s.requests >= 20 * 4);
  } finally { hub.stop(); }
});

test('AC-103 a hub that drops writes fails the run and reports them as lost', async () => {
  const hub = await fakeHub({ dropExitTickets: true });
  try {
    const s = await runLoadTest({ target: hub.url, learners: 10 });
    assert.equal(s.lostWrites, 10);
    assert.equal(s.pass, false);
  } finally { hub.stop(); }
});
