---
id: ms-03.04
title: Manifests, tar archives, signed class packages
module: 3
est_minutes: 45
prereqs: [ms-01.01]
objectives: 3
new_terms: 6
skills: [manifest, tar-ustar, ecdsa-signing]
source_refs: [{ path: packages/core/src/export.ts, commit: 415c2ebf29dc4d715fc607edc2b51a92c86f389f }]
next: ms-03.05
---

# MS 3.4 — Manifests, tar archives, signed class packages
*Step 9 of 41*

## Prerequisites

You already understand:
- SHA-256 hashes and why equal bytes give equal hashes
- Public and private keys, and what a signature proves
- Uint8Array and async/await in TypeScript

## You already understand this

- A parcel with a packing slip: the slip lists what should be inside, and you check the box against it
- A sealed envelope with a stamp: if the stamp is wrong or the paper is torn, you refuse it

## The detective question

**Problem:** A trainer exports a class (rosters, grades, notes, ledgers) and sends it to another site. The receiver must know three things: nothing is missing or extra, nothing was altered, and it really came from a key they trust. Core has zero runtime dependencies and may not touch the file system.

**Options considered:**
1. Use a zip or tar library from npm
2. Write the POSIX ustar format ourselves, add a manifest of hashes, and wrap the archive in an ECDSA P-256 signature using Web Crypto
3. Send JSON with base64 file bodies and sign that

**Choice:** Option 2: `tarPack` and `tarUnpack` by hand, `buildManifest` and `verifyManifest` for contents, and `signPackage` and `openPackage` for origin.

**Why:** SPEC D-3 forbids new dependencies. ustar is tiny (512-byte blocks) and the system `tar` can check our output, which makes the format testable against an independent reader. Option 3 inflates binaries by a third and has no standard tool to inspect it.

## Learning objectives

1. Build and verify a sorted manifest and report missing, extra and changed files exactly
2. Write and read the ustar header: octal fields, checksum, two zero end blocks
3. Sign an archive and open it with a three-way outcome: `bad-signature`, `untrusted`, `corrupt`

## Conceptual understanding

**Manifest.** A list of `{ path, sha256, size }`, sorted by path so two exports of the same files give the same manifest. `verifyManifest` compares by path and returns three sorted lists.

**ustar.** Each file is a 512-byte header, then the bytes padded to a multiple of 512. The header has the name (100 bytes), mode, size in octal text, a checksum, a type flag, and the magic `ustar`. The checksum is the sum of all header bytes with the checksum field counted as eight spaces. The archive ends with two all-zero blocks. Names longer than 100 bytes split at a `/` into a prefix field (155 bytes) and a name field.

**Signed container.** `LMSP1` magic, key length, the signer's public key, a 64-byte signature, then the archive. `openPackage` checks the signature with the embedded key first (`bad-signature`), then checks that key is in the trusted list (`untrusted`). Anything malformed is `corrupt`.

## Walkthrough of the real code

### Manifest comparison

```ts packages/core/src/export.ts
  const missing = manifest.files.map((f) => f.path).filter((p) => !seen.has(p));
  return { missing: missing.sort(byPath), extra: extra.sort(byPath), changed: changed.sort(byPath) };
```

`missing` is computed last, from the manifest, so it never depends on file order.

### The ustar checksum

```ts packages/core/src/export.ts
    h.fill(0x20, 148, 156); // checksum counts as spaces
    h[156] = 0x30; // '0' regular file
    h.set(utf8Encode('ustar'), 257); // magic "ustar\0"
    h.set(utf8Encode('00'), 263); // version
    h.set(prefix, 345);
    let sum = 0;
    for (let i = 0; i < BLOCK; i++) sum += h[i];
    writeOctal(h, 148, 7, sum); // six digits + NUL, then a space
    h[155] = 0x20;
```

The field is filled with spaces before summing. The stored value is six octal digits, a NUL, then a space, which is what GNU tar writes.

### Opening a package

```ts packages/core/src/export.ts
  if (!valid) return { ok: false, reason: 'bad-signature' };
  const id = pubIdentity(embedded);
  if (!trustedPublicJwks.some((k) => pubIdentity(k) === id)) return { ok: false, reason: 'untrusted' };
```

Order matters: a valid signature from an unknown signer is `untrusted`; a flipped byte fails the signature first.

## Your turn: faulty first

*This task hit no real defects (see the journal), so these two faults are constructed, not taken from my transcript.*

**Fault 1: a tar header that only looks right**

A draft that sums the checksum without first filling the field with spaces produces an archive our own `tarUnpack` accepts only if it uses the same wrong rule. Real `tar -tf` rejects it with `tar: This does not look like a tar archive`.

**Predict:** why would a round-trip test alone not catch it?
**Run it:** `tar -tf x.tar` on the archive.
**Diagnose:** both sides share the mistake, so only an independent reader finds it.
**Fix:** space-fill 148..155, sum, then write the octal value. Keep the `tar -tf` check in the test.

**Fault 2: sorting by locale**

Using `localeCompare` for manifest paths orders `B` and `a` differently on different machines. Use plain `<` and `>` (code unit order) so every site produces the same manifest.

## Technical glossary

- **Manifest:** a sorted list of paths with hash and size.
- **ustar:** the POSIX tar header layout with the `ustar` magic.
- **Octal field:** a number written as base-8 ASCII digits ending in NUL.
- **ECDSA P-256:** signature scheme with 64-byte raw signatures in Web Crypto.
- **JWK:** JSON form of a key.
- **Trusted key list:** the public keys a receiver accepts.

## Common questions

**Q: Why does the manifest not list itself?**
A: A file cannot contain its own hash; the SPEC says the manifest is left out.

**Q: Why embed the public key if the receiver already trusts keys?**
A: It tells the receiver which key to test, and the trusted list decides whether to accept it.

## Reinforcement activity

Pack two files, one with an empty body, and run `tar -tvf` on the result. Then flip one byte inside a header and unpack again; predict the error before running.

## Check yourself

1. How many bytes does an empty file take in the archive?
   <details>512, the header only; the data is padded to zero blocks.</details>
2. What ends a ustar archive?
   <details>Two 512-byte blocks of zeros.</details>
3. A package is signed by a key not in the trusted list, and no byte was changed. What does `openPackage` return?
   <details>`{ ok: false, reason: 'untrusted' }`.</details>
4. Why are manifest paths sorted?
   <details>So the same set of files always yields the same manifest, on any machine.</details>

## Quick reference

```ts
const m = await buildManifest(files);
const diff = await verifyManifest(files, m);   // { missing, extra, changed }
const archive = tarPack(files);
const back = tarUnpack(archive);
const keys = await generateSigningKeys();
const pkg = await signPackage(archive, keys.privateJwk);
const opened = await openPackage(pkg, [keys.publicJwk]);
```

## Connection to the bigger picture

The export route `GET /api/classes/:id/package` returns this container, and package import (§4.29) opens it. The hash helpers come from ms-01.01.

## Next

Next: [MS 3.5 — Recovery words and crypto-shredding](../ms-03.05/lesson.md).
