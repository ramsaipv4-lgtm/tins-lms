---
id: ms-06.06
title: Export, import and signed class packages
module: 6
est_minutes: 45
prereqs: [ms-06.01]
objectives: 4
new_terms: 6
skills: [export-manifest, signed-package, device-key, secret-scrubbing]
source_refs: [{ path: packages/server/src/routes/export.ts, commit: adbf74e }]
next: ms-06.08
---

# MS 6.6 — Export, import and signed class packages
*Step 24 of 42*

## Prerequisites

You already understand:
- The shared `ctx` and role guards from the server foundation
- What a SHA-256 hash is and that a public key can check a signature made by a private key
- That a tar file is a plain list of named files

## You already understand this

- A parcel with a packing slip: the manifest is the slip, and checking it against the box tells you if anything went missing
- A wax seal: anyone can look at the seal, only the sender owns the stamp

## The detective question

**Problem:** A trainer without internet must still teach from a class package, and a learner's phone must hand work back as a file. Both files travel by USB stick or chat app, so nothing about the channel can be trusted. The admin also needs a full backup that can be loaded into an empty server, and that backup must never leak a key.

**Options considered:**
1. Plain zip of JSON files, trusted because it came from "our" server
2. A tar with a manifest of SHA-256 hashes, wrapped in an ECDSA signature container; learners sign with a per-device key the hub already knows
3. Encrypt the whole export with a shared password

**Choice:** Option 2. The export is a tar whose `manifest.json` lists every other file; class packages and learner files are signed containers (SPEC §4.24, D-26).

**Why:** A manifest catches missing, extra and changed files exactly. A signature proves who made the file, which a shared password cannot (everyone holds it). Option 1 trusts the channel, which is the one thing we cannot do.

## Learning objectives

After this step you will be able to:
1. Say what is in the export tar and why the manifest does not list itself
2. Explain why the hub keeps its private signing key in the private database only
3. Explain how a submission file is accepted or refused (bad signature, unknown signer, not enrolled)
4. Explain why export code removes secret-looking keys before writing

## Conceptual understanding

`GET /api/export` (admin) reads the org database and every class database and writes: `manifest.json`, `README.md`, `roster.csv`, `attendance.csv`, `grades.csv`, one `.md` per day, `data/<db>.json` (the full documents, used by import), `ledger/` and `events/` JSON, and `board/board.json`. `GET /api/me/export` runs the same builder with a filter that keeps only the caller's documents.

`POST /api/import` unpacks the tar, checks it with `verifyManifest`, and refuses with 400 on any mismatch before it writes a single document. Only the `data/` files are read back.

`GET /api/classes/:id/package?day=N` builds a small tar (class and day structure, no section bodies, because bodies stay sealed until released) and signs it with the hub key. A learner device registers its public key with `POST /api/me/device-key`; a file posted to `POST /api/classes/:id/files` is opened with the keys of the class's enrolled learners only.

## Walkthrough of the real code

### The hub key pair

```ts packages/server/src/routes/export.ts
  // ---- hub signing key pair: the private half lives only in the private db and is never exported ----
  let hubKeys: Promise<{ publicJwk: JsonWebKey; privateJwk: JsonWebKey }> | null = null;
  async function loadHubKeys() {
    const doc = await ctx.store.get(priv, 'hubkey:signing');
    if (doc?.privateJwk && doc?.publicJwk) return { publicJwk: doc.publicJwk, privateJwk: doc.privateJwk };
    const keys = await generateSigningKeys();
    await ctx.store.put(priv, { type: 'hubkey', id: 'hubkey:signing', schema: ctx.schema, ...keys, updatedAt: ctx.clock.now(), updatedBy: 'hub' });
    return keys;
  }
  const getHubKeys = () => (hubKeys ??= loadHubKeys().catch((e) => { hubKeys = null; throw e; }));
  ctx.hooks.onReset.push(() => { hubKeys = null; });
```

Keys are made on first use and stored in the private database, which `/db` never serves and the export never lists. Caching the promise (not the value) stops two simultaneous first requests from creating two different keys. The reset hook clears the cache because `/__test/reset` wipes the database.

### Scrubbing secrets from exports

```ts packages/server/src/routes/export.ts
const SECRET_KEY = /(private|secret|token|passphrase|password|cookie|^d$|hash$)/i;
const SECRET_KEEP = new Set(['hash', 'prevHash']); // ledger chain hashes are not secrets

function clean(value: any): any {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    const out: Doc = {};
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEY.test(k) && !SECRET_KEEP.has(k)) continue;
      out[k] = clean(v);
    }
    return out;
  }
  return value;
}
```

Every document passes through `clean` on the way out and on the way in. Names ending in `hash` (such as a stored code hash) are dropped, but the ledger's own `hash` and `prevHash` fields are kept, otherwise the exported ledger could no longer be verified.

### Who signed this file?

```ts packages/server/src/routes/export.ts
    const all = await openPackage(buf, candidates.map((k) => k.publicJwk));
```

`candidates` are the registered device keys of learners with an active enrolment in this class. An unknown signer gets 403 (`untrusted`); a changed byte gets 400.

## Your turn: faulty first

**Mistake 1:** I called `kit pattern add atomic-write` "to be safe". It copied a `lib/` folder and changed `.tins/patterns.lock`, both outside my scope, and my code writes no files to disk at all. Predict what `git status` showed, and which kit rule says when a pattern is needed.

**Mistake 2:** My first attempt to write `export.ts` failed with `File has not been read yet. Read it first before writing to it.` The file existed as a placeholder. What does that guard protect against?

**Mistake 3 (predict):** If `SECRET_KEY` had no `SECRET_KEEP` list, what would break in the exported ledger, and which test would you write to see it?

## Technical glossary

- **Manifest:** a sorted list of `{ path, sha256, size }` for every file except itself
- **ustar tar:** a plain archive format; the system `tar -tf` can list it
- **ECDSA P-256:** the signature scheme used for packages (D-26)
- **JWK:** a key written as JSON; the private one has a `d` field
- **Device key:** a key pair made on a learner's device; only the public half is sent to the hub
- **Signed container:** the package bytes plus signer identity and signature

## Common questions

**Why does the manifest not list itself?** A file cannot contain its own hash.

**Why is a dropped learner's file refused?** Only active enrolments count as trusted signers.

## Reinforcement activity

Export from a seeded server, unpack the tar with `tar -tf`, then change one byte of `roster.csv` inside it and post it to `/api/import`. Predict the status and the field name in the error.

## Check yourself

1. **Where is the hub private signing key stored?**

<details>
In the private database (`lms-private`) only; it is not replicated and not exported.
</details>

2. **What status does a package signed by an unknown key get at `/files`?**

<details>
403, with `{ error: { file: 'untrusted' } }`.
</details>

3. **Why must import verify the manifest before writing?**

<details>
A half-imported, tampered export would leave a mixed database that is hard to undo.
</details>

4. **Why are section bodies left out of the class package?**

<details>
Bodies are served sealed and released with the teleprompter (AC-68); a package must not bypass that.
</details>

## Quick reference

```ts
const signed = await signPackage(tarPack(files), privateJwk)
const r = await openPackage(bytes, trustedPublicJwks) // { ok, files } or { ok:false, reason }
```

## Connection to the bigger picture

AC-74 to AC-77 sit on the core functions of §4.24 (AC-42 to AC-44). The web export button (AC-98) and the files journey (AC-96) call these routes.

## Next

Next: [MS 6.8 — Sign-out, passkeys and the sign-in gate](../ms-06.08/lesson.md).
