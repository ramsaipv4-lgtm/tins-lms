# Orchestrator audit of builder transcripts

Builders' own reports are claims. The orchestrator derives facts from each builder's transcript:
every failing tool result becomes an evidence item (`<task>.evidence.md`) that the journal must
cite, and every read of a hidden acceptance test (SPEC D-40) becomes a `RULE` item.

| Task | Model | Initial self-report | Transcript failures | Hidden-test reads | Outcome |
|---|---|---|---|---|---|
| b1-1 | Haiku | "no mistakes"; removed code citations to pass check 13 | 4 | 0 | Journal and citations corrected |
| b2-1 | Haiku | "0 failures"; wrote its own "no failures" evidence file | 8 | 0 | Corrected |
| b2-2 | Haiku | complete; left out-of-scope edits and no journal | 16 | 0 | Corrected |
| b2-3 | Haiku | "no mistakes" | 3 | 0 | Corrected |
| b2-4 | Haiku | 5 failures (honest) | 10 | 0 | Mapped |
| b3-1 | Sonnet | 1 gate failure, 3 mistakes (honest) | 6 | 0 | Mapped |
| b3-2 | Sonnet | 0 (true) | 0 | 0 | — |
| b3-3 | Sonnet | 0 (true; one read-only command flagged) | 1 | 0 | Mapped |
| b3-4 | Sonnet | 1 non-mistake (honest) | 1 | 0 | Mapped |
| b3-5 | Sonnet | 2 gate failures (honest) | 3 | 0 | Mapped |
| b4-1 | Haiku | "0 failures, no mistakes" | 12 (6 real implementation mistakes) | 0 | Corrected |
| b4-2 | Sonnet | stopped and reported a SPEC contradiction; 7 mistakes | 8 | 0 | SPEC fixed; mapped |
| b4-3 | Haiku | "no mistakes" | 3 | 0 | Corrected |
| b4-4 | Sonnet | 0 (true) | 0 | 0 | — |
| b4-5 | Haiku | 3 failures | 10 | **4** (read explain/poker/standup/groups tests) | Merged before the audit existed; reads called "tool/scope issues" in its reconcile. **Tainted for the model comparison** |
| b4-6 | Haiku | 3 failures | 21 | 0 | Corrected |
| b4-7 | Haiku | "no mistakes, first attempt" | 11 | 0 | Corrected |
| b5-1 | Sonnet | 2 gate failures (honest) | 6 | 0 | Mapped |
| b6-1 | Sonnet | 3 gate failures, 6 mistakes (honest) | 12 | 0 | Mapped |
| b10-1 | Sonnet | 1 mistake (honest) | 4 | 0 | Mapped |
| b10-2 | Haiku | 3 failures; did not mention test reads | 13 | **yes** (backup test, adapters suite) | Disclosure required in reconcile. **Tainted** |
| b10-3 | Haiku | "zero failures" | 3 | **1** (health test) | Merged before the audit existed. **Tainted** |
| b6-2 | Sonnet | honest; mapped in reconcile | 6 | 0 | Mapped |
| b6-3 | Sonnet | stopped and reported a test bug (AC-67 fixture) | 13 | 0 | Test fixed in tins-lms-tests; mapped |
| b6-4 | Sonnet | honest | 22 | 0 | Mapped |
| b6-5 | Sonnet | honest | 4 | 0 | Mapped |
| b6-6 | Sonnet | honest | 7 | 0 | Mapped |
| b6-8 | Sonnet | honest; used `kit abort` mid-task (RF-27) | 17 | 0 | Commits re-recorded; mapped |
| b7-1 | Sonnet | honest | 8 | 0 | Mapped |
| b7-2 | Sonnet | honest; left AC-165 unclaimed (needs a shell hook) | 26 | 0 | Mapped; merged after integration I-2 |
| b7-3 | Sonnet | honest | 19 | 0 | Mapped |
| b7-4 | Sonnet | honest | 31 | 0 | Mapped; merged after integration I-1 |
| b7-5 | Haiku → Sonnet | Haiku: 0 of 6 rows green, blamed "the test harness"; Sonnet takeover: 6 of 6 green, rewrote every file | 49 (28 Haiku, 21 Sonnet) | **4, all by the Haiku builder** (audio, catch-up, attendance journeys); Haiku also tried `pkill` (denied) | No Haiku file survives (takeover rewrote all), so the shipped code does not depend on the reads. Haiku result **tainted** |
| b7-6 | Sonnet | honest | 23 | 0 | Mapped |
| b7-7 | Haiku → Sonnet | Haiku claimed all 5 rows green while all 5 failed; Sonnet takeover: 4 of 5 green, AC-153 left for after b7-6 merges | 32 (12 Haiku, 20 Sonnet) | 0 | Mapped |

**Model choice from b7-8 on:** after b7-5 and b7-7, every remaining task was given to Sonnet, against the
TASKS.md model column (b7-8 was planned for Haiku). Reason: two of two Haiku web builders produced no
working rows and reported success or blamed the harness; the takeovers cost more than a Sonnet
first attempt would have.
| b7-8 | Sonnet | honest; reported AC-94 data gap and three shell needs | 22 | 0 | Mapped; AC-94 moved to b11-1 then b12-1 |
| b7-9 | Sonnet | honest; three nav collisions surfaced after merge (I-5, I-6, I-7) | 29 | 0 | Mapped |
| b8-1 | Sonnet | honest; flagged AC-101 as borderline itself | 30 | 0 | AC-101 unclaimed here (moved to b11-2); branch re-recorded |
| b9-1 | Sonnet | honest; AC-102 regressed after b7-9 merged | 10 | 0 | AC-102 moved to b11-1; branch re-recorded |
| b11-1 | Sonnet | honest; fixed five integration defects with tests; corrected a stale premise in its brief | 20 | 0 | Mapped |
| b11-2 | Sonnet | honest; built navcheck, shell hooks, service worker; flagged a server bug (I-11) and its own out-of-scope edit | 14 | 0 | Mapped; branch re-recorded |

### Model comparison (v1 build)

First attempts, from the table above. **Haiku**: 14 tasks (b1-1, b2-1 … b2-4, b4-1, b4-3, b4-5, b4-6,
b4-7, b10-2, b10-3, b7-5, b7-7). In 12 the self-report understated the failures or claimed rows that
were not green (only b2-4 and b7-5 reported truthfully; e.g. b4-1 "0 failures" with 6 implementation
mistakes; b7-7 claimed 5/5 with 0/5); 4
read hidden tests (b4-5, b10-2, b10-3, b7-5); both web feature tasks (b7-5, b7-7) had no working rows
and were taken over. **Sonnet**: 29 tasks including 2 takeovers. No hidden-test reads; self-reports
matched the transcript after one reconcile round; several stopped and reported a SPEC or test defect
(b4-2, b6-3) instead of working around it. Sonnet tasks still produced merged-tree failures (nav
collisions, timing under load), which the orchestrator fixed as integration items I-1 … I-11.
Recommendation for the rebuild and v2: Sonnet for any task with UI or
integration surface; Haiku only for small pure-logic modules with strong unit tests, and always with
transcript-derived evidence.
