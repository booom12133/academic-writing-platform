# Phase E1 Task 2 — Read-Only Database Preflight Evidence

Status: `BLOCKED — TARGET ENVIRONMENT NOT ESTABLISHED`

This report records Task 1 and Task 2 only. It does not declare
`E1_DATABASE_PREFLIGHT_PASS`; that status belongs to ChatGPT.

## Baseline and branch

- Accepted D4 baseline: `156eb45e00bb727c69bb891f056f384bb600d415`
- Accepted tag: `phase-d4-accepted` resolves to the same SHA.
- Branch: `codex/phase-e1-task2-database-preflight`
- Branch HEAD at Task 2 start: `156eb45e00bb727c69bb891f056f384bb600d415`
- `main` and `origin/main` remained at the accepted baseline.
- The Task-2 commit SHA is recorded by the final Git evidence for this report.

## TDD evidence

### RED

Command:

```text
npx jest test/unit/e1-database-preflight.spec.ts --runInBand
```

Result: expected failure because `scripts/e1-database-preflight.js` did not
exist yet. Jest reported `Cannot find module '../../scripts/e1-database-preflight'`.

### GREEN

The same command passed after the minimal wrapper was added:

- 1 suite passed;
- 6 tests passed;
- 0 tests failed.

The existing ts-jest `TS151001` advisory warning was emitted; no production
behavior was changed to address it.

## Task-2 files

Only these Task-2 files were added:

- `scripts/e1-database-preflight.js`
- `test/unit/e1-database-preflight.spec.ts`
- `docs/reviews/PHASE_E1_TASK2_DATABASE_PREFLIGHT_REPORT.md`

The previously untracked E1 plan/design/audit documents were preserved and
excluded from the Task-2 commit. No production source, generated schema, local
pg-mem schema, or database file was modified.

## Real preflight result

The wrapper was invoked with:

```text
node scripts/e1-database-preflight.js
```

The run stopped before database access because the environment contained no
`E1_PREFLIGHT_DATABASE_URL` and no explicit target database context. The
wrapper also requires an explicit `E1_PREFLIGHT_GENERATOR_READ_ONLY_CONFIRMED=true`
attestation before invoking `db-schema-sync`.

| Required evidence | Result |
|---|---|
| Miaoda application/database/environment identity | `UNKNOWN — not supplied` |
| Authenticated operator/context | `UNKNOWN — not supplied` |
| Current table inventory | `NOT RUN` |
| Accepted tables present (`app_users`, `tasks`, `point_records`, `recharge_orders`) | `NOT VERIFIED` |
| Seven E1 tables absent | `NOT VERIFIED` |
| Temporary schema-sync output path | `NOT CREATED — safety gate stopped first` |
| Temporary output vs `server/database/schema.ts` comparison | `NOT RUN` |
| Inventory before generator | `NOT RUN` |
| Inventory after generator | `NOT RUN` |
| Generator zero-mutation evidence | `NOT ESTABLISHED — generator was not invoked` |
| Current Miaoda table/object quota | `UNKNOWN` |
| Remaining quota for seven tables | `UNKNOWN` |
| Permission for tables/indexes/foreign keys/unique constraints | `UNKNOWN` |
| Paid upgrade or payment requirement | `UNKNOWN` |

The command returned exit code `1` with:

```json
{
  "status": "BLOCKED",
  "reason": "E1_PREFLIGHT_DATABASE_URL is required; refusing to run against an unspecified environment",
  "databaseMutation": "not-established"
}
```

No database connection, schema generator invocation, DDL, DML, Miaoda table
creation, or schema mutation occurred during the real-preflight attempt.
Because the intended environment and generator behavior were not established,
this report intentionally does not claim zero mutation for an unrun target or
claim `E1_DATABASE_PREFLIGHT_PASS`.

## Scope audit

- Current branch starts exactly at the accepted D4 SHA.
- `main` remains unchanged.
- The wrapper uses a temporary output path and refuses the protected
  `server/database/schema.ts` path.
- The generator argument vector is exactly:
  `npx -y @lark-apaas/db-schema-sync@latest --output <temporary>/schema.ts --export-custom-types`.
- Inventory queries use `information_schema` with `SELECT` only.
- Inventory changes cause failure.
- Task 7 was not performed.
- No E1 tables were created, no accepted tables were changed, and no real
  preflight success status was self-declared.
