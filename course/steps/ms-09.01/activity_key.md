# Activity key — Performance budgets and the 200-learner load test CLI (trainer only)

## Reinforcement activity: answer
`lostWrites` equals the number of learners for the dropped kind (10 for 10 learners), `quizAnswers` stays 10 because the 201 is returned, `within1sPct` is near 100, and `pass` is false because `lostWrites` is not 0. Acknowledged is not stored.

## Marking guide
| Criterion | Full marks when | Common partial answer |
|---|---|---|
| Names lost writes | gives the exact count and says pass is false | says the run is slow |
| Explains why | says acknowledgement differs from storage | says the hub crashed |
| Percentile | notes failures count as slow | ignores failures |
