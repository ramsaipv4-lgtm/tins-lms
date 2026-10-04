# Recall — Pairing, devices, attendance

## Exercise 1 — Predict the statuses (5 min)
**What to do:** A code is claimed, claimed again, and a new code is claimed after 6 minutes. Give the three statuses.
**The answer (check after):** 200, 409 (used), 410 (expired).

## Cards
**Q:** How long does a pairing code live?
**A:** 5 minutes.

**Q:** What makes a device's next request 401 after revoke?
**A:** Its sessions are removed with revokeWhere on the device id.

**Q:** Which codes count as verified attendance?
**A:** Only the rotating code, current or previous period.
