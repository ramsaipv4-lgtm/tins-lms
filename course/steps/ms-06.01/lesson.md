---
id: ms-06.01
title: Server foundation
module: 6
est_minutes: 45
prereqs: []
objectives: 3
new_terms: 6
skills: [http-server-foundation, role-guard, test-mode-gating]
source_refs: [{ path: packages/server/src/core/guard.ts, commit: 8364ba6 }, { path: packages/server/src/core/store.ts, commit: 8364ba6 }, { path: packages/server/src/core/http.ts, commit: 8364ba6 }]
next: end
---

# MS 6.1 — Server foundation

*Step 1 of N*

## Prerequisites

You already understand:
- What an HTTP route, a status code and a cookie are
- How a Node module exports functions
- What a database document with an id is

## You already understand this

- A shop door that only opens for staff: a role check is the same idea in code
- A "reset" button on a test rig: it must exist on the bench and never on the production line

## The detective question

**Problem:** Six later server tasks (pairing, attendance, content, sync, grading, export) all need the same ground: one running server, sessions, role checks, validated input and a way to test it. If each task builds its own, they will disagree.

**Options considered:**
1. Each route module opens its own database and parses its own cookies
2. One shared `ctx` object built once and handed to every route module, with placeholder modules ready to fill
3. A framework with decorators and dependency injection

**Choice:** Option 2: `createCtx()` builds the store, clock, sessions and guards; `routes/index.ts` registers every module with the same `register(app, ctx)` signature.

**Why:** Later builders change one file each and cannot drift on cookies, roles or error shape. Option 3 needs syntax Node cannot strip (D-1), and option 1 repeats security-sensitive code six times.

## Learning objectives

After this step you will be able to:
1. Explain how one Node HTTP server hosts express-pouchdb at `/db` and Hono for everything else (D-9)
2. Read a role guard and say which roles pass it
3. Explain why `/__test/*` must be absent, not just protected, when test mode is off (AC-78)

## Conceptual understanding

The server starts in `main.ts`, reads five environment variables, creates the org on first start, prints `ADMIN_INVITE <code>` once, and prints `LISTENING <port>` when ready. On a hub it also creates a certificate authority: an ECDSA P-256 key whose SHA-256 fingerprint is what pairing later shows in the QR code.

Every `/api/*` request passes one middleware that looks up the session cookie. Only health, join, sign-in and pairing claim work without a session (AC-62). Handlers then add `ctx.guard.role('trainer')` where they need a role.

Invalid input always answers `400 { error: { field: message } }`, built by one zod helper. Secrets (cookies, tokens, the invite) are never logged (D-28).

## Walkthrough of the real code

### The role guard

```ts packages/server/src/core/guard.ts
  const role = (...allowed: string[]) => async (c: any, next: any) => {
    const s = c.get('session');
    if (!s) throw new ApiError(401, { error: { session: 'required' } });
    if (!(s.roles.includes('admin') || s.roles.some((r: string) => allowed.includes(r)))) {
      throw new ApiError(403, { error: { role: 'forbidden' } });
    }
    await next();
  };
```

No session is `401`; a session with the wrong role is `403`. Admin always passes; a substitute passes only where a route lists `substitute`, which is how AC-62 keeps substitutes out of grade sign-off.

### One validation helper

```ts packages/server/src/core/http.ts
export function parseWith<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new ApiError(400, { error: zodFields(r.error.issues) });
  return r.data;
}
```

### Wiping data for tests without breaking /db

```ts packages/server/src/core/store.ts
  async function destroyAll(): Promise<void> {
    // pouch__all_dbs__ is express-pouchdb's own bookkeeping database; destroying it hangs every /db request.
    const all = new Set<string>([...open.keys(), ...names()]);
    for (const n of all) {
      if (n.startsWith('pouch__')) continue;
      try { await new P(n).destroy(); } catch { /* already gone */ }
    }
    open.clear();
  }
```

## Your turn: faulty first

**Mistake 1:** The first `destroyAll` destroyed every folder under the data directory, including express-pouchdb's own `pouch__all_dbs__`. After `/__test/reset`, every request to `/db/...` hung and the test run never finished. Predict what you would see, then find the line that skips `pouch__` names.

**Mistake 2:** The seed test wrote its fixture to a folder the server never searched, and failed with `{"error":{"fixture":"not-found"}}` and `404 !== 200`. Which environment variable tells the server where fixtures live?

**Mistake 3:** Killing a stray server with a pattern match on its command line also killed the shell that typed the command (exit 144). Use the process id instead.

## Technical glossary

- **Session cookie:** an HTTP-only cookie holding a random token the server maps to a person and roles
- **Role guard:** middleware that answers 401 without a session and 403 with the wrong role
- **ctx:** the shared object every route module receives
- **Test mode:** `LMS_TEST_MODE=1`, which registers `/__test/*`
- **Certificate authority (CA):** the hub's own signing key; its fingerprint goes in the pairing QR
- **Fixture:** a JSON file of documents loaded by `/__test/seed`

## Common questions

**Why are join codes stored hashed?** So a copy of the database does not hand out working codes.

**Why does `/__test/*` return 404 instead of 403?** A 403 tells an attacker the route exists.

## Reinforcement activity

Start the server with `LMS_TEST_MODE=1`, log in as a learner with `/__test/login`, and call `POST /api/admin/tnc`. Predict the status, then run it. Repeat as admin.

## Check yourself

1. **Which status does a learner get on an admin route, and which does an anonymous caller get?**

<details>
403 for the learner, 401 for the anonymous caller.
</details>

2. **Why is the CA private key kept out of the org database?**

<details>
The org database replicates to devices; the key must stay in `ca.json` on the hub only.
</details>

3. **What does the server print on stdout at first start?**

<details>
`ADMIN_INVITE <code>` once, then `LISTENING <port>`.
</details>

## Quick reference

```ts
app.post('/api/classes/:id/join-codes', ctx.guard.role('trainer'), handler)
const body = await ctx.http.validateBody(c, zodSchema)
```

## Connection to the bigger picture

Every later server row (AC-65 to AC-77) registers inside the module this step created, and AC-120 (no secrets in logs) is checked on every server test run.

## Next

[Next step — fill in when sequences are known]
