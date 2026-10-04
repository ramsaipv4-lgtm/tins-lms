# Activity key — Attempts, grade ledger, appeals and integrity log (trainer only)

## Reinforcement activity: answer
Add `app.post('/api/classes/:id/appeals/:attemptId/decide', ctx.guard.role('trainer'), ...)`. Load `appeal:<attemptId>`, call `appealStep` with kind `reject` or `uphold`, store the returned state and history back on the same document.

## Marking guide
| Criterion | Full marks when | Common partial answer |
|---|---|---|
| Role guard | trainer only, substitute refused | uses learner guard |
| Uses core | calls appealStep, no hand-written states | sets state string directly |
| Stored | history appended on the appeal doc | overwrites history |
