---
id: ms-10.01
title: GitHub App and Forgejo adapters, push-check hook
module: 10
est_minutes: 40
prereqs: [ms-01.01]
objectives: 3
new_terms: 6
skills: [fetch-adapters, fake-servers, secret-scan]
source_refs: [{ path: packages/adapters/src/github.ts, commit: 08b1415f0ae6cca6fe9992219c7d72a449ceca5d }, { path: packages/adapters/src/forgejo.ts, commit: 08b1415f0ae6cca6fe9992219c7d72a449ceca5d }]
next: ms-10.02
---

# MS 10.1 — GitHub App and Forgejo adapters, push-check hook
*Step 37 of 42*

## Prerequisites

- `fetch` and async/await in TypeScript
- Node's `http.createServer`
- What a bearer token is

## You already understand this

- A hotel front desk follows a fixed checklist for each guest: ID, room, key. An adapter follows a fixed checklist of API calls for each learner.
- A bouncer who checks bags at the door never reads the secret letter aloud; the push check names where a key is, never the key.

## The detective question

**Problem:** The app must set up a learner's repo, team and branch protection on GitHub (and on Forgejo, the practice forge), let AI persona bots open pull requests but never merge, and refuse pushes that contain credentials. Tests must never touch a real service.

**Options considered:**
1. Install the vendor SDKs (Octokit) and mock them in tests.
2. Use plain `fetch` with an injected base URL, and test against a small fake HTTP server written with `node:http`.
3. Call the real services from tests with throwaway accounts.

**Choice:** Option 2. The secret check reuses the tins-kit scanner instead of new patterns.

**Why:** SPEC D-14 allows no new dependency; an injected base URL makes the fake server a drop-in; real accounts would be slow, flaky and could leak tokens (D-28).

## Learning objectives

1. Write an adapter whose base URL is injectable and whose failures are reported, not thrown away.
2. Test it against a fake server that records every call.
3. Block secrets in a push without ever repeating them.

## Conceptual understanding

Each adapter method is a fixed list of HTTP calls (SPEC Appendix B). Provisioning throws on any failed step because a half-built learner is worse than an error; merge and write return `{ ok: false, reason, status }` because a refusal is an expected answer for a persona.

Persona tokens carry an expiry no later than the end of the batch, and are refused once `now` reaches it. Time is an argument, never read from the clock.

The push check is a plain Node request handler. With `secretScan` on it scans each file and answers `allowed: false` with the class and location only. Turning it off is allowed but logged with who did it.

## Walkthrough of the real code

The persona token is capped by the batch end, whatever GitHub says.

```ts packages/adapters/src/github.ts
    async personaToken(a: { installationId: number | string; batchEndsAt: number; now: number }): Promise<{ token: string; expiresAt: number } | Failure> {
      if (a.now >= a.batchEndsAt) return { ok: false, reason: 'batch has ended; no persona token issued' };
      const r = await call('POST', `${api}/app/installations/${a.installationId}/access_tokens`, {});
      if (!r.ok) return fail('persona token', r);
      const given = r.body?.expires_at ? Date.parse(r.body.expires_at) : NaN;
      const expiresAt = Number.isFinite(given) ? Math.min(given, a.batchEndsAt) : a.batchEndsAt;
      return { token: r.body.token as string, expiresAt };
    },
```

The push check refuses with a message that carries class and location, never the matched value.

```ts packages/adapters/src/forgejo.ts
      if (!secretScan) return send(200, { allowed: true });
      const files: Array<{ path: string; content: string }> = Array.isArray(payload?.files) ? payload.files : [];
      const hits: string[] = [];
      for (const f of files) {
        for (const h of scanText(String(f.path), String(f.content ?? ''))) hits.push(`${h.path}:${h.line} (${h.class})`);
      }
      if (hits.length === 0) return send(200, { allowed: true });
      // Report class and location only; the matched value is never repeated.
      send(200, {
        allowed: false,
        message: `Push blocked: a possible secret was found at ${hits.join(', ')}. Rotate this key now (treat it as leaked), remove it from the files, then push again.`,
      });
```

## Your turn: faulty first

One real mistake from the build journal. Find the bug before reading the fix.

1. `node --test packages/adapters/test/` (a directory) failed with `MODULE_NOT_FOUND` and a test failure on the folder itself. Fix: pass the glob `packages/adapters/test/*.test.mjs`.

## Technical glossary

- **Adapter:** a module that hides one outside service behind a few methods.
- **Injectable base URL:** the service address is a parameter, so tests point it at a fake.
- **Fake server:** a tiny local HTTP server that answers like the real one and records calls.
- **Branch protection:** rules that stop force-pushes and require a pull request on `main`.
- **Persona token:** a short-lived token for an AI bot that expires by the batch end.
- **Push check:** a hook that inspects pushed files before they are accepted.

## Common questions

**Q: Why not return the Forgejo password?** A: Secrets are never shown after entry (D-28); the learner must change it at first login.

**Q: Why build the test credential from pieces?** A: So no secret-shaped text sits in the repo and trips the scan.

## Reinforcement activity

Add a second fake route that returns 500 for the repo-generate call and check that `provisionLearner` rejects.

## Check yourself

1. Which methods report a refusal instead of throwing?
<details>`mergePullRequest`, `writeFile`, `personaToken` and `installPushCheck`.</details>
2. What caps a persona token's expiry?
<details>The `batchEndsAt` argument: the result is the smaller of the service expiry and the batch end.</details>
3. What does the push check say about a found key?
<details>Its class and file:line, plus "rotate this key"; never the key itself.</details>
4. What is logged when the scan is switched off?
<details>The switch name, `on: false`, who turned it off, and the time.</details>

## Quick reference

- `createGithubAdapter({ apiUrl, graphqlUrl, token, org })`
- `createForgejoAdapter({ apiUrl, token, org })`
- `createPushCheck({ log })` returns `{ handler, setSecretScan(on, by) }`

## Connection to the bigger picture

The server's forge exercises (SPEC D-34) run on Forgejo first and call these adapters.

## Next

Next: [MS 10.2 — Encrypted backup targets and Google API adapters](../ms-10.02/lesson.md).
