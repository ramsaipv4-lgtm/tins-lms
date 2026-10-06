# Activity key — Server hardening and integration (trainer only)

## Reinforcement activity: answer

**Task:** Add a staff-only read tool `list_appeals` to the MCP server.

**Full solution:** add an entry to `TOOLS` with `readOnly: true`, schema `z.object({ classId: z.string().min(1) })`; in `runRead`, call `allowedClass` (which already refuses a class the person cannot see), then return the `appeal:` documents. For a learner, return an error with code `-32602` (use `isStaff(session.roles)` first).

**Key points:**
- Read tools have `annotations.readOnlyHint: true` and change nothing.
- Role checks happen inside the tool, because the session cookie is the only identity.

## Marking guide

| Criterion | Full marks when | Common partial answer |
|---|---|---|
| Read-only | The tool stores nothing | Stores a log row |
| Role check | A learner gets a JSON-RPC error | Returns an empty list |
| Test | A learner call and a staff call are both asserted | Only the staff call |
