# Phase E1 Task 2 — Read-Only Database Preflight Correction Evidence

Status: `FIXED TOOLING — REAL TARGET NOT CONFIGURED`

This report records the Task-2 correction only. It does not declare
`E1_DATABASE_PREFLIGHT_PASS`; that status belongs to ChatGPT.

## Branch and baseline

- Branch: `codex/phase-e1-task2-database-preflight`
- Previous Task-2 commit corrected here: `57e40f8033e6c6431f798652664c2377e5815938`
- Accepted D4 baseline: `156eb45e00bb727c69bb891f056f384bb600d415`
- `main` and `origin/main` remain at the accepted baseline.
- The correction commit SHA is recorded by the final Git evidence.

## Exact generator package inspection

The exact resolved package was inspected outside the repository without
executing its database operation:

- Package: `@lark-apaas/db-schema-sync`
- Resolved/executed version required by the correction: `0.1.18`
- npm tarball shasum: `5fb3d5475f5aa51987488143b241c17fc8b2268c`
- npm integrity: `sha512-ln+8PYycwQrgWxqnI90uANPVjNQqtVWm6o6b+sajmQoYIWhvbIeOdM2W2GP+clyF4i68/v/MQN8eqcxvsucWYw==`

The package does not consume a PostgreSQL connection URL. Its inspected
`dist/bin.js` and bundled source show:

- `app_id` is required;
- `FORCE_DB_BRANCH` selects the branch, defaulting to `main`;
- `SCHEMA_API_TIMEOUT_MS` controls the request timeout;
- `FORCE_AUTHN_INNERAPI_DOMAIN` supplies the default API domain;
- `X_TT_ENV` or `FORCE_FRAMEWORK_CLI_CANARY_ENV` supplies routing context;
- `X_LARKGW_SUDA_WEBUSER` may supply the web-user routing header;
- authentication uses the local `FORCE_AUTHN_TOKEN`, or
  `FORCE_AUTHN_ACCESS_KEY` plus `FORCE_AUTHN_ACCESS_SECRET`.

The schema fetch is an HTTP `GET` to:

```text
/v1/app/{app_id}/dataloom/schema?dbBranch={dbBranch}
```

The CLI writes only the requested local output file. No database DDL/DML or
schema mutation request is present in the inspected generator path. The
correction pins the child invocation to `@lark-apaas/db-schema-sync@0.1.18`.

## Canonical target and binding

Task 2 now requires one non-secret canonical target containing:

```text
appId
dbBranch
apiDomain
xTtEnv
environmentId
authContextId
targetFingerprint
```

The fingerprint includes only the non-secret identity fields. Authentication
tokens, secrets, cookies, and secret headers are never included in the target
object fingerprint or report output.

The same target object drives:

```text
Miaoda schema metadata BEFORE
→ db-schema-sync@0.1.18 child environment
→ Miaoda schema metadata AFTER
```

The child environment explicitly overrides inherited `app_id`,
`FORCE_DB_BRANCH`, `FORCE_AUTHN_INNERAPI_DOMAIN`, and the routing context. A
conflicting inherited value cannot redirect the generator. Authentication
secrets are passed only to the child/request path and are not logged.

Before and after metadata are normalized deterministically and hashed with
SHA-256. The wrapper requires matching:

```text
before.targetFingerprint == generator.targetFingerprint == after.targetFingerprint
before.normalizedSchemaSha256 == after.normalizedSchemaSha256
```

Any mismatch fails closed and does not claim zero mutation.

## TDD evidence

### RED

After replacing the old PostgreSQL-URL tests with the approved canonical-target
tests, the suite failed because the correction exports and behavior did not
exist yet: 7 tests failed and 2 prior tests passed.

### GREEN

Command:

```text
npx jest test/unit/e1-database-preflight.spec.ts --runInBand
```

Result: 1 suite passed, 9 tests passed, 0 tests failed.

Covered behavior includes exact version pinning, canonical app/branch binding,
conflicting inherited routing protection, target fingerprints, normalized
schema hash invariance, GET-only metadata access, protected output refusal,
non-zero generator failure, and secret redaction.

## Real target status

The corrected CLI was attempted locally and stopped before any metadata request
because no canonical target variables were configured:

```text
E1_PREFLIGHT_APP_ID
E1_PREFLIGHT_DB_BRANCH
E1_PREFLIGHT_API_DOMAIN
E1_PREFLIGHT_AUTH_CONTEXT_ID
```

Accordingly:

- Miaoda application/database/environment identity: `UNKNOWN`
- authenticated operator/context: `UNKNOWN`
- before/after schema metadata inventory: `NOT RUN`
- accepted-table presence: `NOT VERIFIED`
- seven E1-table absence: `NOT VERIFIED`
- temporary schema output/hash: `NOT CREATED`
- quota and remaining quota: `UNKNOWN`
- table/index/FK/unique-constraint permissions: `UNKNOWN`
- payment/upgrade requirement: `UNKNOWN`
- real generator zero-mutation evidence: `NOT ESTABLISHED — generator not invoked`

The local attempt returned exit code `1` with a fail-closed `BLOCKED` result.
No real database connection, Miaoda metadata request, generator invocation,
DDL, DML, table creation, or schema mutation occurred.

## Scope

- Task 7 remains untouched.
- No Miaoda/database table was created or changed.
- `server/database/schema.ts` and local pg-mem schema were not modified.
- No C2/C3/C4/E1 production implementation was started.
- The only Task-2 correction files are the wrapper, its test, this evidence
  report, and the approved plan's Task-2 wording amendment.
- The previously untracked E1 design and database-audit documents remain
  preserved and are excluded from this correction commit.
