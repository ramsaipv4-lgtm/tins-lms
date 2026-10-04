# MS 10.2 — Recall: Backup encryption and Google adapters

**Q:** Why do we encrypt data before uploading to S3 or Google Drive?  
**A:** So the storage service never sees plaintext. Even if the server is compromised, the data stays encrypted because only the person with the passphrase can decrypt it.

---

**Q:** What are the two key derivation steps in `deriveKeyFromPassphrase`, and why two?  
**A:** PBKDF2 (600k iterations) stretches the passphrase to a 32-byte key, then HKDF re-derives the final key using that stretched key and a domain string. Two steps add domain separation: the same passphrase in different systems produces different keys.

---

**Q:** What's included in a backup file: just ciphertext, or more?  
**A:** Salt (16 bytes) + IV (12 bytes) + ciphertext + auth tag. The salt is needed during restore to re-derive the same key.

---

**Q:** How does the folder target differ from S3/Drive targets?  
**A:** Folder uses `fs.writeFileSync` and `fs.readFileSync` for local file I/O. S3 and Drive use fetch for HTTP requests. Encryption is the same for all three.

---

**Q:** What does `checkSwitch('meetLinks')` do, and when is it called?  
**A:** It checks that `switches['meetLinks'] === true`. If not, it throws an error immediately. It's called at the start of `createMeetLink()` before any fetch call.

---

**Q:** Why does the switch check use `=== true` instead of `!== false`?  
**A:** Because a missing switch should default to off. Using `=== true` requires the switch to be explicitly true; anything else rejects. Using `!== false` would incorrectly allow missing switches.

