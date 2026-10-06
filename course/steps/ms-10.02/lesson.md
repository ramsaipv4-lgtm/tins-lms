---
id: ms-10.02
title: Encrypted backup targets and Google API adapters
module: 10
est_minutes: 50
prereqs: [ms-09.01]
objectives: 4
new_terms: 6
skills: []
source_refs: [{ path: packages/adapters/src/backup.ts, commit: 2dec128 }, { path: packages/adapters/src/google.ts, commit: 2dec128 }]
next: ms-10.03
---

# MS 10.2 — Encrypted backup targets and Google API adapters
*Step 38 of 41*

*Adapter integrations: backup encryption, Google Meet/Calendar/Forms*

## Prerequisites

You understand how modules are shaped by their contract (SPEC or acceptance tests), and you've seen fetch-based HTTP clients handle JSON and binary data.

## You already understand this

- **Async/await and Promises:** You can write fetch-based HTTP clients with error handling
- **Binary data in Node.js:** You know Uint8Array, Buffer, and why they're different
- **Web Crypto:** You've used `crypto.subtle` for hashing and encryption
- **Feature flags/switches:** You understand how optional features are enabled/disabled
- **File I/O in Node:** You know `fs.writeFileSync` and `fs.readFileSync` basics

## The detective question

**Problem:** 
The backup module needs to upload encrypted copies of class data to storage (cloud or USB), but the real service APIs (S3, Google Drive) should never see plaintext. The Google integrations (Meet links, calendar events, quiz export) are optional features that must be switched off by default and check their switch before making any HTTP request.

**Options considered:**

1. **Encryption key management:** 
   - Store keys in code (rejected: security risk)
   - Derive keys directly from passphrases (risky: weak passphrases)
   - Stretch passphrases with PBKDF2, then derive final keys with HKDF (chosen: follows SPEC D-26)

2. **Folder target implementation:**
   - Use global in-memory Map to store backups (faster for tests, but doesn't match acceptance tests)
   - Write files to the file system with Node's fs module (slower, but passes acceptance tests that verify actual files exist)
   - Use HTTP fake for consistency with S3/Drive (over-engineered for local storage)

3. **Google switch handling:**
   - Centralized check in a middleware function (adds abstraction)
   - Per-method check at the start of each method (simpler, matches contract)
   - Default switches to "on" if not explicitly set (wrong: spec says missing = off)

**Choice:**
- PBKDF2 (600k iterations) + HKDF: stretch passphrase, then derive key
- Folder target: uses `fs.writeFileSync` / `fs.readFileSync` to persist backups on disk
- Google adapters: each method checks `switches[name] === true` at the start, throws if false

**Why:**
- PBKDF2 + HKDF matches the language in SPEC D-26 ("passphrases stretched with PBKDF2; keys derived with HKDF")
- File system I/O is what acceptance tests check for (they call `readFileSync` to verify encrypted files exist)
- Per-method checks are simple and match the contract's requirement that methods reject with an error naming the switch

## Learning objectives

By the end, you'll understand:

1. How to encrypt data before upload so the service never sees plaintext
2. Why PBKDF2 + HKDF is used instead of just one algorithm
3. How to handle optional features with feature switches
4. Why acceptance tests for file-based targets require actual file system I/O

## Conceptual understanding

### Encryption before upload (AC-113)

The backup module stores encrypted copies of class data. The flow is:

1. **Backup:** Plaintext (e.g., 100MB of student data) → Encrypt → Ciphertext → Upload to S3/Drive/USB
2. **Restore:** Download ciphertext → Decrypt → Plaintext → Verify it matches the original

The key insight: **encryption happens before the data leaves your device**. S3 and Google never see the plaintext, even if their API credentials are leaked.

Encryption steps:
- Generate a random salt (16 bytes)
- Stretch the passphrase with PBKDF2-SHA-256 (600,000 iterations, salt) → 32-byte key
- Derive final key with HKDF-SHA-256 using that stretched key
- Encrypt plaintext with AES-GCM (generates fresh 12-byte IV for each message)
- Upload: `[salt (16 bytes)][IV (12 bytes)][ciphertext][auth tag]`
- Download: extract salt, derive same key, extract IV, verify auth tag, decrypt

### Google integrations as optional features (AC-114)

Three Google APIs are integrated:

| Method | Purpose | Switch | API calls |
|--------|---------|--------|-----------|
| `createMeetLink({ title })` | Generate a Google Meet link | `meetLinks` | `POST /v2/spaces` |
| `syncCalendar({ calendarId, events })` | Create events in learner's calendar | `calendarSync` | `POST /calendar/v3/calendars/:id/events` |
| `exportQuiz({ title, questions })` | Generate and publish a Google Form | `googleForms` | `POST /v1/forms`, `:batchUpdate`, `:setPublishSettings` |

Each is **off by default**. Before making any API call, check:
```ts
const isOn = switches[name] === true;  // Must be explicitly true
if (!isOn) throw new Error(`Switch ${name} is off`);
```

If a switch is off, the method rejects immediately without touching the network.

## Walkthrough of the real code

### Backup: deriving the encryption key

```ts packages/adapters/src/backup.ts
async function deriveKeyFromPassphrase(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  // Step 1: PBKDF2 to stretch the passphrase
  const passwordKey = await globalThis.crypto.subtle.importKey('raw', utf8Encode(passphrase), 'PBKDF2', false, ['deriveBits']);
  const stretchedKeyBits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt,
      iterations: 600000,
    },
    passwordKey,
    256 // 256 bits = 32 bytes
  );
  const stretchedKey = new Uint8Array(stretchedKeyBits);

  // Step 2: HKDF to derive the final encryption key
  const finalKey = await hkdfSha256(stretchedKey, salt, utf8Encode('backup'), 32);
  return finalKey;
}
```

The two-step approach is stronger than just PBKDF2:
- PBKDF2 stretches a weak passphrase to a strong key
- HKDF re-derives from that stretched key, adding domain separation (the 'backup' info string)

### Backup: encrypt before upload

```ts packages/adapters/src/backup.ts
export async function backup(target: BackupTarget, options: { name: string; bytes: Uint8Array; passphrase: string }): Promise<{ ref: string }> {
  // Generate random salt
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));

  // Derive key from passphrase
  const key = await deriveKeyFromPassphrase(options.passphrase, salt);

  // Encrypt the data
  const encrypted = await aesGcmSeal(key, options.bytes);

  // Prepend salt to encrypted data
  const withSalt = new Uint8Array(salt.length + encrypted.length);
  withSalt.set(salt);
  withSalt.set(encrypted, salt.length);

  // Upload
  const ref = await target.upload(options.name, withSalt);
  return { ref };
}
```

Note the order: salt + (IV + ciphertext). The salt is needed for decryption because the same passphrase + different salt = different key.

### Folder target: use the file system

```ts packages/adapters/src/backup.ts
export function createFolderTarget(config: { dir: string }): BackupTarget {
  return {
    async upload(name: string, encrypted: Uint8Array): Promise<string> {
      // Ensure directory exists
      try {
        mkdirSync(config.dir, { recursive: true });
      } catch {
        // Directory might already exist
      }

      const ref = `${config.dir}/${name}`;
      const buffer = Buffer.from(encrypted);
      writeFileSync(ref, buffer);
      return ref;
    },

    async download(ref: string): Promise<Uint8Array> {
      try {
        const buffer = readFileSync(ref);
        return new Uint8Array(buffer);
      } catch (error) {
        throw new Error(`File not found: ${ref}`);
      }
    },
  };
}
```

Unlike S3/Drive targets (which use fetch), the folder target uses Node's `fs` module. This is because:
1. It's meant for USB sticks or local folders, not network services
2. Acceptance tests verify that actual files are written to disk
3. No network communication needed

### Google adapters: check the switch

In google.ts, the createGoogleAdapter function returns an adapter with methods that all start by checking their switch:

```ts packages/adapters/src/google.ts
  function checkSwitch(name: string): void {
    const isOn = switches[name] === true; // must be explicitly true
    if (!isOn) {
      throw new Error(`Switch ${name} is off`);
    }
  }
```

Each method calls `checkSwitch(switchName)` at the start, before any fetch call. If the switch is off, an error is thrown immediately and no network request is made.

For example, `createMeetLink` calls `checkSwitch('meetLinks')` first, so if that switch is off, the function throws before trying to contact Google.

## Your turn: faulty first

These mistakes happened during development:

1. **Folder target stored data in a global Map instead of files:** The acceptance tests call `fs.readFileSync(p)` to verify encrypted files exist on disk. A global Map doesn't create real files, so the tests failed with "expected true, actual false" when checking `assert.ok(up.length > 0, 'something was uploaded')`. The fix: use `fs.writeFileSync` and `fs.readFileSync`.

2. **Google setPublishSettings sent wrong JSON structure:** The code sent `{ publish: true }` but the fake (and real API) expects `{ publishSettings: { publishState: { isPublished: true } } }`. The fix: match the API documentation.

3. **Binary data corrupted in test server:** The test server for S3 used `let body = ''; req.on('data', chunk => body += chunk)` which corrupted binary data by converting to string. This caused decryption to fail with "Wrong passphrase". The fix: use `Buffer.concat(chunks)` instead.

## Technical glossary

- **PBKDF2 (Password-Based Key Derivation Function 2):** Stretches a passphrase by repeatedly hashing it with a salt. SPEC D-26 uses 600,000 iterations to slow down brute-force attacks.
- **HKDF (HMAC-based Key Derivation Function):** Derives a key from existing key material using HMAC. Used after PBKDF2 to add domain separation (the 'backup' info string).
- **Salt:** Random bytes mixed with the passphrase during key derivation. Different backups get different salts, so the same passphrase produces different encryption keys.
- **AES-GCM:** Authenticated encryption with associated data. Provides both confidentiality and authenticity.
- **Feature switch:** Boolean flag that enables/disables a feature. Can be set at org, program, or class level (class overrides program overrides org overrides default).

## Common questions

**Q: Why PBKDF2 + HKDF instead of just PBKDF2?**  
A: PBKDF2 stretches a weak passphrase but doesn't add domain separation. HKDF re-derives the final key using the stretched key and a domain string ('backup'). This prevents the same passphrase from producing the same key across different systems or use cases.

**Q: What happens if the wrong passphrase is used?**  
A: The AES-GCM decryption will fail (the authentication tag won't verify) and the decrypt function throws "Wrong passphrase". The decrypt function catches this and re-throws it as a user-friendly error.

**Q: Why must the folder target use file system I/O?**  
A: Acceptance tests verify that files are actually written to disk. They call `fs.readFileSync(p)` to check that the uploaded data doesn't contain plaintext markers. Using an in-memory Map wouldn't create real files, so the tests would find nothing to read.

**Q: How does the switch system work?**  
A: Each switch has a default value (from `switchDefaults()`). The adapter receives `switches: { meetLinks: true, ... }` which overrides the defaults. The check `switches[name] === true` ensures the switch must be explicitly set to true (not just truthy).

## Reinforcement activity

Write a function that validates a backup without decrypting it:

```ts
function validateBackupHeader(data: Uint8Array): { saltSize: number; hasTag: boolean } {
  // Given the structure salt + (IV + ciphertext), 
  // check that the data is at least 16 (salt) + 12 (IV) + 16 (auth tag) = 44 bytes
  return {
    saltSize: data.length >= 44 ? 16 : null,
    hasTag: data.length > 28, // salt + IV at minimum
  };
}
```

Test it with:
- Empty data (should have saltSize: null)
- 40 bytes (too short for IV and tag)
- 100 bytes (valid)

## Check yourself

1. **Why is the salt prepended to the encrypted data instead of stored separately?**
   <details>
   Decrypt needs the same salt to re-derive the same key. By including it in the download, the restore function can extract it and decrypt without needing external metadata.
   </details>

2. **If a Google feature switch is off, where does the adapter reject the call?**
   <details>
   At the start of the method, before any fetch call. Each method calls `checkSwitch(name)` first, which throws immediately if `switches[name] !== true`.
   </details>

3. **What's the order of bytes in a backup file: salt, IV, ciphertext, or something else?**
   <details>
   Salt (16 bytes) + IV (12 bytes) + ciphertext + auth tag. The IV and auth tag come from AES-GCM, which returns them concatenated with the ciphertext.
   </details>

## Quick reference

| Task | Code |
|------|------|
| Create backup target | `const target = createS3Target({ endpoint, bucket, region, accessKeyId, secretAccessKey })` |
| Back up data | `const { ref } = await backup(target, { name, bytes, passphrase })` |
| Restore data | `const data = await restore(target, { ref, passphrase })` |
| Create Google adapter | `const adapter = createGoogleAdapter({ baseUrls: { meet, calendar, forms }, accessToken, switches: { meetLinks: true, ... } })` |
| Check if switch is on | `const isOn = switches[meetLinks] === true` |

## Connection to the bigger picture

Backup encryption is critical for a decentralized system:
- Learner data syncs to a hub or cloud server
- The LMS encrypts before sending (SPEC D-26)
- Even if the server is compromised, the data stays encrypted
- Learners own their passphrases

Google integrations (calendar, Forms) allow learners to use familiar tools without giving the LMS access to their Google accounts. Each is optional (switched off by default) so learners opt in.

## Next

Next: [MS 10.3 — Health digest and morning checklist](../ms-10.03/lesson.md).
