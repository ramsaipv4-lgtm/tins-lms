# Activity key — Shift, sprint rituals and the practice forge

Trainer-only.

## Your turn: faulty first

Expected fix: clear the typed answer only when the event kind is resolve.

```ts
if (kind === 'resolve') setAnswer('');
```

Why: a slow acknowledge response must not wipe text typed meanwhile.

## Check yourself answers

See the details blocks in the lesson; all four are one-sentence answers.
