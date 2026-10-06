# Instructor script — Server hardening and integration
### Total runtime: **40 minutes**

> Say/Do teleprompter. `[SAY]` lines are read aloud; `[DO]`, `[TYPE]`, `[BOARD]`, `[PAUSE]` are actions;
> `⚠️ LIKELY CROSS-Q` marks questions students usually ask.

## Hook (0:00 — 0:05)

[SAY] Nine teams each passed their own tests, and the merged server still said "not enrolled" to enrolled people. Today we find out why.

[DO] Show the attendance test failing against the old code.

## Faulty first (0:05 — 0:15)

[SAY] Here is a lookup that works for signup and fails for seeds.

[TYPE]
```ts
const enrol = await store.get(db, `enrolment:${personId}`);
```

[SAY] Seeds use `enrolment:c1-l1`. What should we look up instead?

[PAUSE]

[SAY] The id is not the key. The `personId` field is.

⚠️ LIKELY CROSS-Q: Why not rename the seeds? — Answer: seeds are a contract the test suite owns; the server adapts.

## Fix and explain (0:15 — 0:35)

[SAY] Next, a regex that never matched.

[TYPE]
```ts
new RegExp(`(^|/)day0*${d.index}/instructor_script\\.md$`)
```

[SAY] A regex literal does not interpolate. Build it from a string.

[DO] Open `guard.ts`. Change nothing; point at `/api/signin` and say why the second app in `main.ts` is gone.

[SAY] Now MCP. A write tool stores a proposal and returns `pending`. Show `propose` in `mcp.ts`.

[DO] Run the MCP unit test and point at the three tools with `readOnlyHint: false`.

## Check yourself (0:35 — 0:40)

1. [ASK] Why does a write tool return a diff instead of writing? [ANSWER] D-31: a person decides; a tool that cannot write cannot be tricked into writing.
2. [ASK] Why 202 for a minor's practice event? [ANSWER] Accepted, not stored.
3. [ASK] Why is `/assets/*` immutable? [ANSWER] Hashed names.

[SAY] Next time a fix is a workaround, delete it and fix the cause.
