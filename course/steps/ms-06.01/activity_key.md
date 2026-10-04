# Activity key — Server foundation (trainer only)

## Reinforcement activity: guard statuses (8 min)

### Expected answers

**Learner calling `POST /api/admin/tnc`:** 403 with `{ "error": { "role": "forbidden" } }`.

Marking rubric:
- Full marks: 403 and the reason (role not allowed)
- Partial: 403 without a reason
- Zero: 401 or 200

**Admin calling the same route with `{ "version": "2", "text": "new" }`:** 200. A missing `text` gives 400 with `{ "error": { "text": "..." } }`.

Marking rubric:
- Full marks: 200 and the 400 field map
- Partial: only one of the two
- Zero: neither
