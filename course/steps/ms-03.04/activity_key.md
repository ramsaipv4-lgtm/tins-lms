# Activity key — Manifests, tar archives, signed class packages

**Trainer-only. Answers to the lesson activities.**

## Reinforcement activity
- `tar -tvf` lists both files; the empty one shows size 0.
- A flipped header byte makes `tarUnpack` throw `tar: bad checksum`, because the stored checksum no longer matches the sum.

## Check yourself
1. 512 bytes (header only).
2. Two zero blocks.
3. `{ ok: false, reason: 'untrusted' }`.
4. So equal file sets give equal manifests everywhere.

## Faulty first
- Mistake 1: only an independent reader (`tar -tf`) catches a checksum rule that both our writer and reader share.
- Mistake 2: locale-aware sorting differs by machine; code unit order does not.
