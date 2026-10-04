# Recall — Section keys and teleprompter-paced release

## Cards
**Q:** How is a section key derived?
**A:** HKDF-SHA-256 from the day key, empty salt, info `section:<index>`, 32 bytes.

**Q:** Why do two seals of the same text differ?
**A:** A fresh random 96-bit IV is used each time.

**Q:** When is a graded section released?
**A:** Only when reached or release-all; never by time alone.

**Q:** What is `at` in a release plan?
**A:** Class start plus earlier planned seconds (in ms), or null if graded.
