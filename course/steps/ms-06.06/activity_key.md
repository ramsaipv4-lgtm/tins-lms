# Activity key — Export, import and signed class packages (trainer only)

## Reinforcement activity: tampered import (8 min)

### Expected answers

**Status:** 400, body `{ "error": { "manifest": "mismatch" }, "missing": [], "extra": [], "changed": ["roster.csv"] }`.

Marking rubric:
- Full marks: 400 and names `changed` with the file
- Partial: 400 without the reason
- Zero: 200 or 500

**Learner calling import:** 403 `{ "error": { "role": "forbidden" } }`.

## Marking guide

| Criterion | Full marks when | Common partial answer |
|---|---|---|
| Manifest idea | says hashes catch changed, missing and extra files | says "checks the file is OK" |
| Key custody | private key only in private db | says "in the database" |
| Signer check | enrolled learners' registered keys only | says "any registered key" |
