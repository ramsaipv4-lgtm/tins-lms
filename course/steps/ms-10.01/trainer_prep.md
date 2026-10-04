# Trainer prep — GitHub App and Forgejo adapters, push-check hook

## Before you start (prerequisites)
Learners should know fetch, async/await and have seen a small node:http server.

## 45-minute self-study path
1. Read the lesson (15 min).
2. Run `node --test packages/adapters/test/*.test.mjs` (10 min).
3. Add a failing route to the fake and watch the adapter report it (15 min).

## Worked example → faded example
Worked: `personaToken`. Faded: write `mergePullRequest` for a new forge.

## Top misconceptions
- "A fake server is a mock library." It is a real HTTP server on localhost.
- "Blocking the push means printing the key." The message never repeats it.

## Questions students will ask (with answers)
**Why does the test build its credential from pieces?** So the repo's own secret scan stays quiet.

## Your mastery check (private)
Explain why provisioning throws but merge returns `ok: false`.
