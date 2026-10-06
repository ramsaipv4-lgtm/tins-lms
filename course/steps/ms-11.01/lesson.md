---
id: ms-11.01
title: Server hardening and integration
module: 11
est_minutes: 40
prereqs: [ms-01.01]
objectives: 4
new_terms: 6
skills: [integration-testing, regex, http-caching, json-rpc, least-privilege]
source_refs: [{ path: packages/server/src/core/guard.ts, commit: e47e1f069f4befedd67447740e6bf2f34660ac40 }, { path: packages/server/src/routes/content.ts, commit: e47e1f069f4befedd67447740e6bf2f34660ac40 }, { path: packages/server/src/routes/attendance.ts, commit: e47e1f069f4befedd67447740e6bf2f34660ac40 }, { path: packages/server/src/routes/grading.ts, commit: e47e1f069f4befedd67447740e6bf2f34660ac40 }, { path: packages/server/src/routes/mcp.ts, commit: e47e1f069f4befedd67447740e6bf2f34660ac40 }, { path: packages/server/src/core/static.ts, commit: e47e1f069f4befedd67447740e6bf2f34660ac40 }]
next: end
---

# MS 11.1 — Server hardening and integration
*Fixing what only shows up when the pieces meet*

## Prerequisites

- A route handler in Hono (a function that gets a request and returns JSON)
- What a regular expression is and what a template string is
- That a Coach space exists and minors have trackers switched off (D-33)

## You already understand this

- Two people can each build a correct part and the join between them is still wrong.
- A rule written in two places will eventually disagree with itself.
- "Read only" means looking without touching.

## The detective question

**Problem:** Nine teams merged into one server. Attendance said "not enrolled" for people who were enrolled, sealed lesson bodies held only titles, the sign-in routes needed a second app to dodge the session check, and the AI tool server (MCP) did not exist.

**Options considered:**
1. Patch each symptom where it appeared (a second app for sign-in, a compression middleware inside the board feature).
2. Fix each cause in the one module that owns the rule, and delete the workaround.
3. Add a flag so that AI write tools can run when a setting allows.

**Choice:** Option 2, and for MCP write tools a pending proposal instead of a flag.

**Why:** A workaround outlives its cause and becomes the next bug. A tool that cannot write cannot be tricked into writing, so D-31 ("AI proposes, people decide") holds by construction.

## Learning objectives

1. Spot a regex literal that was meant to be built from a variable.
2. Make a central guard follow SPEC so workarounds can be deleted.
3. Return a pending diff from a write tool and keep read tools read-only.
4. Apply a data rule (minor profile) at the route and again at the replication gate.

## Conceptual understanding

**Integration defect:** a bug that no single module owns. Each part passes its own tests; the join fails.

**Guard:** the one function that decides which paths need no session. If it says `/api/sign-in` and SPEC says `/api/signin`, every later route either gets 401 or needs a detour.

**Seeds versus signup:** signup writes `enrolment:<personId>`, seeds write `enrolment:c1-l1`. The id is not the key; the `personId` field is. Look people up by the field.

**MCP:** the Model Context Protocol, spoken as JSON-RPC 2.0 over `POST /mcp`. A tool announces `readOnlyHint`. Our three write tools (`grade_edit`, `post_message`, `repo_write`) store a proposal and return `{ status: 'pending', diff, pendingId }`.

**Minor profile (D-33):** an under-18 learner has Coach trackers off and an integrity log with exam events only.

**Immutable asset:** a build file whose name contains a content hash never changes, so the browser may keep it for a year.

## Walkthrough of the real code

The guard now follows SPEC, so the second app in `main.ts` could be deleted:

```ts packages/server/src/core/guard.ts
// Routes that need no session (SPEC AC-62): health, join, signin and pairing claim.
export function isPublicApi(path: string): boolean {
  return path === '/api/health'
    || path === '/api/join' || path.startsWith('/api/join/')
    || path === '/api/signin' || path.startsWith('/api/signin/')
    || path === '/api/pairing/claim';
}
```

The instructor-script lookup was a regex literal; it is now built from the day index:

```ts packages/server/src/routes/content.ts
        const script = Object.entries<string>(pkg.files).find(([p]) => new RegExp(`(^|/)day0*${d.index}/instructor_script\\.md$`).test(p) || new RegExp(`instructor_script_day0*${d.index}\\.md$`).test(p))?.[1];
```

Attendance finds the enrolment by field and lets the schedule decide the day:

```ts packages/server/src/routes/attendance.ts
  async function enrolmentOf(db: string, personKey: string) {
    return (await store.list(db, 'enrolment:')).find((e: any) => ids.keyOf(String(e.personId ?? e.id)) === personKey) ?? null;
  }

  // The class day for "today" (UTC date): the schedule entry whose date is today, even when no package content exists
  // for that day; otherwise the last day (schedule or package) not after today, else 0.
  async function todayIndex(db: string, classKey: string, now: number): Promise<number> {
    const today = new Date(now).toISOString().slice(0, 10);
    const sched: any[] = (await store.get(db, `class:${classKey}`))?.schedule ?? [];
    const exact = sched.findIndex((d: any) => String(d?.date) === today);
    if (exact >= 0) return exact;
```

A minor's practice events are dropped, not stored:

```ts packages/server/src/routes/grading.ts
    // D-33: a minor's integrity log keeps exam events only; practice events are dropped, not stored.
    if (b.context !== 'exam' && await ctx.people.isMinorPerson(ctx, s.personId)) return c.json({ ok: true, stored: false }, 202);
```

An MCP write tool only builds a diff and stores a proposal:

```ts packages/server/src/routes/mcp.ts
    const pendingId = ids.randomKey();
    await store.put(store.priv, { id: `mcppending:${pendingId}`, type: 'mcpPending', tool: name, args: a, diff, status: 'pending', proposedBy: session.personId, createdAt: ctx.clock.now() });
    return { status: 'pending', diff, pendingId };
```

Files under `/assets/` carry a content hash, so they are cached for a year:

```ts packages/server/src/core/static.ts
  else if (rel.split(sep).includes('assets')) headers['cache-control'] = 'public, max-age=31536000, immutable'; // hashed build files
```

## Your turn: faulty first

Two real mistakes from this build.

1. A regex literal with a placeholder:

```ts
// WRONG: this is a regex literal, so ${d.index} is just characters
/(^|\/)day0*${d.index}\/instructor_script\.md$/.test(path)
```

The symptom was a sealed lesson whose body was only the title (`"Warm-up"`). What do you change?

2. A strict argument schema for a tool that never executes: the MCP test sent `post_message` arguments in a shape I had not guessed and got `{"code":-32602,"message":"invalid arguments: recipients"}`. Why is strictness the wrong default for a tool that only records a proposal?

## Technical glossary

- **Integration defect**: a fault in the join between modules.
- **Guard**: the central rule for which routes need a session.
- **MCP**: Model Context Protocol, JSON-RPC 2.0 over HTTP.
- **Pending diff**: a described change that has not happened yet.
- **readOnlyHint**: the tool annotation that says a tool does not change anything.
- **Immutable**: a cache directive for files whose name changes when the content does.

## Common questions

1. **Why not execute the write after a setting is on?** Because then a prompt can reach a write. A proposal needs a person.
2. **Why 202 for a dropped practice event?** The request was understood and nothing was stored.
3. **Why enforce the minor rule in two places?** The route covers the API; the replication gate covers `/db/*`.

## Reinforcement activity

Add a read tool `list_appeals` to the MCP server for staff only, with a test that a learner gets an error. Keep it read-only and say which `readOnlyHint` it carries.

## Check yourself

1. Why did the regex never match? <details>A regex literal does not interpolate `${...}`; build it with `new RegExp(string)`.</details>
2. A seed stores `enrolment:c1-l1` with `personId: 'l1'`. Why does `store.get(db, 'enrolment:l1')` fail? <details>The id is not the key; the lookup must use the `personId` field.</details>
3. What does an MCP write tool return, and what has changed on the server? <details>`{ status: 'pending', diff, pendingId }`; only a proposal record was stored.</details>
4. Why is it safe to cache `/assets/*` for a year? <details>The file name carries a content hash, so new content gets a new URL.</details>

## Quick reference

- Public API prefixes: `/api/health`, `/api/join`, `/api/signin`, `/api/pairing/claim`.
- MCP: `POST /mcp`; write tools `grade_edit`, `post_message`, `repo_write`.
- Confirm a proposal: `POST /api/mcp/pending/:id/confirm`.

## Connection to the bigger picture

Rows AC-102, AC-116, AC-120 and AC-122 close the spec's cross-cutting rules. AC-94 (screenshot import) was attempted and left open, see the journal.

## Next

This is the last step for now (`next: end`).
