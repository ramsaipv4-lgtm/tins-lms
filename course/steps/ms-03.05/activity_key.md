# Activity key — Recovery words and crypto-shredding

**Trainer-only.**

Reinforcement: seal with the person key, call shred on the keyring, check the id is absent (`'p' in ring === false`). No key remains, so aesGcmOpen cannot be called with the right key.

Check yourself: 1) 32. 2) it throws. 3) no, a new object is returned.

Common mistake: counting list length by eye; assert it in a test.
