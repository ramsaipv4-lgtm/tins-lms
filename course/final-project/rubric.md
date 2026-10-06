# Rubric: final project (evidence-linked resume bullets)

100 points, 70 to pass. Mark each row from the learner's hand-in, not from a demo.

| # | Criterion | Points | Full marks when | Partial |
|---|---|---|---|---|
| 1 | SPEC first | 10 | The decisions and AC rows were added to `SPEC.md` before the code (check the commit order), each row names its test file, and AC-49's table lists the new switch | Rows added after the code, or no switch row |
| 2 | Core rules | 20 | `draftBullets`, `chooseForResume` and `renderResumeMarkdown` match the rules, with the reference outputs below on the sample data | Two of three functions right |
| 3 | Tests | 15 | One test per AC row, written before the code, covering ties, the empty proof URL, the duplicate id and the parenthesis case | Happy path only |
| 4 | Server | 10 | Evidence is the caller's own only; 404 with the switch off or for a minor; 422 with the reason; nothing stored on failure | Missing the minor case |
| 5 | Journey and UI contract | 15 | The journey follows the contract, nothing is stored before confirm, the confirm button never appears in a placeholder state, and `scripts/navcheck.mjs` reports no new collision for "Resume" | Journey green but no navcheck |
| 6 | Journal and course step | 15 | A journal with at least one real failure (exact output, how found, proof) and a five-file course step for the core task that passes `check.mjs` | Journal without failure evidence |
| 7 | Gate discipline | 10 | One gate at a time, final line quoted, rows claimed only after the gate was green | A claim made before the gate |
| 8 | Honesty | 5 | The note says what was not verified | Claims without output |

## Answer key (reference outputs for the sample data)

These were computed by a small reference script written by the course editor from the rules in the brief. They are a model answer for this proposed feature; they are not results from the v1 repository.

**AC-201 and AC-202.** On the four sample items, `draftBullets` returns three bullets, in this order, and drops `e4` because its proof URL is empty. `e1` and `e3` both have `at` 2000, so the tie goes by id ascending:

| id | text | proofUrl |
|---|---|---|
| `bullet:e2` | Resolved Disk-full incident (linux, monitoring) | `https://hub.example.test/shift/7` |
| `bullet:e1` | Merged Fix DNS TTL docs (dns) | `https://git.example.test/org/repo/pull/12` |
| `bullet:e3` | Completed Azure fundamentals track | `https://hub.example.test/verify/7KQ2M9X4TB1R` |

`e3` has no skills, so its text has no parentheses.

**AC-203.** With those three bullets: choosing `bullet:e2` and `bullet:e1` gives `{ ok: false, reason: 'too-few' }`; choosing `bullet:e3`, `bullet:e1`, `bullet:e2` and `bullet:e1` again counts four distinct ids as three and gives `ok` with the bullets in draft order (`e2`, `e1`, `e3`), not the order chosen; choosing `bullet:e3`, `bullet:e1` and `bullet:zz` gives `unknown-bullet`. Six distinct ids give `too-many`.

**AC-204.** For the three bullets, the Markdown is exactly:

```text
- Resolved Disk-full incident (linux, monitoring) ([proof](https://hub.example.test/shift/7))
- Merged Fix DNS TTL docs (dns) ([proof](https://git.example.test/org/repo/pull/12))
- Completed Azure fundamentals track ([proof](https://hub.example.test/verify/7KQ2M9X4TB1R))
```

A URL such as `https://x.test/a(1)` renders as `https://x.test/a%281%29`.

**AC-205 to AC-208.** Server and journey rows have no fixed output: mark the behaviour from the learner's tests. Check three things in particular: a second learner's evidence never appears for the first; a failed `POST` stores nothing (read the record back, as the load test reads documents back instead of trusting a 2xx); and the Resume nav entry is absent when the switch is off.

**Traps worth marking down for.** Reading a clock or `Math.random` in the core; an AI call to draft the text; counting a repeated id twice; treating team badges as evidence (D-V2-2); a confirm button rendered disabled before the evidence has loaded.
