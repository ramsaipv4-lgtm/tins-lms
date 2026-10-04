# MS 10.2 — Instructor script: Encrypted backups and Google adapters

## Opening (5 min)

"Today we're building the backup system and Google integrations. Backups need encryption—the server should never see plaintext. Google features (Meet links, calendar sync, Forms export) are optional and switched off by default.

By the end, you'll understand:
- How to encrypt data before uploading to S3, Google Drive, or a USB stick
- Why we use PBKDF2 and HKDF (not just one)
- How feature switches enable optional features safely"

## Key idea 1: Encryption before upload (10 min)

"Imagine you're backing up 100MB of student data. You can:
1. Send it plaintext to S3 (bad: if AWS is compromised, student data leaks)
2. Send it encrypted so only you can decrypt it (good: even if S3 is compromised, the data is safe)

Here's the flow: passphrase → PBKDF2 (600k iterations, random salt) → stretched key → HKDF → final encryption key → AES-GCM encrypt → upload.

Why two key derivation steps?
- PBKDF2 alone stretches a weak passphrase but doesn't add separation
- HKDF re-derives the final key with a domain string ('backup'), so the same passphrase in a different system produces a different key

Let's trace through the code: [show `deriveKeyFromPassphrase` in lesson]

The salt is random for each backup. Same passphrase + different salt = different key. That's why we prepend the salt to the encrypted data: the restore function needs it to re-derive the same key."

## Key idea 2: Three backup targets (10 min)

"We have three targets:
1. **S3/R2:** Path-style HTTP API, for cloud
2. **Google Drive:** Multipart form upload with API, for cloud
3. **Folder/USB:** File system, for local or USB storage

All three have the same interface: `upload(name, encryptedBytes) -> ref` and `download(ref) -> encryptedBytes`.

The encryption happens the same way for all three. What differs is the transport:
- S3 and Drive use fetch (HTTP)
- Folder uses fs module (file I/O)

Why? Acceptance tests verify that the folder target creates real files on disk. They call `fs.readFileSync(p)` and check that the file doesn't contain plaintext markers."

## Key idea 3: Feature switches for Google (8 min)

"Google integrations are optional. Three methods:
1. `createMeetLink({ title })` → opens a Google Meet (switch: `meetLinks`)
2. `syncCalendar({ calendarId, events })` → creates calendar events (switch: `calendarSync`)
3. `exportQuiz({ title, questions })` → generates a Google Form (switch: `googleForms`)

All three are **off by default**. Before any fetch call, we check:

```ts
const isOn = switches[name] === true;
if (!isOn) throw new Error(`Switch ${name} is off`);
```

Notice: `=== true`, not `!== false`. A switch must be **explicitly true**. If it's missing, undefined, or false, the method rejects immediately without touching the network.

This pattern is safer than checking centrally because each method controls its own behavior."

## Common mistakes (7 min)

"Three things went wrong during development:

**Mistake 1:** Folder target stored data in memory instead of files.
- Acceptance tests call `fs.readFileSync()` to check that encrypted files exist
- In-memory Map passed local tests but failed acceptance tests
- Fix: use `fs.writeFileSync()` and `fs.readFileSync()`

**Mistake 2:** Google setPublishSettings sent wrong JSON.
- The API expects `{ publishSettings: { publishState: { isPublished: true } } }`
- The code sent `{ publish: true }`
- Fix: match the API documentation exactly

**Mistake 3:** Binary data corrupted in test server.
- Test server used `let body = ''; req.on('data', chunk => body += chunk)` which mangles binary
- When restored, decryption failed with 'Wrong passphrase'
- Fix: use `Buffer.concat(chunks)` to preserve bytes

These mistakes teach us:
- File system tests need real files
- APIs are strict about JSON structure
- Binary data needs careful handling in Node.js servers"

## Walkthrough (15 min)

Review the lesson's three code walkthroughs:
1. `deriveKeyFromPassphrase`: PBKDF2 + HKDF
2. `backup`: encrypt before upload
3. `checkSwitch` in Google adapter: verify switch is on

Ask learners to predict what happens if:
- A user types the wrong passphrase at restore
- A learner hasn't enabled the `calendarSync` switch and tries to use `syncCalendar`
- A backup file is edited after encryption (auth tag fails)

## Closing (5 min)

"Encryption before upload is a core pattern in distributed systems: devices encrypt locally before sending to a server. Combined with feature switches that default to off, learners control what data goes where.

Your assignment is to implement one more adapter (we'll cover it next). You'll see how the pattern repeats: same interface, different transport."

## Time check

Total: 50 minutes (5 + 10 + 10 + 8 + 7 + 15 + 5 = 60, trim as needed)
