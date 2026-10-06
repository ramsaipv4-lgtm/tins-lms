# Trainer prep — Server hardening and integration

## Before you start (prerequisites)

Learners should know a Hono route, regular expressions and the minor profile (D-33). Pre-requisite step: ms-01.01.

## 40-minute self-study path

1. **10 min**: Read the detective question and the five code blocks.
2. **10 min**: Stash `packages/server/src/routes/content.ts`, run the content test, and read the failure.
3. **10 min**: Call `POST /mcp` with `tools/list` and find the three write tools.
4. **10 min**: Do the reinforcement activity.

## Worked example → faded example

**Worked example:** the regex literal versus `new RegExp`.

```ts
const index = 2;
new RegExp(`day0*${index}/x$`).test('day2/x'); // true
```

**Faded example:** build the pattern for `instructor_script_day0*N.md`.

**Blank example:** write the enrolment lookup by `personId` from memory.

## Top misconceptions

1. **"A regex literal can hold a variable."** It cannot; use `new RegExp`.
2. **"An id is the key."** The field is the key; ids come from many sources.
3. **"Read-only tools are safe without a role check."** They read other people's content; check the role.
4. **"A flag can make AI writes safe."** Only a person confirming makes them safe.

## Questions students will ask (with answers)

**Q: Why is AC-94 not claimed?**

A: The journey passes on some runs and times out or counts a document on others; the journal records exactly what fails.

**Q: Who applies a confirmed grade edit?**

A: The confirm route forwards to the normal grade route with the confirmer's cookie, so role rules still apply.

## Your mastery check (private)

1. Explain why stashing the fix proves a new test.
2. Write the guard function from memory.
3. Describe what `grade_edit` changes on the server when called by the AI.

If you can do all three, you're ready to teach this.
