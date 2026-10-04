# Instructor script — Export, import and signed class packages

**Total runtime: 45 minutes**

---

## Hook (0:00 — 0:05)

[SAY] "A USB stick can carry a lesson. It can also carry a changed lesson. How do we tell?"

[DO]
- Show the Detective question

---

## Faulty first (0:05 — 0:20)

[SAY] "Here are two real mistakes from this build. Predict first."

[DO]
- Show Mistake 1 (the unneeded pattern copy) and ask what `git status` showed
- Show Mistake 2 (the write refused until the file was read)

⚠️ LIKELY CROSS-Q: "Why not just trust files from our own server?" — Answer: the file travels outside the server; the signature is what travels with it.

---

## Fix and explain (0:20 — 0:40)

[SAY] "Open export.ts. First the hub key, then the scrubbing function, then the signer check."

[DO]
- Walk the three excerpts in the lesson
- Run the reinforcement activity live and show the 400

⚠️ LIKELY CROSS-Q: "Can a learner forge a file with their own key?" — Answer: only if the hub already has that key registered for an enrolled learner of that class.

---

## Check yourself (0:40 — 0:45)

[SAY] "Answer the four questions on paper, then we compare."
