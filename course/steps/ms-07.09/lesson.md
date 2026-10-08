---
id: ms-07.09
title: Offline phone profile, file exchange, export my data, robustness
module: 7
est_minutes: 45
prereqs: [ms-07.01]
objectives: 3
new_terms: 6
skills: [offline-first, replication, signed-files]
source_refs: [{ path: packages/web/src/features/files/phone.ts, commit: a905a3402f24a191fc7984ab74d248a5ac00d346 }, { path: packages/web/src/features/files/net.ts, commit: a905a3402f24a191fc7984ab74d248a5ac00d346 }]
next: ms-08.01
---

# MS 7.9 — Offline phone profile, file exchange, export my data, robustness
*Step 34 of 42*

## Prerequisites

- React state and effects
- Signed packages and the hub bundle (SPEC 4.24, 5.8)

## You already understand this

- A paper timetable in your bag: you copied it while the office was open, and it still works when the office is shut.
- A sealed envelope you carry for someone else: the stamp on it proves who sent it.

## The detective question

**Problem:** After its first load the phone must keep opening released content, reviewing cards, taking the diagnostic and showing the mastery map with the hub switched off, and its changes must reach the hub when it is back.

**Options considered:**
1. Cache every API answer in the service worker and replay them offline.
2. Keep a copy of the hub bundle in IndexedDB, keep cards and checks in a local PouchDB that replicates with the hub, and compute everything on the device with core.
3. Write our own sync protocol.

**Choice:** Option 2.

**Why:** Replaying cached answers cannot record a card review or a diagnostic result, and a home-made protocol would repeat CouchDB's revision handling. A local database replicates for free, and the core scheduler and mastery rule already run in the browser (D-22).

## Learning objectives

1. Store a hub bundle on the device and open sealed sections from it without the hub.
2. Replicate a personal PouchDB with the hub and survive outages with a short retry back-off.
3. Exchange work as signed files when there is no hub connection.

## Conceptual understanding

The hub bundle holds the sealed sections, the keys of released sections, the diagnostic questions and the hub's public key. The device clock is replaced by the hub clock plus the time since the bundle arrived. Cards and mastery checks are documents in the learner's own database; rating a card writes a new `fsrs` state with core's `reviewCard`. For classes with no hub link the trainer downloads a signed day package and the learner imports it; the learner's signed submission goes back the same way.

## Walkthrough of the real code

Replication keeps trying while the hub is off, with a back-off that never grows beyond 2.5 seconds.

```ts packages/web/src/features/files/phone.ts
async function ensureSync() {
  if (syncing || !person || downloadsHeld()) return;
  syncing = true;
  try {
    const [local, remote] = await Promise.all([personDb(), remoteDb(`person-${person}`)]);
    const h = local.sync(remote, { live: true, retry: true, back_off_function: (d: number) => (d === 0 ? 500 : Math.min(d * 1.5, 2500)) });
    sync = h;
    h.on('paused', (err: unknown) => { if (!err) { lastSync = Date.now(); hubUp = true; readyResolve(); notify(); } });
    h.on('change', () => { lastSync = Date.now(); notify(); });
    h.on('error', () => { try { h.cancel(); } catch { /* ignore */ } sync = null; syncing = false; });
    h.on('complete', () => { sync = null; syncing = false; });
  } catch { syncing = false; }
}
```

Answers are compared the way a person would.

```ts packages/web/src/features/files/phone.ts
// ---- answers are compared the way a person would: case, spacing, quotes and a leading dot do not matter ----
const norm = (s: string) => s.toLowerCase().replace(/[`'"“”‘’]/g, '').replace(/\s+/g, ' ').trim().replace(/^\./, '');
export function gradeAnswer(given: string, key: string): boolean {
  const g = norm(given), k = norm(key);
  if (!g || !k) return false;
  return g === k || (k.length >= 3 && g.includes(k));
}
```

"Wi-Fi only downloads" needs to know whether the link is cellular. The browser does not always say.

```ts packages/web/src/features/files/net.ts
export function onCellular(): boolean {
  const c = (navigator as any).connection;
  if (!c) return false;
  if (c.type) return c.type === 'cellular';
  // Desktop and many phone browsers do not report the connection type; a slow effective type (3g or worse) is the best sign left.
  if (c.effectiveType === '3g' || c.effectiveType === '2g' || c.effectiveType === 'slow-2g') return true;
  // A narrow, slow link (a mobile-data profile reports about 1.5 Mbit/s and 150 ms) counts as cellular as well.
  return typeof c.downlink === 'number' && c.downlink > 0 && c.downlink <= 2 && c.rtt >= 100;
}
```

## Your turn: faulty first

Three real mistakes from the build journal.

1. The first build used `pouchdb-browser` and every database call threw "Class extends value #<Object>". Fix: load the self-contained browser bundle that ships in the `pouchdb` package.
2. Navigation labels like "Settings and my data" did not match the journey's anchored names. Fix: use the exact words.
3. A phone that went offline right after loading could not open the File exchange screen. Fix: ship the small screens in the shell chunk.

## Technical glossary

- **Bundle:** the copy of class data the hub gives a device.
- **Replication:** two databases copying each other's changes.
- **Back-off:** the waiting time between retries.
- **Signed package:** a file with a signature a device can check.
- **Trust on first use:** accepting the signer's key the first time and remembering it.
- **Kiosk mode:** a shared-device setting that hides the Coach space and signs out when idle.

## Common questions

**Q: Why does the device key never leave the phone?** A: A signature only proves the learner if nobody else can make it.

**Q: Why is the hub clock stored as an offset?** A: Cards are due by the hub's time, and the phone's own clock may be wrong (D-27).

## Reinforcement activity

Change the retry back-off cap to 30 seconds and measure how long a review takes to reach the hub after it returns.

## Check yourself

1. Where does a card review go when the hub is off?
<details>Into the local personal database; replication sends it later.</details>
2. Why can an imported package be opened without the hub?
<details>The package carries the keys of its released sections and is signed.</details>
3. What does kiosk mode change?
<details>It hides the Coach space and signs the person out after 30 minutes idle.</details>

## Quick reference

- `GET /api/files/bundle`, `GET /api/files/package?classId=&day=`
- `POST /api/files/drill`, `/api/files/drill-ack`, `/api/files/drill-finish`

## Connection to the bigger picture

The phone profile is the proof that the hub is optional (D-20). The same bundle and package ideas carry the fire drill and the data meter.

## Next

Before you continue, do [Checkpoint 4](../../checkpoints/checkpoint-4/checkpoint.md).

Next: [MS 8.1 — The board, its pages and a PDF with notebook ruling](../ms-08.01/lesson.md).
