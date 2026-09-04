# Phase E1 Standard PostgreSQL Infrastructure Gate Report

Date: 2026-09-04
Status: `READ-ONLY INFRASTRUCTURE GATE AUDIT — CHATGPT REVIEW REQUIRED`

This report is limited to the authorized Task-2 infrastructure gate. It audits
the accepted D4 baseline and current E1 branch for a future standard PostgreSQL
runtime. It does not implement a provider, change `schema.ts`, create
migrations, install PostgreSQL, modify CI, contact Miaoda/ECS, or enter Task 7.

## 1. Audited state and conclusions

- Branch: `codex/phase-e1-task2-database-preflight`
- Accepted D4 baseline/tag: `156eb45e00bb727c69bb891f056f384bb600d415` /
  `phase-d4-accepted`
- Audited HEAD before this report: `bf88a74effb177d0f63423f35d927c1760a54486`
- `main` and the accepted tag remain at the accepted D4 baseline.
- The actual deployment has never used a Miaoda application or production
  database. The historical Miaoda preflight is not the database gate for the
  actual deployment target.
- The actual target is standard PostgreSQL on a separately managed database.
  Aliyun ECS remains runtime-only; Linux CI owns install, tests, type-checking,
  builds, packaging, and release evidence.
- No database connection, generator invocation, PostgreSQL process, ECS
  command, installation, build, schema mutation, migration creation, or CI
  modification was performed for this report.

The minimum future seam is:

```text
StandardPostgresDatabaseModule
  -> drizzle-orm/node-postgres@0.44.6
  -> pg Pool
  -> DATABASE_URL
  -> standard PostgreSQL
  -> existing DRIZZLE_DATABASE Nest token
  -> existing Users/Tasks/Points/Orders services
```

The separate `PRODUCTION_DEPLOYMENT_BLOCKER` remains: replacing the database
does not provide the current `NeedLogin` and `request.context.currentUser`
contract.

## 2. Database token and type audit

### 2.1 Runtime token identity

Read-only inspection of the installed packages produced:

```json
{
  "coreType": "string",
  "coreValue": "DRIZZLE_DATABASE",
  "datapaasType": "string",
  "datapaasValue": "DRIZZLE_DATABASE",
  "same": true
}
```

Evidence: `server/modules/users/users.service.ts`,
`server/modules/tasks/tasks.service.ts`,
`server/modules/points/points.service.ts`,
`server/modules/orders/orders.service.ts`,
`server/database/local-development.module.ts`, and the installed declaration
files for `@lark-apaas/nestjs-datapaas` and
`@lark-apaas/fullstack-nestjs-core`.

The token is a string-valued Nest DI token, not a database environment
variable. The core package re-exports the same token from the DataPaas package.
An app-owned provider can provide this exact token without importing
`DataPaasModule`; a second token must not be introduced. A temporary type-only
import from the platform package may remain until the provider migration is
implemented and reviewed.

### 2.2 Current provider topology

`server/app.module.ts` loads `LocalDevelopmentDatabaseModule` only for the
explicit local-development path. For filesystem storage outside local
development, `createPlatformModuleImports(filesystem)` returns an empty array
in `server/modules/document-input/document-storage.config.ts`. That path
loads neither `PlatformModule` nor `DataPaasModule` and currently has no
production `DRIZZLE_DATABASE` provider.

The local module binds the same token to the pg-mem-backed Drizzle database.
This preserves the local test boundary and does not establish a production
provider.

### 2.3 Exact target database type

The lockfile resolves `drizzle-orm` to `0.44.6`. Its declarations define:

```ts
NodePgDatabase<TSchema> extends PgDatabase<NodePgQueryResultHKT, TSchema>
PostgresJsDatabase<TSchema> extends PgDatabase<PostgresJsQueryResultHKT, TSchema>
```

`NodePgQueryResultHKT` returns the `pg` driver's `QueryResult`, while
`PostgresJsQueryResultHKT` returns postgres.js `RowList`. The exact target
annotation is therefore:

```ts
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@server/database/schema';

type AppDatabase = NodePgDatabase<typeof schema>;
```

The four services currently annotate the injected value as
`PostgresJsDatabase` from the platform package. That is not the exact semantic
type for a `node-postgres` provider because the driver session and result HKT
are different. The minimum future type-only migration is to replace those four
annotations with `NodePgDatabase<typeof schema>` (preferably through one
app-owned alias). No unsafe cast and no type migration was made here.

### 2.4 Service consumers and behavior boundary

| Consumer            | Current database use                                                        | Compatibility requirement                                                  |
| ------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `users.service.ts`  | `app_users`; ensure, read, update                                           | preserve user identity, profile fields, points, and timestamps             |
| `tasks.service.ts`  | `tasks`, `app_users`, `point_records`; task CRUD and atomic point deduction | preserve transaction boundary, user predicates, and result mapping         |
| `points.service.ts` | `app_users`, `point_records`; recharge/consume transactions                 | preserve `FOR UPDATE` in consume and balance semantics                     |
| `orders.service.ts` | `recharge_orders`; order lifecycle; calls `PointsService` on pay            | preserve current order update and existing separate recharge call behavior |

C1-C4 and D1-D4 do not require a second database API. No runtime behavior
change is authorized by this report.

## 3. Migration and schema-management contract

### 3.1 Current repository evidence

- Canonical schema import path: `server/database/schema.ts`.
- Root dependency: `drizzle-orm: "0.44.6"`; lockfile resolution is
  `drizzle-orm@0.44.6`.
- `pg` is currently `^8.23.0` in `devDependencies`, resolving to `8.23.0`;
  it is not yet a runtime dependency.
- No `drizzle-kit`, migration directory, migration config, or migration script
  exists in `package.json` or `package-lock.json`.
- `gen:db-schema` invokes `@lark-apaas/db-schema-sync@latest`; it is historical
  Miaoda tooling and is not standard PostgreSQL schema authority.

### 3.2 Target contract and unresolved selections

| Contract item         | Decision/evidence                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical schema      | Preserve `server/database/schema.ts`; after ownership transition it becomes app-owned.                                                                                                            |
| Migration directory   | Target path: `drizzle/migrations`; it does not exist and must be created only after authorization.                                                                                                |
| Generation            | **Unresolved.** `drizzle-kit` is absent, so no package/version/command may be guessed. Select and pin an exact compatible version before implementation; never use `latest`.                      |
| Apply                 | Use `migrate` from `drizzle-orm/node-postgres@0.44.6` with `migrationsFolder: 'drizzle/migrations'`, `migrationsSchema: 'drizzle'`, and `migrationsTable: '__drizzle_migrations'`. Not run here.  |
| Journal files         | Runtime requires `drizzle/migrations/meta/_journal.json` and one SQL file per journal tag.                                                                                                        |
| Journal table         | Installed PostgreSQL dialect defaults to `drizzle.__drizzle_migrations`; explicit config freezes those names. Columns are `id serial primary key`, `hash text not null`, and `created_at bigint`. |
| Future scripts        | Candidate interfaces are `npm run db:generate` and `npm run db:migrate`; neither exists or is added in Task 2.                                                                                    |
| Runtime dependency    | `drizzle-orm@0.44.6` is present; `pg@8.23.0` is dev-only and caret-ranged. The future provider task must pin/approve its runtime dependency contract.                                             |
| Single-run protection | The installed migrator does not acquire an advisory lock. A future release wrapper must provide an advisory lock or equivalent.                                                                   |

The installed source proves that `readMigrationFiles()` reads the journal,
loads each tagged SQL file, computes a SHA-256 hash, and splits SQL on
`--> statement-breakpoint`. The PostgreSQL dialect creates the `drizzle`
schema and journal table if absent, reads the latest `created_at`, and applies
newer journal entries in one transaction before recording hash/timestamp.
This supports empty bootstrap and repeat-apply behavior, but not advisory
locking or complete historical hash-drift detection. Those properties belong
in the future release wrapper and CI tests.

The exact generator package/version is a required pre-implementation decision.
No migration workflow was invented, installed, generated, or run.

## 4. Four-table baseline conversion matrix

The matrix reconciles `server/database/schema.ts`, the inline local pg-mem SQL
in `server/database/local-development.database.ts`, and actual service use.
The standard PostgreSQL column is a proposed compatibility target that must be
approved before `0001` is written. It is not a migration.

### 4.1 `app_users`

| Current column   | Current generated/local shape                                                                                                  | Service use                           | Proposed standard PostgreSQL target                                                                                                  | Rationale                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `id`             | `uuid` PK with random UUID default                                                                                             | row identity                          | `uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()`                                                                                | preserve durable UUID identity                                          |
| `user_id`        | `varchar(64) NOT NULL`; generated mapping declares `.unique()`, `uniqueIndex("app_users_user_id_key")`, and a non-unique index | all user lookups/ownership predicates | `varchar(64) NOT NULL` plus one approved unique constraint/index; named non-unique index only if baseline review proves it is needed | duplicate uniqueness declarations require an explicit physical decision |
| `phone`          | `varchar(20)` nullable                                                                                                         | profile read/update                   | `varchar(20)` nullable                                                                                                               | exact length/nullability                                                |
| `username`       | `varchar(50)` nullable                                                                                                         | profile read/update                   | `varchar(50)` nullable                                                                                                               | exact length/nullability                                                |
| `password_hash`  | `varchar(255)` nullable                                                                                                        | not used by current service methods   | `varchar(255)` nullable                                                                                                              | preserve compatibility; no auth redesign                                |
| `avatar_url`     | `text` nullable                                                                                                                | profile read/update                   | `text` nullable                                                                                                                      | preserve text behavior                                                  |
| `points`         | `integer NOT NULL DEFAULT 0`                                                                                                   | balance reads/updates                 | `integer NOT NULL DEFAULT 0`                                                                                                         | preserve billing arithmetic                                             |
| `total_recharge` | `integer NOT NULL DEFAULT 0`                                                                                                   | recharge updates/reads                | `integer NOT NULL DEFAULT 0`                                                                                                         | preserve accumulated value                                              |
| `member_level`   | `varchar(20) NOT NULL DEFAULT 'normal'`                                                                                        | pricing/discount reads                | `varchar(20) NOT NULL DEFAULT 'normal'`                                                                                              | preserve membership values                                              |
| `_created_at`    | generated `timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`; local `timestamptz`                                             | response timestamp                    | `timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`                                                                                  | preserve millisecond storage                                            |
| `_created_by`    | generated `user_profile` plus `current_setting('app.user_id', true)`; local nullable `text`                                    | not read                              | `text NULL DEFAULT NULL`, pending physical-schema approval                                                                           | no standard auth GUC/custom composite is invented                       |
| `_updated_at`    | generated `timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`; service writes update time                                      | response timestamp                    | `timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`                                                                                  | preserve explicit service behavior                                      |
| `_updated_by`    | generated `user_profile` plus `current_setting('app.user_id', true)`; local nullable `text`                                    | not read                              | `text NULL DEFAULT NULL`, pending physical-schema approval                                                                           | same system-field rationale                                             |

### 4.2 `tasks`

| Current column  | Current generated/local shape                                                   | Service use             | Proposed standard PostgreSQL target                   | Rationale                                |
| --------------- | ------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------- | ---------------------------------------- |
| `id`            | `uuid` PK with random UUID default                                              | task identity/lookup    | `uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()` | preserve identity                        |
| `user_id`       | `varchar(64) NOT NULL`; no generated FK                                         | ownership filters       | `varchar(64) NOT NULL`, no new FK in `0001`           | preserve accepted constraint surface     |
| `task_type`     | `varchar(30) NOT NULL`                                                          | tool filtering/creation | `varchar(30) NOT NULL`                                | preserve application values              |
| `title`         | `varchar(255) NOT NULL`                                                         | task display            | `varchar(255) NOT NULL`                               | exact length                             |
| `status`        | `varchar(20) NOT NULL DEFAULT 'pending'`                                        | lifecycle reads/updates | `varchar(20) NOT NULL DEFAULT 'pending'`              | preserve lifecycle                       |
| `progress`      | `integer NOT NULL DEFAULT 0`                                                    | progress updates        | `integer NOT NULL DEFAULT 0`                          | preserve numeric semantics               |
| `points_cost`   | `integer NOT NULL DEFAULT 0`                                                    | deduction amount        | `integer NOT NULL DEFAULT 0`                          | preserve billing arithmetic              |
| `input_data`    | `jsonb NOT NULL DEFAULT '{}'`                                                   | task input payload      | `jsonb NOT NULL DEFAULT '{}'::jsonb`                  | preserve JSON payload with explicit cast |
| `result_data`   | `jsonb` nullable                                                                | result payload          | `jsonb` nullable                                      | preserve pre-completion absence          |
| `error_message` | `text` nullable                                                                 | failed-task reporting   | `text` nullable                                       | preserve error text                      |
| `_created_at`   | `timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`; local `timestamptz`        | ordering/response       | `timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`   | preserve ordering precision              |
| `_created_by`   | generated `user_profile` expression; local nullable `text`                      | not read                | `text NULL DEFAULT NULL`, pending approval            | no service dependency on platform GUC    |
| `_updated_at`   | `timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`; service writes update time | response/update time    | `timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`   | preserve write behavior                  |
| `_updated_by`   | generated `user_profile` expression; local nullable `text`                      | not read                | `text NULL DEFAULT NULL`, pending approval            | same system-field rationale              |

Preserve indexes `idx_tasks_user_id`, `idx_tasks_status`,
`idx_tasks_task_type`, and `idx_tasks_created_at`. Do not infer a new
`user_id` foreign key: the accepted generated schema has none.

### 4.3 `point_records`

| Current column  | Current generated/local shape                                            | Service use                | Proposed standard PostgreSQL target                   | Rationale                             |
| --------------- | ------------------------------------------------------------------------ | -------------------------- | ----------------------------------------------------- | ------------------------------------- |
| `id`            | `uuid` PK with random UUID default                                       | ledger identity            | `uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()` | preserve identity                     |
| `user_id`       | `varchar(64) NOT NULL`; no generated FK                                  | user-scoped ledger queries | `varchar(64) NOT NULL`, no new FK in `0001`           | preserve accepted constraints         |
| `type`          | `varchar(20) NOT NULL`                                                   | recharge/consume filtering | `varchar(20) NOT NULL`                                | preserve application values           |
| `amount`        | `integer NOT NULL`                                                       | balance delta              | `integer NOT NULL`                                    | preserve sign/arithmetic              |
| `balance_after` | `integer NOT NULL`                                                       | audit/result response      | `integer NOT NULL`                                    | preserve ledger snapshot              |
| `task_id`       | `uuid` nullable; no generated FK                                         | optional task association  | `uuid` nullable, no new FK in `0001`                  | preserve nullable association         |
| `order_id`      | `uuid` nullable; no generated FK                                         | optional order association | `uuid` nullable, no new FK in `0001`                  | preserve nullable association         |
| `description`   | `varchar(255)` nullable                                                  | ledger display             | `varchar(255)` nullable                               | exact length                          |
| `_created_at`   | `timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`; local `timestamptz` | ledger ordering            | `timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`   | preserve ordering precision           |
| `_created_by`   | generated `user_profile` expression; local nullable `text`               | not read                   | `text NULL DEFAULT NULL`, pending approval            | no service dependency on platform GUC |
| `_updated_at`   | `timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`                      | not materially updated     | `timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`   | preserve generated field              |
| `_updated_by`   | generated `user_profile` expression; local nullable `text`               | not read                   | `text NULL DEFAULT NULL`, pending approval            | same system-field rationale           |

Preserve indexes `idx_point_records_user_id` and
`idx_point_records_created_at`. `PointsService.consume()` uses `FOR UPDATE` on
the `app_users` row; real PostgreSQL integration must verify that lock
behavior rather than replace it with an application approximation.

### 4.4 `recharge_orders`

| Current column | Current generated/local shape                                               | Service use               | Proposed standard PostgreSQL target                   | Rationale                             |
| -------------- | --------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------- | ------------------------------------- |
| `id`           | `uuid` PK with random UUID default                                          | order identity            | `uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()` | preserve identity                     |
| `user_id`      | `varchar(64) NOT NULL`; no generated FK                                     | user-scoped order queries | `varchar(64) NOT NULL`, no new FK in `0001`           | preserve accepted constraints         |
| `amount`       | `integer NOT NULL`                                                          | payment amount            | `integer NOT NULL`                                    | preserve integer contract             |
| `points`       | `integer NOT NULL`                                                          | recharge amount           | `integer NOT NULL`                                    | preserve billing arithmetic           |
| `status`       | `varchar(20) NOT NULL DEFAULT 'pending'`                                    | order lifecycle           | `varchar(20) NOT NULL DEFAULT 'pending'`              | preserve lifecycle values             |
| `pay_method`   | `varchar(20)` nullable                                                      | payment method            | `varchar(20)` nullable                                | preserve optional value               |
| `pay_order_no` | `varchar(100)` nullable                                                     | payment lookup            | `varchar(100)` nullable                               | preserve external identifier          |
| `_created_at`  | `timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`; local `timestamptz`    | listing/response          | `timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`   | preserve ordering precision           |
| `_created_by`  | generated `user_profile` expression; local nullable `text`                  | not read                  | `text NULL DEFAULT NULL`, pending approval            | no service dependency on platform GUC |
| `_updated_at`  | `timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`; service writes updates | response/update time      | `timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`   | preserve explicit service behavior    |
| `_updated_by`  | generated `user_profile` expression; local nullable `text`                  | not read                  | `text NULL DEFAULT NULL`, pending approval            | same system-field rationale           |

Preserve indexes `idx_recharge_orders_user_id` and
`idx_recharge_orders_status`. The current payment path updates the order and
then invokes `PointsService.recharge()` separately; a provider migration must
not silently combine or reorder those transactions.

### 4.5 Custom types and default expressions

`schema.ts` declares platform-shaped `user_profile` and `file_attachment`
composites, including array forms. None of the four accepted tables has a
`file_attachment` column. The generated creator/updater columns use
`user_profile` and `current_setting('app.user_id', true)`, while local pg-mem
uses nullable `text`.

The proposed standard target is nullable `text DEFAULT NULL` for these unused
system values because the four services do not select or write them and the
self-hosted auth/user-context contract is unresolved. This is a required
physical-schema decision before `0001`, not permission to modify `schema.ts`.
If later auth requirements need the platform composite/GUC behavior, that
behavior must be separately specified and tested.

## 5. Frozen migration boundaries and dependency order

`0001_standard_postgres_baseline` creates exactly `app_users`, `tasks`,
`point_records`, and `recharge_orders`, with no newly inferred foreign keys.

`0002_e1_knowledge_provenance` creates exactly the seven approved E1 tables in
this dependency order:

1. `knowledge_source_records`;
2. `knowledge_metadata_assertions` and
   `knowledge_source_external_links` after the source-record parent key;
3. `knowledge_documents`, with nullable composite source-record relationship;
4. `knowledge_document_versions`, with document relationship and nullable
   same-document `supersedes_version_id` self-reference;
5. `knowledge_chunks`, after document versions; and
6. `knowledge_imports`, after document/version parents, with nullable
   relationships.

Composite ownership foreign keys are added only after the parent unique keys
exist. `active_version_id` is application-transaction validated and is not a
circular initial-schema dependency. No E2 vector/index tables or E2 operational
states are included.

## 6. Local pg-mem versus disposable PostgreSQL CI

`server/database/local-development.database.ts` remains responsible for fast
local/unit service tests and local development. Future E1 pg-mem parity tests
are local/unit evidence only; they do not prove migration, physical constraint,
row-lock, timestamp/default, or provider parity.

The future Linux CI integration job should use PostgreSQL major `16` in an
isolated service container. This is a stable ordinary PostgreSQL target for
the current UUID, JSONB, timestamptz, transaction, and row-lock requirements;
it is not an ECS installation.

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_USER: e1_ci
      POSTGRES_PASSWORD: e1_ci_ci_only
      POSTGRES_DB: e1_ci_test
    options: >-
      --health-cmd "pg_isready -U e1_ci -d e1_ci_test"
      --health-interval 10s --health-timeout 5s --health-retries 5
```

The job uses an ephemeral database and job-local connection string only;
credentials never enter the repository, release artifact, or ECS. Once the
generator and migrations are authorized, the future command contract is:

```text
npm run db:migrate
npm run test:integration:postgres -- --runInBand
```

The integration suite must verify provider binding to `DRIZZLE_DATABASE`,
empty-database application of `0001` and `0002`, journal/version and repeat
apply behavior, all eleven tables, indexes, unique constraints, nullable
`source_record_id`, composite ownership FKs, canonical assertion integrity,
`FOR UPDATE`, timestamp/default behavior, concurrent E1 idempotency, and an
approved forward-compatible rollback/verification scenario. It must cover
Users/Tasks/Points/Orders without calling DeepSeek, Miaoda, ECS, or any
production database. The service container is discarded after each job.

## 7. Design-only production database contract

This is a later deployment gate, not provisioning or configuration work:

- `DATABASE_URL` is a runtime secret supplied on ECS and excluded from source,
  build output, manifests, and release archives.
- Production TLS must verify the server certificate and configured CA
  (`verify-full` semantics or equivalent `pg` SSL configuration). Disabling
  certificate verification is not an acceptable production default.
- The provider should use a bounded pool suitable for the 2 vCPU / 2 GiB ECS
  runtime, with explicit small pool maximum, idle timeout, and connection
  timeout settings. Exact names/values belong to the future provider and
  deployment gates; none are applied here.
- The app-owned module owns the pool and calls `pool.end()` during application
  shutdown.
- A health check may issue non-mutating `SELECT 1` and verify the expected
  migration version. Application startup must not silently create or mutate
  production schema.
- A controlled release migration job must acquire a PostgreSQL advisory lock or
  equivalent single-run guard, take a backup before migration, and verify
  tables/indexes/constraints/version after migration.
- Rollback prefers switching ECS to a prior verified artifact and using
  forward database fixes after data exists. Any pre-traffic E1 rollback must
  follow the approved reverse dependency order and must not remove/rewrite the
  four accepted baseline tables.

The unresolved `PRODUCTION_DEPLOYMENT_BLOCKER` is independent of the database:
standard PostgreSQL does not replace `NeedLogin` or populate
`request.context.currentUser`. No authentication implementation or credential
workflow is proposed here.

## 8. Runtime-only artifact deployment contract

The frozen deployment topology is:

```text
GitHub Actions / Linux CI
  -> npm ci
  -> tests, lint, type-check
  -> server/client build
  -> package dist plus pruned runtime dependencies/assets
  -> manifest, checksums, protected signature
  -> ECS downloads and verifies immutable artifact
  -> ECS runs artifact with PM2/Nginx
```

The current `scripts/build.sh` builds server and client in parallel and uses a
large Node heap; it belongs in CI. `scripts/prune-smart.js` is a useful
starting point but does not prove a self-contained Linux artifact: it may miss
native/optional/dynamic dependencies, writes dependency ranges rather than a
pruned lockfile, and the current build flow copies `.env` into `dist` when
present. A future packaging step must exclude `.env`, caches, test/build
tools, and development dependencies; test the extracted artifact on Linux;
and produce a deterministic archive.

The artifact manifest must contain at least the accepted commit SHA, exact
tag, package-lock SHA-256, Node/npm versions, build identity, file list, and
per-file SHA-256 values. CI should publish the archive, manifest, and archive
checksum as immutable release assets and protect a signature through
OIDC/keyless signing or an equivalently protected release key. ECS must verify
the signature, checksum, embedded commit/tag, and extraction path before
atomically switching the active release. No packaging or GitHub Actions change
was made here.

## 9. Required gates and explicit non-actions

Before implementation, the following must be explicitly resolved or approved:

1. exact ordinary-PostgreSQL physical baseline for platform system fields and
   duplicate `app_users.user_id` uniqueness declarations;
2. exact pinned migration generator package/version/command and compatibility
   with `drizzle-orm@0.44.6`;
3. runtime `pg` dependency pin and provider lifecycle/type migration;
4. disposable PostgreSQL CI implementation and artifact/deployment gate; and
5. the independent auth/user-context decision recorded as
   `PRODUCTION_DEPLOYMENT_BLOCKER`.

The following were explicitly not performed:

- no production code, `server/database/schema.ts`, local pg-mem schema, or
  package manifest/lockfile modification;
- no PostgreSQL installation, connection, table/index/foreign-key/
  unique-constraint mutation, or migration generation/application;
- no GitHub Actions, ECS, Miaoda, or deployment artifact mutation;
- no E1 repository/service/domain implementation;
- no C2/C3/C4 implementation and no E2 work;
- no Task 7, Task 2A, or Task 2B execution.

This report does not declare `E1_DATABASE_PREFLIGHT_PASS` and does not
authorize Task 7. It is submitted for ChatGPT architecture review.
