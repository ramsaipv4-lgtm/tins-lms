const PouchDB = require('pouchdb');
const Mem = PouchDB.plugin(require('pouchdb-adapter-memory')).defaults({ adapter: 'memory' });
const express = require('express');
(async () => {
  const app = express();
  const HubDB = PouchDB.defaults({ prefix: __dirname + '/hubdata/' });
  require('fs').mkdirSync(__dirname + '/hubdata', { recursive: true });
  app.use('/db', require('express-pouchdb')(HubDB, { mode: 'minimumForPouchDB' }));
  const srv = app.listen(5985);
  await new Promise(r => setTimeout(r, 300));
  const remote = new PouchDB('http://127.0.0.1:5985/db/class-c1');
  const phoneA = new Mem('a'), phoneB = new Mem('b');
  await phoneA.put({ _id: 'att:arjun:d1', type: 'attendance', present: true });
  await phoneB.put({ _id: 'card:1', type: 'card', front: 'Q', due: 1 });
  await phoneA.replicate.to(remote); await phoneB.sync(remote); await phoneA.sync(remote);
  console.log('A has', (await phoneA.allDocs()).rows.map(r => r.id));
  // conflict: both edit card:1 offline
  const ca = await phoneA.get('card:1'); const cb = await phoneB.get('card:1');
  await phoneA.put({ ...ca, due: 2 }); await phoneB.put({ ...cb, due: 3 });
  await phoneA.sync(remote); await phoneB.sync(remote); await phoneA.sync(remote);
  const w = await phoneA.get('card:1', { conflicts: true }); const w2 = await phoneB.get('card:1', { conflicts: true });
  console.log('winner A', w.due, 'conflicts', w._conflicts, '| winner B', w2.due, 'same winner', w._rev === w2._rev);
  // hub to hub (cloud) replication
  const cloud = new Mem('cloud'); await remote.replicate.to(cloud);
  console.log('cloud docs', (await cloud.allDocs()).total_rows);
  srv.close(); process.exit(0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
