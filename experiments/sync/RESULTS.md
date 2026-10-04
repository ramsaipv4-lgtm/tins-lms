# Sync experiment: PouchDB replication through a Node hub (iteration 16)

**Question:** can the borrowed sync layer (DEC-53/54) replicate phone ↔ hub ↔ cloud on Node 22
with a single Node install, and does it handle offline conflicts predictably?

**Setup:** `pouchdb@9.0.0`, `express-pouchdb@4.2.0` (serves the CouchDB replication protocol from
Node), `pouchdb-adapter-memory@9.0.0` for two simulated phones. Node 22.22.0. Script:
`replicate.cjs` (run after `npm i pouchdb@9.0.0 express-pouchdb@4.2.0 express@4 pouchdb-adapter-memory@9.0.0`).

**Results (VERIFIED, run in this container):**

| Check | Result |
|---|---|
| Phone A → hub → phone B, both directions | Both phones end with both documents |
| Same card edited on two offline phones, then synced | Both phones pick the **same winning revision**; the losing edit is kept as a visible `_conflicts` entry (nothing silently lost) |
| Hub → second node ("cloud") replication | All documents arrive |
| Native module (`leveldown`) install on Node 22 | Prebuilt binary installed without a compiler |

**Consequences for SPEC.md:**

- The winning revision is deterministic but arbitrary; the app must resolve conflicts with its own
  per-field rules (F-22) by reading `_conflicts` and writing a merged revision. That merge is a pure
  core function with its own tests (SPEC §4.13).
- `express-pouchdb` requires Express 4, alongside Hono. The hub serves `/db/*` with
  express-pouchdb and everything else with Hono on the same Node HTTP server (SPEC D-9).
- `express-pouchdb` is old and slow-moving (last metadata change Aug 2025). It sits behind the
  sync adapter interface so it can be swapped for CouchDB or another server.
