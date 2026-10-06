---
id: ms-11.02
title: Web shell integration - hooks, nav collisions and the service worker
module: 11
est_minutes: 45
prereqs: [ms-07.01]
objectives: 3
new_terms: 5
skills: [shell-hooks, nav-contract, service-worker]
source_refs: [{ path: packages/web/src/app/nav.ts, commit: 234f30a }, { path: packages/web/src/sw.ts, commit: 234f30a }]
next: end
---

# MS 11.2 - Web shell integration: hooks, nav collisions and the service worker

*Step 2 of N*

## Prerequisites

You already understand:
- How a feature group registers routes (ms-07.01)
- What a service worker is

## You already understand this

- A building with nine tenants who each put a sign on the door: visitors read the signs, so two tenants called "Office" confuse everyone.
- A queue at a counter that serves one customer at a time: nobody else is served until the queue is empty.

## The detective question

**Problem:** Nine groups built in parallel each worked around a missing shell feature, and their nav names collide. The board also opens too slowly on a cheap phone.

**Options considered:**
1. Fix every workaround inside its own group
2. Give the shell one small hook per concern, delete the workarounds, and check nav names with a script in the gate
3. Reorder the files the service worker precaches

**Choice:** Option 2, and for the board an own service worker instead of option 3.

**Why:** The generated worker fetches its precache one file at a time and controls no page until it finishes, so order cannot help; a small core installed in parallel gives control within moments.

## Learning objectives

After this step you will be able to:
1. Declare a per-role space home, a switch-gated nav entry and a cross-space link in the registry
2. Read a collision report from `scripts/navcheck.mjs` and decide between a fix and a reviewed pin
3. Explain why install size decides when a service worker controls the page

## Conceptual understanding

A route may carry `home`, `switch` and `link`. The shell reads them; groups never hide each other's links. Nav order is `order`, then label, and a journey that names a screen by a pattern gets the first entry that matches. `navcheck` reads the groups' routes, the strings and the patterns in SPEC Appendix D, and lists every pattern that matches two labels one role sees in one space. The service worker has two caches: a core cache fetched in parallel at install, and a board cache that the page asks for (staff only) once the shell is ready.

## Walkthrough of the real code

### Which screen is a space's home

```ts packages/web/src/app/nav.ts
// Per-role space home (registry `home`): the first route declaring one that covers every role this person holds in the
// space (a trainer who is also coordinator keeps the generic home).
export function homeRoute(routes: FeatureRoute[], space: Space, roles: string[], label: (key: string) => string): FeatureRoute | null {
  const mine = SPACE_ROLES[space].filter((r) => roles.includes(r));
  if (!mine.length) return null;
  return sortRoutes(routes.filter((r) => r.space === space && r.home && mine.every((x) => (r.home as string[]).includes(x))), label)[0] ?? null;
}
```

### The core install

```ts packages/web/src/sw.ts
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE);
    await pool(entries, 8, async (e) => {
      const path = abs(e.url);
      if (await cache.match(path)) return;
      // Built assets carry a content hash in their name, so the browser's own cache may answer; the rest must be fresh.
      const res = await fetch(new Request(path, path.startsWith('/assets/') ? {} : { cache: 'reload' }));
      if (!res.ok) throw new Error(`precache ${path}: ${res.status}`);
      await cache.put(path, res);
    });
    await self.skipWaiting();
  })());
});
```

## Your turn: faulty first

Faulty attempt 1: after the shell change every pseudo-locale test hung with `page.goto: Timeout 30000ms exceeded` while the plain ones passed. What do you check first? (The only difference is the server injecting a meta tag into index.html; check its size against the compression threshold.)

Faulty attempt 2: the coach "Today" link was removed as a workaround and the journey failed with `no visible link/button/tab named /^(today|day 0|class|my class)$/i`. What do you change? (Add a nav entry whose `link` points at the other space's screen.)

## Technical glossary

- **Home hook**: `home: [roles]` on a route makes it the screen at `/<space>`.
- **Switch gate**: `switch` hides a nav entry while a feature switch is off.
- **Collision**: one pattern matching two visible labels.
- **Core cache**: files fetched at install; the worker controls the page after it.
- **Warm**: fetching the board's chunks in the background on request.

## Common questions

- *Why not hide the Coach links with CSS?* A group would then guess another group's URLs; the shell knows the routes.
- *Does warming the board break "not downloaded until opened"?* No: SPEC Appendix C allows background precache and the page itself does not request it.

## Reinforcement activity

Write the order in which these appear for a learner: "Today" (order 5), "Day 0" (order 0), "Catch-up" (order 1). Which one does a pattern `/today|day 0/` open? (Day 0, then Catch-up, then Today by order; the pattern opens "Day 0".)

## Check yourself

1. Why does ordering the precache not make the page controlled sooner?
<details>The worker fetches entries one at a time and controls no page until install finishes.</details>
2. Why is the board warmed only for staff?
<details>A learner never opens the board, and the files would cost their data.</details>
3. When is a navcheck collision pinned instead of fixed?
<details>When the journey is green with the current winner; a changed winner or a new collision then fails the gate.</details>

## Quick reference

`homeRoute`, `navEntries`, `switchOn`, `kioskOn`, `scripts/navcheck.mjs`, `warm-board.json`.

## Connection to the bigger picture

This is the integration step: the groups stay independent and the shell offers the shared hooks.

## Next

End of this unit for now.
