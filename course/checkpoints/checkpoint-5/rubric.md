# Rubric: Checkpoint 5

| # | Criterion | Points | Full marks when | Partial |
|---|---|---|---|---|
| 1 | Shell measurement | 5 | Follows static imports from `index.html` transitively, skips `import()`, reports both totals and names the right one | Right method, no comparison |
| 2 | Compression | 3 | Shows two sizes and says the budget is about bytes on the wire | Sizes without the reason |
| 3 | Load test line | 4 | Real JSON line pasted; names `within1sPct`, `p95Ms`, `quizWindowMs`, `lostWrites` and the thresholds | Line pasted, thresholds missing |
| 4 | Busy-machine failure | 4 | One cause in the test (all requests opened at once so client queueing counts as latency), one in the machine (load average); in-flight pool | One cause |
| 5 | Claiming rows | 4 | After the gate, not a single local run, shows it green | Says "after it passes twice" |

14 of 20 is a pass.

## Answer key

**1. Shell measurement** (SPEC AC-102; integration I-4). The shell is what `index.html` loads first (scripts and modulepreloads) plus everything those chunks import statically. In the journal's measurement on the board branch the shell was 2 chunks, 58,615 bytes gzip, while all 209 chunks added up to 2,609,607 bytes; the unit test had summed all of them and reported `shell JS 2616573 bytes gzip`. The budget means the first number. The second grows as soon as code is split into lazy chunks and says nothing about first load. Your own numbers will differ.

**2. Compression** (journal b9-1 decision 2; I-8). Before compression the static handler sent raw bytes: b9-1 saw `app shell JavaScript is 377.1 KB on the wire in 6 files (budget < 300 KB)`. I-8 added brotli or gzip for text files to the static handler. The test counts bytes on the wire, so compression, not source size, decides the row.

**3. Load test line** (SPEC AC-103; Appendix B). The summary has `learners`, `requests`, `within1sPct`, `p95Ms`, `quizAnswers`, `quizWindowMs`, `lostWrites` and `pass`. The SPEC passes a run when 95% of requests finish within 1 s, 200 quiz answers land within 10 s, and no write is lost. In the builder's manual run of 200 learners the line was `{"learners":200,"requests":804,"within1sPct":100,"p95Ms":540,"quizAnswers":200,"quizWindowMs":451,"lostWrites":0,"pass":true}` (journal b9-1). Lost writes are measured by reading the stored documents back, not by trusting a 2xx answer.

**4. Busy-machine failure** (journal b9-1, M3). The first full gate failed under a machine load average of 17 to 26: `not ok 183 - AC-103 200 simulated learners ... no lost writes`. The CLI opened all 200 requests at once, so queueing on the client counted as latency; the fix was a 40-request in-flight pool. The machine cause is parallel gates on a 16 GB, 4 CPU machine; run one gate at a time.

**5. Claiming rows** (journals b8-1 and b9-1, orchestrator notes). Only after the gate has shown it green. Two branches claimed a row (AC-101 in b8-1, AC-102 in b9-1) before the gate verified it; the gate forbids removing a committed claim, so each branch had to be rebuilt from main (Appendix A).
