# MS 10.2 — Trainer prep: Encrypted backups and Google adapters

## Learning objectives checklist

Learners should be able to:
1. **Explain why encryption happens before upload, not after**  
   Check: Can they describe what happens if S3 credentials are leaked?

2. **Describe the PBKDF2 + HKDF flow and why two steps**  
   Check: Do they understand domain separation and why a single KDF isn't enough?

3. **Implement a feature switch check that defaults to off**  
   Check: Can they write `if (switches[name] !== true) throw ...` correctly?

4. **Troubleshoot binary data corruption in Node.js**  
   Check: Can they spot the `body += chunk` bug and fix it with `Buffer.concat()`?

## Prerequisites knowledge

Learners should already know:
- **HTTP:** fetch, multipart forms, streaming responses
- **Binary data:** Uint8Array, Buffer, byte concatenation
- **Promises:** async/await, error handling
- **Node.js:** fs module basics (if reviewing folder target)

If they're weak on any of these, do a 5-min review.

## Time estimate

- Opening + three key ideas + common mistakes: **40 min**
- Code walkthrough + discussion: **15 min**
- Buffer for questions: **5 min**
- Total: **60 min** (can trim to 50 by shortening mistakes section)

## Materials

1. **Lesson.md** — comprehensive walkthrough with code blocks
2. **Instructor script** — talking points for each section
3. **Recall cards** — 10 flashcards for review
4. **Activity key** — three hands-on tasks (validator, switch fix, multipart debug)

## Common questions (and answers)

**Q: Why not just use PBKDF2 alone?**  
A: PBKDF2 stretches the passphrase, but HKDF adds domain separation. Without HKDF, the same passphrase would produce the same key in different systems or use cases. With HKDF + a domain string, each system gets a unique key.

**Q: How is this better than the cloud storing the passphrase and encrypting?**  
A: Because learners never share their passphrases with the cloud. Encryption happens locally. Even if the server is compromised, backups stay encrypted.

**Q: Can learners restore a backup with multiple passphrases?**  
A: No. The passphrase must be correct. If they guess wrong, AES-GCM decryption fails (auth tag verification fails) and the function throws "Wrong passphrase".

**Q: Why are Google features switched off by default?**  
A: They're optional integrations (phase 2 in the SPEC). Learners must explicitly opt in. This respects privacy and choice.

**Q: What if a learner enables the switch but Google isn't set up?**  
A: The adapter will make the HTTP request and fail (network error or 401 Unauthorized). The code doesn't validate that Google is configured; it just makes the request.

## Possible misconceptions

1. **"The server must encrypt the backup"**  
   Correct this: No, encryption happens on the client before uploading. The server never has plaintext.

2. **"Missing switch = on"**  
   Correct this: No, missing switch = off. The code checks `switches[name] === true`, which rejects if the switch is undefined.

3. **"The salt is a secret"**  
   Clarify: No, the salt is random but not secret. It's included in the backup file. Different backups = different salts = different keys even with the same passphrase.

4. **"String concatenation of binary data is fine in Node.js"**  
   Show the multipart example: `body += chunk` mangles bytes > 127. Always use Buffer for binary.

## Things to demonstrate live

1. **Show what happens with wrong passphrase:**
   ```ts
   // Same backup, different passphrase
   const encrypted = await backup(target, { name: 'test', bytes: data, passphrase: 'secret1' });
   const result = await restore(target, { ref: encrypted.ref, passphrase: 'secret2' }); // Throws
   ```

2. **Show what happens with switch off:**
   ```ts
   const adapter = createGoogleAdapter({ ..., switches: { meetLinks: false } });
   await adapter.createMeetLink({ title: 'Test' }); // Throws "Switch meetLinks is off"
   ```

3. **Show the multipart parse:**
   Draw it on the board:
   ```
   --boundary\r\n
   headers\r\n\r\n
   {metadata}\r\n
   --boundary\r\n
   headers\r\n\r\n
   [BINARY DATA HERE]\r\n
   --boundary--
   ```
   Point out where `Buffer.concat()` preserves the binary part.

## Hands-on activity sequence

1. **Validator (15 min):** Learners write a function to check backup structure.  
   Goal: Understand the byte layout.

2. **Switch fix (20 min):** Learners debug and fix a broken switch check.  
   Goal: Understand when and how to throw errors.

3. **Multipart debug (15 min):** Learners fix binary data corruption.  
   Goal: Learn why `Buffer` exists and when to use it.

## Wrap-up

"You've seen three patterns:
- **Encryption before upload:** critical for privacy
- **Feature switches:** allow safe opt-in to integrations
- **Binary handling in Node:** use Buffer, never strings

Next task you'll implement another adapter following the same patterns."

## Assessment

At the end, learners should be able to:
- [ ] Describe the backup flow (passphrase → PBKDF2 → HKDF → AES-GCM → upload)
- [ ] Write a switch check that defaults to off
- [ ] Debug binary data corruption in a Node.js server
- [ ] Explain why the folder target uses fs instead of fetch
- [ ] Identify what goes wrong if salt is lost during restore

## Resources for trainer

- **SPEC §7:** AC-113, AC-114 (the requirements)
- **build-journal/b10-2.md:** The real mistakes and debugging process
- **acceptance/adapters/backup.test.mjs:** The acceptance tests (if you want to show learners what they're tested against)
- **node docs:** Web Crypto, fs module

## Post-class follow-up

1. Ask learners to write a test for the validator function
2. Ask them to add a fourth target (e.g., DropBox) by extending the pattern
3. Have them explain to a peer why the folder target doesn't use fetch
