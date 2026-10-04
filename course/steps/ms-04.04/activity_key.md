# Activity key — Conflict merge

**Trainer-only.**

Reinforcement: if no hub revision has the field, the code keeps the winner's value (no hubFields entry for it). A later hub revision then takes over. This is a judgement call where SPEC is silent.

Check yourself: 1) order-independence, idempotence, associativity. 2) done, true. 3) the latest hub value. 4) coverage and replay by seed.

Common mistake: giving array elements the rank of the whole document, which breaks associativity.
