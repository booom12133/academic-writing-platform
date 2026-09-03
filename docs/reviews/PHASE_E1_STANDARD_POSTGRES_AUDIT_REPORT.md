# Phase E1 Standard PostgreSQL Infrastructure Audit Report

Date: 2026-09-03
Status: `READ-ONLY AUDIT COMPLETE — ARCHITECTURE REVIEW REQUIRED`

This report audits the accepted D4 baseline and the current E1 Task-2 branch
against the clarified deployment principle. It does not implement the
PostgreSQL migration, create a database, change a table, modify the generated
schema, contact the ECS, or authorize E1 Task 7.

## 1. Audit boundary and repository identity

- Accepted D4 baseline: `156eb45e00bb727c69bb891f056f384bb600d415`
- Accepted tag: `phase-d4-accepted` (peeled commit matches the baseline)
- Audited branch: `codex/phase-e1-task2-database-preflight`
- Audited branch HEAD: `631a12f5b642acb373c5386f7fd801710b722749`
- `main` and the accepted tag remain at the accepted D4 baseline.
- No ECS command, install, build, test, database connection, or database
  mutation was performed during this audit.
- The user-provided ECS facts are recorded as deployment constraints, not
  revalidated by this report. The historical
  `/opt/academic-writing-platform-c4` environment remains out of scope and
  untouched.

## 2. Executive conclusion

The repository is not currently a standard PostgreSQL production runtime.
There are two distinct database topologies that must not be conflated. The
platform-storage path can load `PlatformModule`, which imports
`@lark-apaas/nestjs-datapaas` and configures it from `SUDA_DATABASE_URL`.
However, the accepted D4 self-hosted filesystem production path
(`DOCUMENT_STORAGE_DRIVER=filesystem` and not local development) executes
`createPlatformModuleImports(filesystem)`, which returns `[]`. In that path
`LocalDevelopmentDatabaseModule`, `PlatformModule`, and `DataPaasModule` are
all absent, so no production `DRIZZLE_DATABASE` provider exists. Local
development supplies the token separately through a pg-mem adapter.

The minimum safe database seam is therefore an application-owned production
database module that exports the existing `DRIZZLE_DATABASE` token and the
same typed Drizzle database shape, configured from a standard PostgreSQL
`DATABASE_URL`. The existing Users, Tasks, Points, Orders, and C1-D4 business
services can remain behaviorally unchanged at their database boundary, but
production readiness is conditional on separately resolving the current
platform-owned authentication/user-context boundary.

Recommended long-term ownership is:

```text
versioned Drizzle schema + migrations
        ↓
controlled CI/release migration job
        ↓
standard PostgreSQL database
        ↓
application-owned DRIZZLE_DATABASE provider
        ↓
unchanged business services
```

The Aliyun ECS remains a runtime host. Build, dependency installation,
testing, type-checking, artifact creation, and normal migration generation do
not belong on the ECS.

## 3. Dependency audit

### 3.1 `PlatformModule` and the selected filesystem production topology

The direct repository references are:

- `server/app.module.ts`: selects `LocalDevelopmentDatabaseModule` only for
  the explicit local-development mode; otherwise it calls
  `createPlatformModuleImports(documentStorageConfig)`.
- `server/modules/document-input/document-storage.config.ts`: imports
  `PlatformModule.forRoot()` only when `DOCUMENT_STORAGE_DRIVER=platform`.
  Filesystem storage returns no platform module imports.
- `server/main.ts`: imports `configureApp` from the platform package.
- Controllers use `NeedLogin` from the platform package.
- The document storage platform adapter loads `FileService` from the same
  package.

For the actual accepted self-hosted filesystem production path, the topology
is explicitly:

```text
filesystem storage, non-local-development
  → createPlatformModuleImports(filesystem) = []
  → no LocalDevelopmentDatabaseModule
  → no PlatformModule
  → no DataPaasModule
  → no production DRIZZLE_DATABASE provider
```

The installed core package is `@lark-apaas/fullstack-nestjs-core@1.1.60`.
Its inspected implementation shows that `PlatformModule.forRoot()` imports
`DataPaasModule` unless `FORCE_FRAMEWORK_DISABLE_DATAPASS=true`, and its
database factory reads `SUDA_DATABASE_URL`. It also configures platform
authentication, cache, logging, HTTP, and user-context middleware. Disabling
only DataPaas would remove the platform database provider, but would not by
itself create a standard PostgreSQL provider and would leave the other
platform concerns in place.

### 3.2 `DRIZZLE_DATABASE`

The application-level consumers are exactly four services:

| Consumer                                  | Tables used                                | Operations                                |
| ----------------------------------------- | ------------------------------------------ | ----------------------------------------- |
| `server/modules/users/users.service.ts`   | `app_users`                                | ensure, read, update                      |
| `server/modules/tasks/tasks.service.ts`   | `tasks`, `app_users`, `point_records`      | task CRUD, balance deduction, transaction |
| `server/modules/points/points.service.ts` | `app_users`, `point_records`               | balance, recharge, consume, transactions  |
| `server/modules/orders/orders.service.ts` | `recharge_orders`, through `PointsService` | order CRUD, payment/cancel, recharge      |

All four inject `DRIZZLE_DATABASE` and use the generated schema exports. No
other production service directly injects this token. AI tool submission and
execution services depend on `TasksService`/`PointsService`, not on a second
database API.

`server/database/local-development.module.ts` currently binds
`DRIZZLE_DATABASE` to the pg-mem-backed Drizzle instance. The platform package
re-exports the token from `@lark-apaas/nestjs-datapaas`; its `DataPaasModule`
also provides the same token for its PostgreSQL-backed Drizzle instance.

There is no application read of a `DRIZZLE_DATABASE` environment variable.
The token is a Nest dependency-injection contract, not a connection setting.

### 3.3 `@lark-apaas/fullstack-nestjs-core`

The direct production dependency remains needed today for platform decorators,
`configureApp`, and optional platform file storage. Its database behavior is
not a standard application-owned database lifecycle: the platform module uses
`SUDA_DATABASE_URL`, a platform token-file path, and platform request-context
integration.

The repository lockfile resolves `@lark-apaas/nestjs-datapaas@1.0.21` as a
transitive dependency. Its public module contract is not the target production
abstraction for standard PostgreSQL. The target must not depend on
`@lark-apaas/nestjs-datapaas` or `DataPaasModule` as its database boundary.

### 3.4 Generated `server/database/schema.ts`

The current generated mapping contains the four accepted tables:

- `app_users`
- `tasks`
- `point_records`
- `recharge_orders`

The four business services import this path directly. The file is marked
auto-generated and is currently owned by the Miaoda/DataPaas schema-sync
workflow. No E1 tables are present on this branch's generated mapping.

The mapping also contains platform-shaped custom types and system-field
defaults, including `user_profile`, `file_attachment`, and
`current_setting('app.user_id', true)` expressions. The existing local pg-mem
SQL simplifies some of those system columns to `text`; therefore the current
pg-mem mirror is not proof that a fresh ordinary PostgreSQL database exactly
matches every generated platform type.

## 4. Minimum standard PostgreSQL provider/module

### Frozen target seam

Introduce, in a separately authorized implementation phase, an
application-owned `StandardPostgresDatabaseModule` that:

1. loads a secret `DATABASE_URL` and non-secret pool/SSL settings;
2. configures the existing Drizzle schema mapping;
3. uses `drizzle-orm/node-postgres` with a direct `pg` Pool;
4. exports exactly `DRIZZLE_DATABASE` to existing business modules; and
5. owns connection shutdown and health checks.

The frozen target is:

```text
application-owned StandardPostgresDatabaseModule
  → drizzle-orm/node-postgres
  → direct pg Pool
  → DATABASE_URL
  → standard PostgreSQL
```

It exports the existing `DRIZZLE_DATABASE` Nest token and preserves the typed
database contract consumed by the four services. `pg` currently exists only in
`devDependencies`; moving it to runtime dependencies is expected during a
separately authorized implementation, but package.json is not changed by this
audit.

This is a provider recommendation only. No module, dependency, or runtime
configuration was changed by this audit.

### Required authentication boundary decision

Database replacement alone does not replace `NeedLogin` or populate
`req.userContext`. The current platform user-context/authentication path must
either remain as an explicitly retained non-database dependency or be replaced
by a separately approved standard self-hosted authentication boundary.
That decision is required before claiming that production Users/Tasks/Points/
Orders behavior is fully deployable. Record this unresolved boundary exactly as
`PRODUCTION_DEPLOYMENT_BLOCKER`. It does not block isolated database-provider,
migration, E1 development, or CI integration work, but production readiness
cannot be declared until a separate authentication architecture is approved.
No new auth protocol or credential workflow is invented here.

## 5. Behavioral compatibility assessment

### Can remain behaviorally unchanged

- Users, Tasks, Points, and Orders can keep their service methods, table names,
  userId predicates, transaction boundaries, result mapping, and public API
  behavior if the provider supplies the same Drizzle contract and the four
  physical tables preserve the accepted shape.
- C1 parsing is pure and has no database dependency.
- C2 context building and C3 chunking are pure and have no database
  dependency.
- D1 execution foundation and D2/D3 tool flows reach persistence through
  existing Tasks/Points services and do not introduce another database
  provider.
- D4's text-generation provider abstraction is independent of database
  driver/provider selection.
- C4 filesystem storage already has a platform-free mode and the accepted
  durable path `/var/lib/academic-writing-platform/documents` remains
  compatible with the runtime-only deployment principle.

### Compatibility conditions

- The four accepted tables must be created with the existing names, column
  mappings, nullability, defaults, indexes, and timestamp behavior before
  application cutover.
- The generated mapping's platform custom types/system fields must be
  resolved explicitly for ordinary PostgreSQL; copying only the visible table
  declarations is insufficient.
- The same authenticated userId must reach controllers/services, and any
  request-context SQL behavior retained by the chosen provider must be tested.
- Payment and external DeepSeek behavior remain outside this database-provider
  audit; existing `PointsService`, `OrdersService`, and D4 provider contracts
  remain frozen.

## 6. Standard PostgreSQL schema lifecycle

### 6.1 Existing four tables

Because the project has never used a Miaoda production application/database,
there is no accepted production data migration to perform. The first standard
PostgreSQL bootstrap should create an empty database and apply a conceptual
versioned `0001 baseline` migration for exactly:

```text
app_users
tasks
point_records
recharge_orders
```

That baseline must be derived from the accepted generated mapping plus the
accepted local-development physical contract, with the platform system types,
defaults, indexes, and any required compatibility types resolved explicitly.
It must not silently add new business constraints or alter accepted table
semantics.

Before that migration is implemented, the exact physical baseline contract
must resolve, rather than assume away, the current `user_profile` and
`file_attachment` custom types, the `current_setting('app.user_id', true)`
defaults/expressions, platform/system fields, nullability, timestamps,
indexes, and default behavior. The current pg-mem mirror is not proof of
standard PostgreSQL parity.

### 6.2 Seven E1 tables

The approved seven E1 tables should enter the same migration history only
through a conceptual `0002 E1 knowledge provenance` migration, after the E1
database architecture is re-approved and the database implementation is
separately authorized. Its migration must follow the accepted dependency order
and physical contract, including nullable `source_record_id`, user ownership,
field-level assertions, external-link identity uniqueness, immutable version/
chunk keys, and the per-user import idempotency key.

No E1 table is created or staged by this report.

### 6.3 One-time `SCHEMA OWNERSHIP TRANSITION`

The one-time schema ownership transition is:

```text
CURRENT: Miaoda schema → db-schema-sync → generated server/database/schema.ts
TARGET:  application-owned canonical Drizzle schema
         → versioned Drizzle migrations
         → standard PostgreSQL
```

The existing import path `server/database/schema.ts` must be preserved. After
the separately authorized transition, that path ceases to be a Miaoda-generated
production artifact and becomes the application-owned canonical Drizzle schema
definition. `npm run gen:db-schema` and the Miaoda workflow cease to be
authoritative for standard PostgreSQL. No transition, migration files, or
schema mutation was performed here.

The target future arrangement is:

- a versioned, reviewable Drizzle schema definition;
- committed migration files and a migration journal/table;
- CI validation that migrations apply cleanly to an empty PostgreSQL database
  and upgrade a representative prior database;
- a controlled release migration job with backup, lock, and post-migration
  verification; and
- application startup that validates compatibility but does not silently create
  or mutate production tables.

The current `gen:db-schema` script remains historical until that transition is
separately authorized. No Drizzle migration system was invented or implemented
here.

## 7. Local pg-mem versus real PostgreSQL testing

### Keep pg-mem responsible for

- fast unit tests for Users/Tasks/Points/Orders service logic;
- deterministic transaction/use-case tests where pg-mem supports the required
  query shape; and
- local development startup without external infrastructure.

### Add standard PostgreSQL integration responsibility later

CI should provide an isolated disposable PostgreSQL service/container and apply
the committed migrations before integration tests. Those tests must cover the
real provider, generated/application schema mapping, transaction behavior,
`FOR UPDATE`, timestamp/default behavior, indexes, foreign keys, unique
constraints, and the four accepted services. C1-C4 and D1-D4 should use mocks
for external AI/storage/auth services where appropriate; no real DeepSeek call
is required.

The ECS must not be used as the integration-test database or build machine.

## 8. Aliyun ECS production environment variables

The following non-secret/runtime settings are required or expected for the
runtime artifact, subject to the later auth decision:

| Variable                                                             | Role                                  | Status                           |
| -------------------------------------------------------------------- | ------------------------------------- | -------------------------------- |
| `NODE_ENV=production`                                                | production mode                       | required                         |
| `SERVER_HOST` / `SERVER_PORT`                                        | bind address/port behind Nginx        | required/explicit                |
| `DATABASE_URL`                                                       | standard PostgreSQL connection string | new required secret              |
| database SSL/pool settings                                           | TLS and bounded connection use        | new, exact names to be finalized |
| `DOCUMENT_STORAGE_DRIVER=filesystem`                                 | self-hosted durable file mode         | required for current ECS design  |
| `DOCUMENT_STORAGE_ROOT=/var/lib/academic-writing-platform/documents` | non-public durable storage            | required                         |
| `DEEPSEEK_API_KEY`                                                   | text-generation authentication        | required for AI calls            |
| `DEEPSEEK_BASE_URL` / `DEEPSEEK_DEFAULT_MODEL`                       | optional provider settings            | optional                         |

`SUDA_DATABASE_URL`, Miaoda cache/token-file settings, and
`MIAODA_LOCAL_DEV=1` must not be treated as standard PostgreSQL production
requirements. Platform authentication variables remain conditional on the
separate auth boundary decision and must never be placed in the artifact.

Secrets must be supplied by the ECS runtime secret mechanism or protected
environment file, never copied from the repository into `dist`.

## 9. Bootstrap and rollback strategy

### Bootstrap

1. Provision an ordinary PostgreSQL database/user outside the build host.
2. Apply the versioned baseline migration for the four accepted tables through
   a controlled CI/release migration job.
3. Verify schema version, table/index/constraint inventory, and connectivity.
4. Deploy the signed artifact to the ECS runtime host.
5. Run health checks and only then enable traffic.

The migration job must use an advisory lock or equivalent single-run guard,
transactional migrations where supported, explicit backups, and a recorded
schema version. It must be a separate operational action, not an application
startup side effect.

### Rollback

- Roll back application artifacts atomically by switching the active release
  pointer to the prior verified artifact and reloading PM2.
- Prefer forward database fixes over destructive down-migrations once traffic
  or data exists.
- Before E1 traffic, the approved E1 rollback remains limited to removing only
  the seven newly created E1 tables in reverse dependency order after a
  verification failure; accepted tables are not removed or rewritten.
- The durable document directory is outside release directories and must not
  be deleted during application rollback.
- `/opt/academic-writing-platform-c4` remains historical and untouched.

## 10. Frozen paths and contracts

The following must remain unchanged during this audit and the future provider
transition unless a separate architecture review authorizes otherwise:

- `server/database/schema.ts` import path and generated-artifact boundary;
- `server/database/local-development.database.ts` as the pg-mem local-test
  boundary until a reviewed parity update is authorized;
- `DRIZZLE_DATABASE` injection contract and the Users/Tasks/Points/Orders
  service APIs;
- C1 parser, C2 builder, C3 chunking, C4 preparation/storage contracts, and
  D1-D4 tool/provider behavior;
- public shared API contracts and task lifecycle/billing behavior;
- `/var/lib/academic-writing-platform/documents` durable storage path;
- `/opt/academic-writing-platform-c4` historical smoke-test environment;
- the accepted D4 `main` commit/tag and the current E1 branch isolation.

No production code, schema, migration, CI workflow, or ECS path was changed.

## 11. Deployment architecture and artifact audit

### Required architecture

```text
GitHub Actions / Linux CI
  → npm ci
  → tests
  → lint/type-check
  → server/client build
  → package Linux runtime artifact
  → record accepted commit/tag and checksums
  → ECS downloads and verifies artifact
  → ECS runs dist only
```

The ECS must not normally run `npm ci`, `npm test`, `npm run build`,
TypeScript compilation, or Vite build. The accepted 2 vCPU / 2 GiB host is a
runtime host, not a build machine.

### Current `build.sh` / `prune-smart.js` assessment

The current scripts provide a useful starting point but do not yet prove a
sufficiently self-contained, reproducible, cryptographically attributable
Linux release artifact:

- `scripts/build.sh` runs server/client builds in parallel and defaults each
  child to an 8 GiB Node heap. This confirms why it belongs in CI, not ECS.
- It invokes `npx fullstack-cli action-plugin init`,
  `npx generate-api-routes`, and `npx generate-page-routes` without exact
  package-version pins in the script. These are not fully reproducible from
  the repository lockfile alone.
- It copies `.env` into `dist` when present. That is unsafe for a release
  artifact and must be removed from the future packaging contract; runtime
  secrets must be injected on ECS.
- `prune-smart.js` traces `dist/server/main.js` and selectively copies runtime
  packages, including a dynamic-dependency supplement. This can reduce size,
  but it is not a complete proof for native modules, runtime filesystem
  assets, optional exports, or packages loaded through opaque dynamic paths.
- It writes a pruned `dist/package.json` with dependency ranges and no pruned
  `package-lock.json`; the artifact therefore should not depend on a later ECS
  `npm install`.
- `scripts/run.sh` correctly starts `server/main.js` from the `dist` working
  directory, while the built client HTML is arranged under `dist/dist/client`.
  This layout should be tested and then treated as a release contract.
- Current GitHub Actions installs, tests, type-checks, and builds, but does not
  publish a packaged runtime artifact, a file manifest, or a deployment
  checksum. It also runs separate server/client builds rather than the full
  artifact-producing path.

### Additional packaging/checksum step required

After a future CI build, add a release-only packaging step that:

1. starts from a clean checkout at an immutable accepted commit/tag;
2. runs the pinned install and approved CI verification;
3. produces `dist` plus only the runtime dependencies and required static
   assets;
4. excludes `.env`, source maps unless explicitly needed, caches, test files,
   build tools, and development dependencies;
5. creates a deterministic archive without relying on ECS installation;
6. writes `artifact-manifest.json` containing the Git commit SHA, exact tag,
   package-lock SHA-256, Node/npm versions, build command identity, artifact
   file list, and per-file SHA-256 values; and
7. publishes the archive, manifest, and archive checksum as immutable release
   assets.

The manifest/checksum should be signed by a protected CI signing mechanism
(preferably keyless Sigstore/OIDC or an equivalently protected release key).
The ECS deployment script should download a specific immutable release asset,
verify the signature and SHA-256 before extraction, verify the embedded commit
and tag against the intended release, unpack into a new release directory,
and atomically switch the PM2 release pointer. A mutable branch zip or an
ECS-side rebuild is not sufficient cryptographic provenance.

## 12. Required future work before implementation authorization

The following are architecture gates, not work performed by this audit:

1. approve the frozen standard PostgreSQL provider boundary and its
   auth/user-context interaction;
2. define the exact baseline PostgreSQL physical schema for the four accepted
   tables, including treatment of platform custom system types;
3. authorize the one-time schema ownership transition and the separate
   versioned migration/release job;
4. define the CI artifact, signing, verification, and release directory
   contract through the separate deployment-infrastructure gate; and
5. only after those decisions, authorize narrowly scoped implementation work.

## 13. Explicit non-actions

- No `npm ci`, TypeScript build, Vite build, or installation was run on ECS.
- No PostgreSQL server was installed or started.
- No database/table/index/foreign-key/unique-constraint mutation occurred.
- `server/database/schema.ts` was not modified.
- No migration files or migration workflow were created.
- GitHub Actions were not modified.
- Task 7 was not entered.
- No E1 production code was implemented.

This report intentionally does not declare `E1_DATABASE_PREFLIGHT_PASS` or
authorize Task 7. It is submitted for ChatGPT architecture review.
