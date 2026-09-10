# P3 Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task after IMPLEMENTATION_AUTHORIZED. This document is a Plan Review artifact only; it does not authorize implementation.

Goal: Deploy the accepted platform to the prepared single-node Alibaba Cloud ECS host and prove the real standalone OIDC, provider, database, persistence, recovery, and browser Workflow A/B contracts end to end.

Architecture: Nginx terminates HTTPS and redirects HTTP to HTTPS, then proxies only to a loopback-bound Node process managed by PM2 in single-fork mode. The Node process uses PostgreSQL 16 with pgvector over verified TLS, an absolute private filesystem root, the existing server JWT/JWKS verifier, and the existing DeepSeek, OpenAlex, embedding, and Zotero provider abstractions.

Tech Stack: Ubuntu 22.04.5 LTS, Node.js >=22, npm >=10, NestJS, React/Vite, PM2, Nginx, PostgreSQL 16, pgvector, Drizzle migrations, oidc-client-ts for browser Authorization Code + PKCE, and @playwright/test for deployed-browser validation.

Spec: Frozen P3 architecture and constraints supplied in the P3 transition request; accepted implementation baseline at 666f40309b42f2c0d44e4fd6ecbcd1e81f869a8d.

## Global Constraints

- Do not implement, create a branch, commit, push, create a PR, merge, tag, or mutate the server until ChatGPT records IMPLEMENTATION_AUTHORIZED.
- Use the accepted main/tag baseline and keep P3 as one Phase branch after authorization.
- Production runtime is Node >=22 with npm >=10 on Ubuntu 22.04.5; PostgreSQL is 16 with a PostgreSQL-16-compatible pgvector package.
- All application, migration, backup, restore, and verification database connections use certificate verification; sslmode=require alone is not sufficient.
- Public traffic is HTTPS through Nginx; Node and PostgreSQL ports remain private; PM2 is one fork and recovers through systemd on boot.
- Production secrets remain outside Git, release artifacts, frontend bundles, screenshots, fixtures, and logs.
- Reuse existing migrations, health, shutdown, backup, restore, storage, provider, ownership, and E1-E6 contracts; do not introduce excluded infrastructure.

## Decision Required Before Implementation

The following are intentionally not invented in this plan and must be supplied or approved by the ChatGPT Controller/operator:

- OIDC provider/vendor, registered client, issuer metadata, and provider-side claim configuration.
- Production DNS name and canonical HTTPS origin.
- Embedding provider, model, optional model revision, and vector dimensions. The selection must be compatible with a fresh production index or with any restored index fingerprint.
- TLS certificate/CA provisioning source for the public Nginx certificate and PostgreSQL server certificate.
- Production PostgreSQL database name, application role, migration role, and backup destination/retention policy.
- Two real non-production browser identities for E2E User A and User B, plus a safe way for Playwright to authenticate without committing credentials.
- Whether the authorized implementation may add oidc-client-ts and @playwright/test. Both are recommended because the accepted baseline has no browser OIDC client or deployed-browser runner.

The recommended browser library is oidc-client-ts. It is vendor-neutral, handles Authorization Code + PKCE, state, nonce, discovery, and callback exchange, and avoids hand-rolled token protocol code. The exact dependency version must be pinned in package.json/package-lock.json during authorized implementation. Provider-specific authorization parameters must not be hardcoded; provider registration must issue a token satisfying the accepted server issuer, audience, user-id claim, and allowed-algorithm checks.

## 1. Baseline Audit

### Accepted Git baseline

- main, origin/main, and origin/HEAD resolve to 666f40309b42f2c0d44e4fd6ecbcd1e81f869a8d.
- Annotated tag phase-p2-accepted exists; tag object 6fb1c906cf16fe8b1f6d7a2b397af606932aac71 peels to 666f40309b42f2c0d44e4fd6ecbcd1e81f869a8d.
- P2 merge commit is 171dcac876cf097c010b00ebf39aa7abc9231caf; P2 final-main CI is recorded by the Controller as run 34238793993, SUCCESS.
- The working tree is clean and no P3 branch exists.

### Accepted contracts to preserve

- package.json requires Node >=22.0.0 and npm >=10.0.0.
- [A: implementation worktree / CI] npm ci, npm run build, npm run db:migrate, npm run db:backup, npm run db:restore:verify -- --confirm-restore, npm run test:app-bootstrap, npm run lint, npm run type:check, and the CI jobs are the baseline verification surface. These npm DB commands are not production ECS commands.
- scripts/build.sh produces a reviewed staging artifact under the worktree dist/; after the authorized P3 artifact-closure change, that staging artifact contains server/main.js, the client artifact under dist/client, run.sh, pruned node_modules/package.json, only the allow-listed DB scripts under scripts/, and exact drizzle/migrations from the same commit. The release installer copies this exact staging tree as /opt/academic-writing-platform/releases/<commit-sha>/app/; only that app/ tree is authoritative in production. It never copies .env, tests, fixtures, development tooling, or the whole repository scripts/ directory into the artifact.
- server/main.ts enables SIGTERM/SIGINT shutdown hooks, uses SERVER_HOST/SERVER_PORT, serves dist/client, and must be bound to loopback on the host.
- server/config/production-config.ts and server/config/config-validation.ts reject local-memory/local-fixed production operation, require standalone PostgreSQL/filesystem/auth/provider configuration, require HTTPS OIDC issuer/JWKS, and reject unsafe production logging/CORS settings.
- server/database/standard-postgres.module.ts and scripts/db-migrate.js require PostgreSQL, use bounded pool settings, require TLS in production, reject DATABASE_SSL=disable, and reject DATABASE_SSL_REJECT_UNAUTHORIZED=false. P3 also requires an explicit trusted CA for Node/migration and libpq certificate verification for backup/restore.
- server/auth/standalone-auth.adapter.ts validates JWT signature, configured algorithm, issuer, audience, expiry, user-id claim, and JWKS; server/auth/standalone-auth.guard.ts maps the verified user to request context.
- client/src/auth/session-provider.ts currently expects window.__academicWritingAuthBridge for standalone browser auth. This is the known P3 closure gap; server JWT/JWKS is not to be rewritten.
- /health/live, /health/ready, and authenticated /health/providers already exist through server/modules/health/*. Readiness checks PostgreSQL and persistent storage; provider health checks LLM and embedding.
- server/modules/document-input/filesystem-document-storage.adapter.ts uses a canonical private filesystem key below an absolute root. storage-readiness.ts requires access, restrictive permissions, and at least 100 MiB free space.
- E2 embedding identity is provider openai-compatible-embedding plus model, optional model revision, dimensions, and E2 profile/index fingerprints.
- DeepSeek, OpenAlex, and Zotero production configuration is validated by server/config/external-provider-validation.ts. Zotero credentials are encrypted by server/modules/zotero/zotero-crypto.ts using AES-256-GCM and a versioned 32-byte key.

### Authoritative-state drift

PROJECT_STATE.md, ROADMAP.md, and the existing P2 report still contain historical FINAL_CLOSEOUT_PENDING wording, while the accepted tag and current main prove the accepted baseline above. This Plan does not rewrite those governance records. The Controller must use the accepted Git pointer and final-main CI evidence supplied above for P3 authorization.

## 2. Assumptions / External Inputs

- The host is the preflighted academic-writing-p3 ECS instance in Hangzhou: Ubuntu 22.04.5, x86_64, 4 vCPU, 8 GB-class RAM, 60 GB ESSD Entry, 5 Mbps public bandwidth.
- WorkBench is the approved host-management path. No host mutation occurs during Plan Review.
- Public traffic is limited to 80 and 443. Port 22 remains the standard management path. Port 2222 is not part of the design and must be removed from any old test rule.
- DNS and certificates are available before public E2E. Application and PostgreSQL ports remain private.
- Production data is a controlled validation dataset, not an existing customer migration. If that assumption is false, stop before migration and request a separate data-migration decision.
- Provider connectivity checks may contact real external endpoints only after explicit operator provisioning and only during authorized deployment/E2E checkpoints.

## 3. Frozen Boundaries

- Do not change accepted E1-E6 provenance, embedding identity/fingerprint, retrieval, citation, Zotero, Academic Search, task, or payment-unavailable semantics.
- Do not replace the server standalone JWT/JWKS verifier with a different token model.
- Browser authentication is Authorization Code + PKCE. No mock token, fabricated token, password flow, implicit flow, or access-token logging.
- Production uses RUNTIME_PROFILE=standalone, NODE_ENV=production, PostgreSQL, an absolute private filesystem root, and HTTPS provider endpoints.
- Production forbids DATABASE_SSL=disable and DATABASE_SSL_REJECT_UNAUTHORIZED=false. DATABASE_SSL_CA must contain trusted PostgreSQL CA PEM content, or an authorized equivalent CA-file contract must be added to both runtime and migration paths.
- Node binds to 127.0.0.1; Nginx is the only public application entry point. PostgreSQL is not publicly reachable.
- DOCUMENT_STORAGE_ROOT is outside the release directory and public web root.
- Secrets never enter Git, the production artifact, frontend bundle, screenshots, fixtures, or logs.
- P3 does not introduce Redis, BullMQ, durable queues, workers, crash replay, object storage, distributed rate limiting, Kubernetes, HA PostgreSQL, advanced APM, enterprise DR, real payment, or large-scale performance testing.

## 4. Dependency Graph

    P3-WP0 accepted-main and host revalidation
            |
    P3-WP1 runtime/deployment scaffolding + browser test contract
            |
    P3-WP2 PostgreSQL 16 + pgvector + verified TLS
            |
    P3-WP3 persistent filesystem + permissions + storage readiness
            |
    P3-WP4 standalone OIDC browser Authorization Code + PKCE
            |
    P3-WP5 provider activation and health validation
            |
    P3-WP6 artifact release + PM2 lifecycle
            |
    P3-WP7 Nginx/domain/HTTPS/firewall boundary
            |
    P3-WP8 migration/startup/health/restart validation
            |
    P3-WP9 deployed Playwright E2E and isolation
            |
    P3-WP10 backup/restore/reboot/rollback rehearsal
            |
    Final P3 acceptance preparation

WP2 and WP3 must pass before the standalone production process is runnable. WP4 must pass before authenticated browser E2E. WP5 must pass before provider readiness is claimed. WP6-WP8 are deployment prerequisites for WP9. WP10 uses an isolated recovery database and must not overwrite the live database.

## 5. Work Packages

### P3-WP0 — Accepted baseline and host revalidation

Goal: Establish reproducible evidence that implementation starts from accepted main and the prepared host, without changing either.

Existing Accepted Contract: Git/tag pointers in Section 1 and host flags P3_HOST_CONFIGURATION=PASS, P3_HOST_PREFLIGHT=PASS, P3_HOST_READY=YES.

Files to Inspect: PROJECT_STATE.md, ROADMAP.md, AGENTS.md, CODEX_WORKFLOW.md, both P1/P2 reports, package.json, .github/workflows/ci.yml, scripts/build.sh, server/config, server/auth, server/database, server/modules/health, and server/modules/document-input.

Files Expected to Change: None.

Server Changes: None during planning. After authorization, run read-only OS, architecture, disk, memory, service, listener, firewall, and old-2222 checks.

Configuration / Env: None.

Secrets / Operator Inputs: WorkBench access only; no application secret.

Commands after authorization [A: implementation worktree / Git]:

    git fetch origin --tags
    git status --short --branch
    git log -1 --format='%H %D'
    git show-ref --tags phase-p2-accepted
    git cat-file -p phase-p2-accepted
    git config --local --get http.version
    git remote -v

Host checks after authorization [C: production host OS]:

    uname -a
    lsb_release -a
    node --version
    npm --version
    df -hT
    free -h
    ss -ltnp
    sudo ufw status verbose
    sudo ss -ltnp | grep -E ':(22|80|443|2222|3000|5432)\b' || true

Tests Before Change: Baseline pointer and clean-tree checks; no code test is required.

Implementation Steps: Record output, compare exact pointers, and stop if host identity is wrong or a public Node/PostgreSQL port is exposed.

Verification: main and origin/main match; tag is annotated and peels to the same commit; no unexpected public service exists.

Failure Condition: Pointer mismatch, dirty worktree, unexpected branch, public 5432/3000, or old 2222 rule.

Rollback: No mutation; return evidence to the Controller.

Evidence to Record: baseline.txt, host-preflight.txt, timestamp, operator, host identifier, and complete command output.

Git Commit Boundary: No commit. This is an authorization checkpoint.

Out-of-Scope Guard: No package installation or firewall alteration.

### P3-WP1 — Runtime/deployment scaffolding and E2E harness contract

Goal: Add reviewable, non-secret deployment definitions and a reproducible browser-test contract around the accepted artifact.

Existing Accepted Contract: scripts/build.sh owns artifact creation; scripts/run.sh starts server/main.js from dist; package.json owns Node/npm floors and baseline scripts. P3 must narrowly extend build.sh so the artifact also ships the three approved DB operational scripts and exact migrations without shipping npm scripts, Jest, devDependencies, or unrelated source tooling.

Files to Inspect: package.json, package-lock.json, scripts/build.sh, scripts/run.sh, scripts/test-production-artifact.js, scripts/test-reproducible-build.js, client/index.html, client/src/app.tsx, client/src/auth, and P2 client pages/components.

Files Expected to Change:

- Create deploy/pm2/ecosystem.config.cjs for one fork, cwd=current/app, bounded restart behavior, Node 22 --env-file loading from an external env file, and log paths. It contains no secret values.
- Create deploy/nginx/academic-writing-platform.conf with HTTP redirect, TLS, security headers, upload/body limit, and loopback upstream.
- Create deploy/scripts/host-preflight.sh, release-install.sh, release-activate.sh, verify-live.sh, and rollback.sh.
- Create docs/deployment/P3_RUNBOOK.md, P3_ENVIRONMENT_MANIFEST.md, and P3_ACCEPTANCE_EVIDENCE.md.
- Modify scripts/build.sh and scripts/test-production-artifact.js. Add a focused artifact-closure test beside the existing production artifact tests if the current test file cannot express the allow-list.
- Modify package.json and package-lock.json only if the Controller authorizes oidc-client-ts and @playwright/test.
- Create playwright.config.ts, test/e2e/p3-production.spec.ts, and test/e2e/support/p3-auth.ts only after the browser dependency decision.

Server Changes: Use this one authoritative layout. The app directory is the exact reviewed build artifact copied without semantic changes; deploy is metadata from the same reviewed commit:

    /opt/academic-writing-platform/releases/<commit-sha>/
      app/
        server/
        dist/
        node_modules/
        package.json
        run.sh
        scripts/
          db-migrate.js
          db-backup.js
          db-restore-verify.js
        drizzle/
          migrations/
      deploy/
        pm2/
        nginx/
        scripts/
    /opt/academic-writing-platform/current -> /opt/academic-writing-platform/releases/<commit-sha>
    /etc/academic-writing-platform/production.env
    /etc/academic-writing-platform/postgres-ca.pem
    /var/lib/academic-writing-platform/documents/
    /var/log/academic-writing-platform/
    /var/backups/academic-writing-platform/

Within each release, app/package.json is the pruned production manifest and app/ contains no npm scripts, Jest, devDependencies, test fixtures, or unrelated repository scripts. deploy/ is copied from the same reviewed commit; app/ and deploy/ are jointly covered by the release manifest/hash evidence.

Configuration / Env: PM2 receives NODE_ENV=production, RUNTIME_PROFILE=standalone, SERVER_HOST=127.0.0.1, SERVER_PORT=3000, and the protected production manifest.

Secrets / Operator Inputs: Env-file path, certificates, domain, and two E2E identities.

Commands after authorization [A: implementation worktree / CI]:

    npm ci
    node scripts/test-reproducible-build.js
    npm run build
    node scripts/test-production-artifact.js
    npx playwright install --with-deps chromium
    npx playwright test --config=playwright.config.ts --list

Tests Before Change: npm test -- --runInBand; production config/bootstrap tests; reproducible-build test; artifact smoke; npm run type:check.

Implementation Steps: Add failing tests for PM2/Nginx invariants, production-artifact closure, and the public runtime-config/auth contract. Modify scripts/build.sh narrowly so the reviewed staging artifact contains runtime files plus only scripts/db-migrate.js, scripts/db-backup.js, scripts/db-restore-verify.js, and the exact drizzle/migrations tree from the same reviewed commit. Modify scripts/test-production-artifact.js, or add a focused artifact-closure test beside it, to reject missing allow-listed files, extra app/scripts files, mismatched migrations, .env files, tests, fixtures, development tooling, and unrelated repository scripts. The production artifact must not gain npm scripts, Jest, devDependencies, or test fixtures. Add minimal deployment definitions. PM2 must set instances=1, exec_mode=fork, autorestart=true, bounded restart settings, cwd=/opt/academic-writing-platform/current/app, script=server/main.js, and node_args=--env-file=/etc/academic-writing-platform/production.env. Nginx must proxy only to 127.0.0.1:3000 and redirect port 80.

Verification: Static tests reject secrets, floating production tools, multiple PM2 instances, non-loopback upstream, missing HTTPS redirect, public DB/app ports, missing app/scripts/db-migrate.js, app/scripts/db-backup.js, app/scripts/db-restore-verify.js, or app/drizzle/migrations, extra files in app/scripts, migrations that do not match the reviewed commit, and any artifact content outside the approved runtime/operational allow-list.

Failure Condition: Artifact layout differs from build.sh, PM2 depends on repository secrets, or browser runner needs credentials stored in the repository.

Rollback: Remove only unactivated deployment definitions on the Phase branch; no host mutation is performed here.

Evidence to Record: Config-test output, artifact manifest/hash, Playwright version/browser manifest, and sanitized file diff.

Git Commit Boundary: chore(p3): add deployment and e2e scaffolding.

Out-of-Scope Guard: Do not install PM2/Nginx/Playwright browsers in this WP.

### P3-WP2 — PostgreSQL 16, pgvector, migrations, and verified TLS

Goal: Provision private PostgreSQL 16 + pgvector and prove migrations, schema, pool configuration, and certificate verification.

Existing Accepted Contract: CI uses pgvector/pgvector:pg16; four migrations exist; restore verification expects vector, 14 public tables, and four migration records.

Files to Inspect: server/database/standard-postgres.module.ts, database-readiness.ts, schema.ts, drizzle/migrations/*, scripts/db-migrate.js, scripts/db-backup.js, scripts/db-restore-verify.js, and PostgreSQL integration/config tests.

Files Expected to Change: If the current Node pg code cannot consume a CA file safely, modify server/database/standard-postgres.module.ts, scripts/db-migrate.js, scripts/db-backup.js, scripts/db-restore-verify.js, their tests, and .env.example to support DATABASE_SSL_CA_FILE while retaining the accepted DATABASE_SSL_CA content contract. Ensure the three shipped DB scripts fail closed unless libpq receives PGSSLMODE=verify-full and PGSSLROOTCERT=/etc/academic-writing-platform/postgres-ca.pem, and ensure Node migration TLS uses the trusted CA with rejectUnauthorized=true. The authorized build closure must ship only scripts/db-migrate.js, scripts/db-backup.js, scripts/db-restore-verify.js and the exact drizzle/migrations tree in app/. Add scripts/verify-production-database.js only if existing commands cannot express the safe check. No accepted TLS rejection rule may be relaxed.

Server Changes after authorization: Use the PGDG apt repository for Ubuntu jammy as the approved PostgreSQL 16 package source. First verify the repository signature/key and package candidates; do not assume the stock Ubuntu repository contains PostgreSQL 16 or pgvector. Install PostgreSQL 16 and its PostgreSQL-16-compatible pgvector package from that approved source. If the approved repository has no matching pgvector package, stop and report instead of selecting an unapproved package, building an unpinned version, or switching to Docker. Create a private database, runtime application role, and separately approved migration role. Bind PostgreSQL privately, enable TLS, issue a certificate whose hostname/SAN matches the database host in DATABASE_URL, install the CA at /etc/academic-writing-platform/postgres-ca.pem, and verify pg_hba.conf does not allow public access.

Configuration / Env:

    DATABASE_URL=postgresql://<app-role>:<password>@<certificate-san-host>:5432/<database>
    MIGRATION_DATABASE_URL=postgresql://<migration-role>:<password>@<certificate-san-host>:5432/<database>
    DATABASE_SSL_CA_FILE=/etc/academic-writing-platform/postgres-ca.pem
    DATABASE_SSL_CA=<trusted PostgreSQL CA PEM content; compatibility fallback when CA_FILE is not used>
    PGSSLMODE=verify-full
    PGSSLROOTCERT=/etc/academic-writing-platform/postgres-ca.pem
    DATABASE_POOL_MAX=5
    DATABASE_IDLE_TIMEOUT_MS=10000
    DATABASE_CONNECTION_TIMEOUT_MS=5000

Secrets / Operator Inputs: Database names/roles/passwords and CA material. Never put them in Git, logs, or screenshots.

Commands after authorization [C: production host OS / PostgreSQL administrative context]:

    sudo install -d -m 0755 /etc/apt/keyrings
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor | sudo tee /etc/apt/keyrings/postgresql.gpg >/dev/null
    gpg --show-keys --with-fingerprint /etc/apt/keyrings/postgresql.gpg
    echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt jammy-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list
    sudo apt-get update
    apt-cache policy postgresql-16 postgresql-client-16 postgresql-16-pgvector
    sudo apt-get install -y postgresql-16 postgresql-client-16 postgresql-16-pgvector
    dpkg -L postgresql-16-pgvector | grep -E 'vector\\.control|vector--.*\\.sql'
    sudo -u postgres psql -c "SELECT version();"
    sudo -u postgres psql --dbname="<database>" -c "CREATE EXTENSION IF NOT EXISTS vector;"
    sudo -u postgres psql -d "<database>" -Atc "SELECT extversion FROM pg_extension WHERE extname='vector';"
    export PGSSLMODE=verify-full
    export PGSSLROOTCERT=/etc/academic-writing-platform/postgres-ca.pem
    pg_isready --dbname="$DATABASE_URL"
    psql "$RECOVERY_DATABASE_URL" --no-psqlrc --tuples-only --no-align --command "SELECT extversion FROM pg_extension WHERE extname='vector';"

Commands after authorization [A: implementation worktree / CI]:

    npm run db:migrate
    npm run test:integration:postgres
    npm run db:backup
    npm run db:restore:verify -- --confirm-restore

Commands after authorization [B: production release app]:

    cd /opt/academic-writing-platform/current/app
    node --env-file=/etc/academic-writing-platform/production.env scripts/db-migrate.js
    BACKUP_OUTPUT_PATH=/var/backups/academic-writing-platform/schema-check.dump node --env-file=/etc/academic-writing-platform/production.env scripts/db-backup.js
    BACKUP_INPUT_PATH=/var/backups/academic-writing-platform/schema-check.dump node --env-file=/etc/academic-writing-platform/production.env scripts/db-restore-verify.js --confirm-restore

Production ECS does not run Jest, npm test scripts, or the full repository. The three B-context commands execute the allow-listed scripts shipped in current/app. The protected env file supplies DATABASE_URL or MIGRATION_DATABASE_URL, DATABASE_SSL_CA_FILE, PGSSLMODE=verify-full, and PGSSLROOTCERT; no command may downgrade to sslmode=require or disable certificate verification.

Tests Before Change [A: implementation worktree / CI]: Standard Postgres config/readiness tests, CI postgres-schema job, migration idempotency, and restore verification against disposable PostgreSQL 16 + pgvector. Add tests proving DATABASE_SSL_CA_FILE is loaded as CA content, PGSSLMODE=verify-full is required for libpq operations, sslmode=require alone is insufficient, the forbidden DATABASE_SSL flags fail, and the production artifact contains the three allow-listed scripts plus exact migrations.

Implementation Steps: Verify the downloaded PGDG signing-key fingerprint against the approved PostgreSQL signing-key fingerprint recorded by the operator, then verify the signed repository and package candidates; install postgresql-16, postgresql-client-16, and the PostgreSQL-16-compatible postgresql-16-pgvector package; verify vector.control/vector SQL files with dpkg -L; run CREATE EXTENSION vector; query extversion; verify the exact migrations are present at current/app/drizzle/migrations; run the shipped current/app/scripts/db-migrate.js directly; rerun migrations for idempotency; and test all five connection paths with certificate verification. Node runtime and migration use DATABASE_SSL_CA_FILE or accepted DATABASE_SSL_CA with rejectUnauthorized=true. The shipped db-backup.js, db-restore-verify.js, pg_dump, pg_restore, and psql use PGSSLMODE=verify-full plus PGSSLROOTCERT. The DATABASE_URL host must match the PostgreSQL certificate SAN. Confirm runtime role cannot alter migrations unless approved.

Verification: PostgreSQL 16, vector extension files installed, CREATE EXTENSION succeeds, extversion is recorded, four migrations, 14 expected tables, pg_isready, Node/migration TLS with rejectUnauthorized=true, libpq tools with PGSSLMODE=verify-full and PGSSLROOTCERT, and no public 5432 listener. sslmode=require without verify-full is a failure, not a pass.

Failure Condition: Missing CA verification, unsafe TLS flags, failed migration, missing vector, wrong counts, or public PostgreSQL exposure.

Rollback: Before live data exists, drop only the rehearsal database/roles through approved operator action. Never delete migrations or restore over live.

Evidence to Record: PostgreSQL version, extension, migration/schema output, TLS verification, listener/firewall output, and role summary without passwords.

Git Commit Boundary: test(p3): cover production database tls contract, only if code support is required.

Out-of-Scope Guard: No HA, replication, Redis, queues, object storage, or public DB endpoint.

### P3-WP3 — Persistent document filesystem

Goal: Create a durable private document root independent of releases and prove upload/readability across restart.

Existing Accepted Contract: DOCUMENT_STORAGE_ROOT is absolute; filesystem storage rejects public roots; readiness requires access, restrictive mode, and free capacity; generated keys are canonical and owner-scoped.

Files to Inspect: server/modules/document-input/document-storage.config.ts, filesystem-document-storage.adapter.ts, storage-readiness.ts, their specs, production-config.ts, and document-input integration tests.

Files Expected to Change: No business storage changes. Add deploy/scripts/prepare-storage.sh, deploy/scripts/verify-storage.sh, and focused persistent-storage boundary tests.

Server Changes after authorization:

    sudo groupadd --system academic-writing  # only when the group is absent
    sudo useradd --system --gid academic-writing --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin academic-writing  # only when the user is absent
    sudo install -d -o academic-writing -g academic-writing -m 700 /var/lib/academic-writing-platform/documents
    sudo install -d -o academic-writing -g academic-writing -m 700 /var/log/academic-writing-platform
    sudo install -d -o academic-writing -g academic-writing -m 700 /var/backups/academic-writing-platform
    sudo -u academic-writing test -r /var/lib/academic-writing-platform/documents
    sudo -u academic-writing test -w /var/lib/academic-writing-platform/documents
    stat -c '%a %U %G %n' /var/lib/academic-writing-platform/documents
    df -B1 /var/lib/academic-writing-platform/documents

Configuration / Env: DOCUMENT_STORAGE_DRIVER=filesystem and DOCUMENT_STORAGE_ROOT=/var/lib/academic-writing-platform/documents.

Secrets / Operator Inputs: Dedicated Unix service user/group and filesystem ownership.

Commands after authorization [B: production release app / HTTPS + C: host OS]: Run storage readiness, upload a non-empty fixture through the authenticated endpoint, record the generated private key, restart PM2, download the same object, and verify the file is not under current/app/dist/client.

Tests Before Change: document-input specs, storage readiness tests, and Workflow A/B local contract tests.

Implementation Steps: Idempotently establish the exact academic-writing system group/user when absent, fail closed on an incompatible existing identity without recreating or renumbering it, create the mode-700 root, verify the runtime identity, perform upload/download, verify external path, and use temporary-file cleanup only as an optional best-effort operational command.

Verification: Storage readiness returns ready, no group/other permissions exist, file hash survives restart/release switch, and anonymous/static requests cannot read the file.

Failure Condition: Missing/open/low-capacity root, root under public/release path, or lost file after restart.

Rollback: Stop using the new release while preserving the persistent root; do not delete documents.

Evidence to Record: stat, df, readiness response, upload/download hashes, and release/storage paths.

Git Commit Boundary: test(p3): assert persistent storage deployment boundary, only if a new test is added.

Out-of-Scope Guard: No OSS/S3/object storage migration or retention redesign.

### P3-WP4 — Standalone OIDC browser Authorization Code + PKCE

Goal: Replace the missing standalone browser bridge with a real vendor-neutral OIDC login/logout/session-restoration flow while keeping server JWT/JWKS verification unchanged.

Existing Accepted Contract: StandaloneAuthAdapter consumes getAccessToken, optional getSession, beginLogin, and signOut; AppAuthProvider configures centralized bearer HTTP; RequireAuth redirects anonymous users to /login; LoginPage calls beginLogin; server validates the bearer token.

Files to Inspect: client/src/auth/session.types.ts, session-provider.ts, AppAuthProvider.tsx, RequireAuth.tsx, return-path.ts, client/src/pages/Login/LoginPage.tsx, client/src/app.tsx, client/index.html, server/modules/view/view.controller.ts, production-config.ts, config-validation.ts, and auth tests.

Files Expected to Change:

- Create client/src/auth/standalone-oidc.ts around the approved oidc-client-ts version. Fetch GET /api/runtime-config/oidc, configure response_type=code, PKCE, scope=openid profile email, state/nonce, and WebStorageStateStore backed by sessionStorage for both transient state and the user session. Do not use localStorage for access/id tokens or long-lived credentials.
- Modify client/src/auth/session.types.ts and session-provider.ts so standalone runtime constructs the OIDC adapter from GET /api/runtime-config/oidc instead of requiring window.__academicWritingAuthBridge.
- Modify AppAuthProvider.tsx, RequireAuth.tsx, LoginPage.tsx, and app.tsx for callback completion, sanitized return paths, loading, anonymous, errors, logout, and restoration without redirect loops.
- Create server/config/standalone-oidc-client.ts and its spec to validate public browser settings: provider label, client ID, issuer, redirect URI, post-logout redirect URI, and scope.
- Create server/modules/runtime-config/runtime-config.module.ts, runtime-config.controller.ts, runtime-config.service.ts, and their tests. GET /api/runtime-config/oidc is unauthenticated only because login must bootstrap before a session; it returns public OIDC settings only, sends Cache-Control: no-store, and never returns API keys, database values, client secrets, JWKS policy, or credentials.
- Do not inject OIDC settings into client/index.html or server/modules/view/view.controller.ts. The narrow endpoint avoids script-context serialization risk and keeps production settings outside the static artifact.
- Add test/unit/standalone-oidc-client.spec.ts, test/unit/runtime-oidc-config.spec.ts, and extend test/unit/auth-session-client.spec.ts.

Server Changes: No JWT verifier rewrite. Only public client configuration may reach the browser. Server-only credentials and unnecessary JWKS/audience policy must not be emitted.

Configuration / Env:

    OIDC_PROVIDER=<operator-selected vendor label>
    OIDC_CLIENT_ID=<registered public client id>
    OIDC_ISSUER_URL=https://<issuer>
    OIDC_AUDIENCE=<server-validated audience>
    OIDC_JWKS_URL=https://<issuer jwks endpoint>
    OIDC_USER_ID_CLAIM=sub
    OIDC_ALLOWED_ALGORITHMS=RS256
    OIDC_REDIRECT_URI=https://<domain>/auth/callback
    OIDC_POST_LOGOUT_REDIRECT_URI=https://<domain>/login
    OIDC_TIMEOUT_MS=3000

Secrets / Operator Inputs: Provider registration, client ID, redirect allow-list, logout allow-list, issuer/audience/JWKS/claim/algorithm. No browser client secret is assumed; if the provider requires one, report a design conflict instead of bundling it.

Tests Before Change: Existing server standalone signature/issuer/audience/expiry/claim/algorithm tests, client adapter tests, bearer-token tests, and return-path tests.

Implementation Steps:

1. Write a failing unit test proving authorization uses code + PKCE, persists state/nonce per approved policy, and rejects callback state/issuer/token errors.
2. Write a failing test proving /login?returnTo=... yields only a same-origin sanitized path.
3. Write a failing test proving callback exchange restores session and central HTTP sends only a real access token.
4. Implement GET /api/runtime-config/oidc as a same-origin narrow public endpoint returning only provider, clientId, issuer, redirectUri, postLogoutRedirectUri, and scope; set Cache-Control: no-store and use normal JSON serialization rather than HTML/script interpolation.
5. Implement the adapter with oidc-client-ts; use WebStorageStateStore with window.sessionStorage for state/nonce and UserManager user state, do not use localStorage, and do not hand-roll cryptographic verification or token exchange.
6. Add callback route/page that calls signinCallback, restores the safe return path, and clears transient state.
7. Implement logout through the OIDC end-session flow when configured and clear session-scoped state without exposing errors.
8. Add static tests proving no mock_token, aw_user_token, access token, client secret, or provider credential enters source or logs, and proving localStorage is not used for OIDC state or tokens.

Verification: Real anonymous → provider login → callback → protected request succeeds; refresh restores; logout returns to login; invalid state, expired token, wrong issuer, and wrong audience fail closed.

Failure Condition: Provider token mismatch, redirect mismatch, PKCE/state/nonce failure, callback loop, token left in URL, unsafe persistence, or secret-bearing bundle.

Rollback: Disable the new browser route and retain prior fail-closed behavior in the release; do not change server JWT validation/data.

Evidence to Record: Redacted browser trace, callback status, token-absence scan, server 401/200 evidence, provider metadata, and logout result.

Git Commit Boundary: feat(p3): close standalone oidc browser auth.

Out-of-Scope Guard: No password auth, implicit grant, custom JWT signing, server token minting, or provider-specific branch without approval.

### P3-WP5 — Provider and secret activation

Goal: Activate real provider connectivity using accepted abstractions and prove health/error boundaries without leaking secrets.

Existing Accepted Contract: DeepSeek uses /chat/completions and /models; OpenAlex uses configured HTTPS base/cursor secret; embedding uses OpenAI-compatible /embeddings and /models with configured identity/dimensions; Zotero uses configured API base and AES-256-GCM credential crypto.

Files to Inspect: server/config/external-provider-validation.ts, .env.example, server/modules/ai-tools/llm/deepseek.provider.ts, llm.service.ts, academic-search config/client/provider files, knowledge/indexing embedding config/provider/fingerprint files, and zotero config/crypto/client/resolver files.

Files Expected to Change: Prefer none. Add scripts/verify-production-providers.js only if existing provider health cannot record a safe matrix. Extend config tests only for a discovered contract gap.

Server Changes: No provider software installation. Provision outbound HTTPS/DNS/time synchronization.

Configuration / Env:

    DEEPSEEK_API_KEY=<secret>
    DEEPSEEK_BASE_URL=https://api.deepseek.com
    DEEPSEEK_DEFAULT_MODEL=<approved available model>
    DEEPSEEK_PREMIUM_MODEL=<approved optional model>
    EMBEDDING_BASE_URL=https://<approved embedding endpoint>
    EMBEDDING_API_KEY=<secret>
    EMBEDDING_MODEL=<approved model>
    EMBEDDING_MODEL_REVISION=<approved revision or omitted>
    EMBEDDING_DIMENSIONS=<approved integer matching model>
    EMBEDDING_TIMEOUT_MS=10000
    OPENALEX_API_BASE_URL=https://api.openalex.org
    OPENALEX_API_KEY=<optional secret>
    ACADEMIC_SEARCH_CURSOR_SECRET=<secret>
    ZOTERO_API_BASE_URL=https://api.zotero.org
    ZOTERO_CREDENTIAL_ENCRYPTION_KEY=<base64 of exactly 32 bytes>
    ZOTERO_CREDENTIAL_ENCRYPTION_KEY_VERSION=v1

Secrets / Operator Inputs: Protected env file or approved secret manager. Embedding provider/model/revision/dimensions are one immutable identity. Existing indexed data is reusable only when profile/index fingerprints match.

Tests Before Change: DeepSeek, OpenAlex, embedding, Zotero, health, config-validation, fingerprint, and encryption tests with fakes; real connectivity only after explicit provisioning.

Implementation Steps: Validate env without printing values; call authenticated /health/providers; call OpenAlex search; call embedding health and one bounded embedding; run a minimal DeepSeek health/generation call only when required; connect a test Zotero account and import a bounded item/attachment; verify encrypted metadata contains no plaintext credential.

Verification: Real configured/reachable health, normalized OpenAlex result, correct embedding identity/dimensions, Zotero sync/import, and safe upstream errors.

Failure Condition: Invalid HTTPS, wrong dimensions, fingerprint mismatch, unsafe upstream error, wrong Zotero key length, plaintext secret, or false health success.

Rollback: Remove unactivated env and revoke/rotate credentials. Do not delete imported knowledge or alter provider code.

Evidence to Record: Redacted health JSON, request timestamps/statuses, model/dimension identity, fingerprint, OpenAlex result ID, Zotero IDs, and secret-scan output.

Git Commit Boundary: test(p3): add production provider activation checks, only if a safe checker is required.

Out-of-Scope Guard: No provider replacement, reranker, generated-content indexing, or new AI algorithm.

### P3-WP6 — Immutable artifact release and PM2 lifecycle

Goal: Build one immutable commit-addressed artifact, activate it through a symlink, and prove single-fork startup/shutdown/restart.

Existing Accepted Contract: scripts/build.sh, scripts/run.sh, scripts/test-production-artifact.js, and scripts/test-reproducible-build.js.

Files Expected to Change: Deployment files from WP1, scripts/build.sh, scripts/test-production-artifact.js, and focused artifact-closure tests from WP1 only. Do not copy the whole repository scripts/ directory or add production-only npm scripts.

Server Changes after authorization: Reuse and verify the exact academic-writing service identity established by WP3; do not recreate or renumber it. Copy the exact reviewed build artifact contents into /opt/academic-writing-platform/releases/<commit-sha>/app/, copy deploy metadata from the same reviewed commit into /opt/academic-writing-platform/releases/<commit-sha>/deploy/, verify both manifests, point /opt/academic-writing-platform/current to that release directory, and start/reload PM2 with cwd=/opt/academic-writing-platform/current/app. The app artifact must contain server/, dist/, node_modules/, package.json, run.sh, only the three approved scripts under scripts/, and the exact drizzle/migrations tree from the reviewed commit.

Configuration / Env: PM2 starts server/main.js from cwd=/opt/academic-writing-platform/current/app with node_args=--env-file=/etc/academic-writing-platform/production.env. Node 22 reads this file before loading the application; PM2 is not assumed to understand or auto-load env files. The file is outside Git and the artifact, owned by root:academic-writing with mode 640, and readable by academic-writing through its group without being writable by the runtime. Its parent directory is root:root mode 755. The canonical PM2 state is /var/lib/academic-writing-platform/pm2, owned by academic-writing:academic-writing with mode 700; it is outside every release and current symlink. No watch mode, cluster mode, or multiple instances.

Production env loading and rotation contract: Before any production Node or PM2 startup, the hard gate P3_SECURITY_SECRET_ROTATION_REQUIRED=YES is mandatory. The explicit INITIAL_COMPROMISE_ROTATION mode must perform server-side PostgreSQL password changes for the existing roles academic_writing_app and academic_writing_migrator, update candidate DATABASE_URL and MIGRATION_DATABASE_URL credentials, verify both new role connections over verified TLS, rotate ACADEMIC_SEARCH_CURSOR_SECRET and ZOTERO_CREDENTIAL_ENCRYPTION_KEY, and create the initial root:root mode-600 completion marker only after every check succeeds. The operator supplies P3_DB_ADMIN_URL without a password and enters the administrative password through hidden interactive input; no password is accepted as a command-line argument or printed. The helper validates duplicate keys, production config, Node 22 env-file consumption, root:academic-writing ownership, mode 640, and runtime readability without printing values, then atomically replaces /etc/academic-writing-platform/production.env. NORMAL_FUTURE_ROTATION requires the initial marker and changes only the supplied secret classes; changed database URLs trigger real role password rotation, while unchanged database URLs are still connectivity-validated. A changed ZOTERO_CREDENTIAL_ENCRYPTION_KEY requires a successful fail-closed check that zotero_connections has no existing encrypted credentials. The PM2 config contains only the fixed --env-file path and non-secret process settings. A missing/unreadable/malformed env file causes startup/config validation to fail closed. All later env rotations use the same atomic replacement and controlled reload.

PM2 OS boot recovery: Reuse the dedicated academic-writing system user established by WP3 with home /nonexistent and shell /usr/sbin/nologin; never alter passwd metadata or grant the account a writable home. Run deploy/scripts/prepare-pm2-state.sh to establish /var/lib/academic-writing-platform/pm2, then use deploy/scripts/pm2-service-cli.sh for start, startup, save, reload, status, and describe. The wrapper sets PM2_HOME=/var/lib/academic-writing-platform/pm2, HOME=/nonexistent, and the approved system PATH, and refuses all PM2 commands unless the rotation gate and root-only completion marker pass. Run pm2 startup systemd -u academic-writing --hp /var/lib/academic-writing-platform/pm2, execute the exact privileged command emitted by PM2, verify the generated unit contains Environment=PM2_HOME=/var/lib/academic-writing-platform/pm2 (or equivalent evidence), and only then enable pm2-academic-writing.service. The saved PM2 process definition must retain cwd=current/app, script=server/main.js, node_args=--env-file=/etc/academic-writing-platform/production.env, and the single-fork settings. pm2 save is run through the same wrapper after validated startup; it is not the boot-recovery mechanism by itself.

Commands after authorization [C: production host OS + B: production release app]:

    sudo getent passwd academic-writing
    sudo getent group academic-writing
    sudo deploy/scripts/release-install.sh <commit-sha> dist deploy
    sudo node /opt/academic-writing-platform/releases/<commit-sha>/deploy/scripts/release-manifest.js /opt/academic-writing-platform/releases/<commit-sha>
    sudo deploy/scripts/release-activate.sh <commit-sha>
    sudo P3_SECURITY_SECRET_ROTATION_REQUIRED=YES deploy/scripts/rotate-production-env.sh /secure/input/production.env /opt/academic-writing-platform/current/app INITIAL_COMPROMISE_ROTATION
    sudo P3_SECURITY_SECRET_ROTATION_REQUIRED=YES deploy/scripts/verify-production-env.sh /etc/academic-writing-platform/production.env /opt/academic-writing-platform/current/app
    sudo deploy/scripts/prepare-pm2-state.sh
    sudo P3_SECURITY_SECRET_ROTATION_REQUIRED=YES deploy/scripts/pm2-service-cli.sh start /opt/academic-writing-platform/current/deploy/pm2/ecosystem.config.cjs --only academic-writing-platform
    sudo P3_SECURITY_SECRET_ROTATION_REQUIRED=YES deploy/scripts/pm2-service-cli.sh startup systemd -u academic-writing --hp /var/lib/academic-writing-platform/pm2
    # Execute the exact privileged command emitted by PM2, then verify the generated unit.
    sudo systemctl cat pm2-academic-writing.service
    sudo systemctl enable pm2-academic-writing.service
    sudo P3_SECURITY_SECRET_ROTATION_REQUIRED=YES deploy/scripts/pm2-service-cli.sh save
    sudo systemctl is-enabled pm2-academic-writing.service
    sudo systemctl is-enabled postgresql nginx
    sudo systemctl status pm2-academic-writing.service --no-pager
    sudo P3_SECURITY_SECRET_ROTATION_REQUIRED=YES deploy/scripts/pm2-service-cli.sh status
    sudo P3_SECURITY_SECRET_ROTATION_REQUIRED=YES deploy/scripts/pm2-service-cli.sh describe academic-writing-platform

The artifact must be built from the reviewed commit and its app/ and deploy/ manifests hashed before activation. The app manifest must cover runtime files, the three allow-listed DB scripts, and every exact migration file; the deploy manifest must cover same-commit deployment metadata. The canonical release is current/app plus current/deploy; no second dist or deployment layout is authoritative. Do not rebuild with floating production state on the host. Production DB operations use the shipped Node scripts directly; production does not depend on npm scripts, Jest, devDependencies, or the full repository.

Tests Before Change: Full build, node scripts/test-reproducible-build.js, clean-artifact smoke, release manifest test, and PM2 config static test.

Implementation Steps: In A-context, build once and verify node scripts/test-reproducible-build.js plus the production-artifact closure. scripts/build.sh must copy only the three approved DB scripts and exact drizzle/migrations into the app artifact, while retaining the reviewed runtime and pruned package files. On the host, provision the PM2 state directory without touching the WP3 service identity, rotate the four known exposed secret classes through the root-controlled env gate, and validate the candidate env with Node 22 and production config before any production Node or PM2 startup. Hash the exact app artifact and same-commit deploy metadata, copy them into one immutable release, atomically activate current, start one fork through the PM2 wrapper, inspect redacted logs, and send a controlled PM2 reload --update-env through that same wrapper. The manifest must include every regular file below both app/ and deploy/ and must itself be retained with the release evidence. B-context migration/backup/restore commands execute the shipped files directly with Node 22.

Verification: One online fork, PM2_HOME and PM2 state files resolve below /var/lib/academic-writing-platform/pm2, PM2 cwd is current/app, config path is current/deploy/pm2/ecosystem.config.cjs, node_args contains --env-file=/etc/academic-writing-platform/production.env, the env file is root:academic-writing mode 640 and outside the artifact, the rotation marker is root:root mode 600, pm2-academic-writing.service plus PostgreSQL/Nginx are enabled, Node only on 127.0.0.1:3000, live 200, shutdown drain log, reload healthy, unchanged current/storage roots, and the release manifest matches the reviewed app artifact and same-commit deploy metadata. A controlled ECS reboot is required for the P3 acceptance gate; after boot, verify PostgreSQL, Nginx, PM2, Node, /health/live, /health/ready, and persistent DB/file hashes.

Failure Condition: Secret-bearing artifact, multiple forks, public bind, startup failure, crash loop, or unclean shutdown.

Rollback: current/deploy/scripts/rollback.sh <previous-commit-sha> switches current to the previous complete release, reloads PM2 --update-env, and verifies live/ready. It does not reverse migrations or delete documents.

Evidence to Record: Commit SHA, artifact hash, PM2 status/describe, listeners, redacted logs, health responses.

Git Commit Boundary: chore(p3): finalize immutable release lifecycle.

Out-of-Scope Guard: No containers, cluster mode, queue workers, or autoscaling.

### P3-WP7 — Nginx, domain, HTTPS, and network boundary

Goal: Expose only HTTPS reverse proxy and enforce the frozen public/private port boundary.

Existing Accepted Contract: SERVER_HOST binding and P1 CORS, proxy trust, body limits, rate limits, and sanitized logging.

Files Expected to Change: deploy/nginx/academic-writing-platform.conf, deployment runbook, and Nginx static tests.

Server Changes after authorization: Install Nginx, provision certificate/chain, configure 80→443 redirect, proxy to 127.0.0.1:3000, align timeouts/body limits, remove 2222 rule, and deny 3000/5432 in security group/UFW.

Configuration / Env: CORS_ALLOWED_ORIGINS=https://<production-domain>, TRUST_PROXY_HOPS=1 only after topology verification, bounded body/rate limits, and same-origin OIDC redirects.

Commands after authorization [C: host OS / Nginx]:

    sudo apt-get install -y nginx
    sudo nginx -t
    sudo systemctl enable --now nginx
    curl -I http://<production-domain>/
    curl -I https://<production-domain>/
    curl -sS https://<production-domain>/health/live
    sudo ss -ltnp | grep -E ':(80|443|3000|5432)\b'
    sudo journalctl -u nginx --since '10 minutes ago' --no-pager

Tests Before Change: Static Nginx checks, local temporary reverse proxy curl, proxy-trust/CORS tests.

Implementation Steps: Install chain, validate syntax, enable site, test redirect/HTTPS/live, and verify external 3000/5432 are unavailable.

Verification: Valid hostname/chain, redirect, HTTPS live 200, accepted upload/task limits, and no public app/database listener.

Failure Condition: Certificate mismatch, no redirect, exposed private port, wrong CORS, or old 2222 rule.

Rollback: Restore previous Nginx site/certificate, run nginx -t, reload, or stop new site while retaining Node release.

Evidence to Record: nginx -t, certificate inspection, curl headers, listener/security-group checks, and logs.

Git Commit Boundary: chore(p3): add production reverse proxy contract.

Out-of-Scope Guard: No CDN, WAF redesign, or load balancing.

### P3-WP8 — Migration, startup, health, graceful restart, and operations

Goal: Prove the deployed service is observable and fails closed when production prerequisites are invalid.

Existing Accepted Contract: /health/live, /health/ready, authenticated /health/providers, LifecycleModule, db:migrate, db:backup, db:restore:verify, and P1 gates.

Files Expected to Change: Prefer none. Use deploy/scripts/verify-live.sh and deployment tests if a checker is required.

Server Changes: Run migrations before first PM2 start and on each release through a controlled one-at-a-time command. Enable PostgreSQL/Nginx/PM2 recovery on reboot. Rotate logs without request bodies, tokens, prompts, provider responses, or secrets.

Configuration / Env: LOG_REQUEST_BODY=false, LOG_RESPONSE_BODY=false, LOG_DIR=/var/log/academic-writing-platform, production CORS/origin, and the full auth/database/storage/provider manifest.

Commands after authorization [B: production release app / HTTPS]:

    cd /opt/academic-writing-platform/current/app
    node --env-file=/etc/academic-writing-platform/production.env scripts/db-migrate.js
    curl -fsS https://<production-domain>/health/live
    curl -fsS https://<production-domain>/health/ready
    curl -i https://<production-domain>/health/providers

Commands after authorization [C: host OS / PM2 and systemd]:

    sudo P3_SECURITY_SECRET_ROTATION_REQUIRED=YES deploy/scripts/pm2-service-cli.sh reload academic-writing-platform --update-env
    curl -fsS https://<production-domain>/health/ready
    sudo systemctl is-enabled postgresql nginx
    sudo systemctl is-enabled pm2-academic-writing.service
    sudo P3_SECURITY_SECRET_ROTATION_REQUIRED=YES deploy/scripts/pm2-service-cli.sh save
    sudo reboot
    sudo systemctl is-active postgresql nginx pm2-academic-writing.service
    sudo P3_SECURITY_SECRET_ROTATION_REQUIRED=YES deploy/scripts/pm2-service-cli.sh status
    ss -ltnp | grep -E ':(80|443|3000|5432)\b'
    curl -fsS https://<production-domain>/health/live
    curl -fsS https://<production-domain>/health/ready

Tests Before Change: app bootstrap, production config/bootstrap/shutdown, health, database/storage readiness, and all baseline CI jobs.

Implementation Steps: Validate the protected env file and CA mode/path without printing values, migrate with verified Node TLS, start, query live/ready, authenticate to providers health, perform graceful PM2 reload --update-env as academic-writing, inspect sanitized logs, verify enabled systemd units, perform the controlled ECS reboot, and after boot check PostgreSQL, Nginx, PM2, Node, /health/live, /health/ready, and persistent DB/file hashes.

Verification: Live is 200 independently, ready is 200 only with DB/storage, providers requires auth, restart drains cleanly, invalid config exits before serving, PM2 OS boot recovery is enabled, and post-reboot service/data/file checks pass.

Failure Condition: False ready, secret-bearing provider errors, hung shutdown, unsafe TLS, or missing migrations.

Rollback: Stop/restart known-good release; do not mark a release current until migration and health pass. Applied migrations receive forward-compatible fixes only.

Evidence to Record: Migration output, three health responses, PM2 lifecycle, redacted logs, uptime, and rejection tests.

Git Commit Boundary: test(p3): cover deployed lifecycle and health checks, only if new test/scripts are needed.

Out-of-Scope Guard: No durable task recovery, queue, worker, or crash replay.

### P3-WP9 — Real deployed-browser E2E

Goal: Validate real OIDC, Workflow A/B, provider paths, owner isolation, and safe product boundaries against deployed HTTPS.

Existing Accepted Contract: P2 workflows, E1-E6 semantics, client routes in client/src/app.tsx, and owner-scoped authenticated server routes.

Files Expected to Change: playwright.config.ts, test/e2e/p3-production.spec.ts, test/e2e/support/p3-auth.ts, and only necessary data-testid additions in LoginPage, ToolsPage, TasksPage, TaskDetailPage, KnowledgePage, GroundedWritingPage, AcademicSearchPage, and ZoteroPage. Test hooks cannot change product behavior.

Server Changes: None expected. Missing endpoint/ownership behavior is REPORT_ONLY unless separately authorized.

Configuration / Env:

    P3_E2E_BASE_URL=https://<production-domain>
    P3_E2E_USER_A_STORAGE_STATE=<path outside repository>
    P3_E2E_USER_B_STORAGE_STATE=<path outside repository>
    P3_E2E_RUN_DESTRUCTIVE_REBOOT=false

Storage states are created through real OIDC accounts and kept outside Git. If storage-state reuse is prohibited, p3-auth.ts uses a documented operator-assisted login.

Tests Before Change: All server/client tests, artifact smoke, local route smoke, and Playwright config/list tests.

Implementation Steps:

1. E2E-01 anonymous protected route → /login → real OIDC login → callback → authenticated session and refresh restoration.
2. E2E-02 upload/select non-empty PDF/DOCX → Polish or Paper Revision → submit → task/result → copy/export/re-run.
3. E2E-03 upload → Knowledge → explicit Index → indexed → Grounded Writing → E3 retrieval → E6 generation → citations/bibliography/provenance.
4. E2E-04 real Zotero connection → sync/import supported item/attachment → Knowledge → explicit index → Grounded Writing.
5. E2E-05 real OpenAlex search returns normalized metadata.
6. E2E-06 User A attempts User B documents, tasks, Knowledge/index, Zotero, and grounded resources; every cross-owner request is denied or empty according to the accepted route contract.
7. E2E-07 PM2 restart → DB row and document hash survive → health recovers.
8. E2E-08 controlled ECS reboot → PostgreSQL, PM2, Nginx, and application recover; this is required for the P3 acceptance gate.
9. E2E-09 backup rehearsal data → isolated recovery DB → schema/vector/representative data verification without touching live DB.
10. E2E-10 release N+1 → verify → rollback N → verify health, DB data, and document hash.

Verification: Record only request status, stable IDs, owner aliases, timestamps, and artifact hashes. Do not record tokens, credentials, full documents, prompts, or provider secrets.

Failure Condition: Mock login, callback bypass, owner leak, metadata-only upload, unindexed evidence, fabricated citation, persistence loss, live restore, or rollback data loss.

Rollback: Stop failing test, preserve redacted traces, revert release if deployment-related, revoke exposed test credentials, and report the exact failing acceptance item.

Evidence to Record: Playwright report outside repository or sanitized attachment, non-sensitive screenshots, console/network summary, server/Nginx/PM2 excerpts, DB/file hashes, and isolation matrix.

Git Commit Boundary: test(p3): add deployed browser acceptance matrix. This does not claim E2E acceptance until the real host run completes.

Out-of-Scope Guard: No performance benchmark, customer data, unapproved reboot, or secret fixture.

### P3-WP10 — Backup, restore, reboot, rollback, and certificate operations

Goal: Demonstrate recoverability and operational reversal without corrupting live data.

Existing Accepted Contract: scripts/db-backup.js uses custom pg_dump; scripts/db-restore-verify.js requires explicit confirmation and validates vector, 14 tables, and four migrations.

Files Expected to Change: docs/deployment/P3_RUNBOOK.md, deploy/scripts/rollback.sh, and optionally deploy/scripts/backup-rehearsal.sh. Do not weaken restore confirmation.

Server Changes: Configure private backup directory, approved retention, isolated recovery DB, certificate renewal monitoring, and nginx -t before certificate reload.

Configuration / Env: BACKUP_OUTPUT_PATH=/var/backups/academic-writing-platform/<timestamp>.dump, BACKUP_INPUT_PATH=<isolated dump>, isolated recovery DATABASE_URL, and no live --clean restore.

Commands after authorization [C: host OS / PostgreSQL tools]:

    export BACKUP_OUTPUT_PATH=/var/backups/academic-writing-platform/backup-<timestamp>.dump
    export PGSSLMODE=verify-full
    export PGSSLROOTCERT=/etc/academic-writing-platform/postgres-ca.pem
    pg_isready --dbname="$DATABASE_URL"
    createdb --host=<certificate-san-host> --username="$RECOVERY_ADMIN_ROLE" academic_writing_recovery_<run-id>
    psql "$RECOVERY_DATABASE_URL" --sslmode=verify-full --sslrootcert=/etc/academic-writing-platform/postgres-ca.pem -c "SELECT extname FROM pg_extension WHERE extname='vector';"

Commands after authorization [B: production release app]:

    cd /opt/academic-writing-platform/current/app
    BACKUP_OUTPUT_PATH="$BACKUP_OUTPUT_PATH" node --env-file=/etc/academic-writing-platform/production.env scripts/db-backup.js
    DATABASE_URL="$RECOVERY_DATABASE_URL" DATABASE_SSL_CA_FILE=/etc/academic-writing-platform/postgres-ca.pem node --env-file=/etc/academic-writing-platform/production.env scripts/db-migrate.js
    DATABASE_URL="$RECOVERY_DATABASE_URL" BACKUP_INPUT_PATH="$BACKUP_OUTPUT_PATH" DATABASE_SSL_CA_FILE=/etc/academic-writing-platform/postgres-ca.pem node --env-file=/etc/academic-writing-platform/production.env scripts/db-restore-verify.js --confirm-restore

The B-context commands run the exact scripts shipped in the reviewed current/app release. The protected env file and explicit overrides retain PGSSLMODE=verify-full and PGSSLROOTCERT=/etc/academic-writing-platform/postgres-ca.pem for every libpq operation; Node scripts retain DATABASE_SSL_CA_FILE with certificate verification. No production step invokes npm run db:backup, npm run db:migrate, or npm run db:restore:verify.

Tests Before Change: Backup/restore script tests, CI PostgreSQL backup/restore, and release rollback dry-run with two local artifact directories.

Implementation Steps: Capture representative row/file hash, back up, restore only to isolated DB, verify schema/vector/data, perform approved restart/reboot, activate N+1, verify, switch to N, verify, and document certificate renewal.

Verification: Live DB is never overwritten; restored schema/data match; files survive; rollback preserves data; reboot recovers services; renewal serves a valid certificate.

Failure Condition: Live restore target, unreadable backup, failed vector/schema verification, unexpected hash change, rollback data change, or reboot outage.

Rollback: Drop only isolated recovery DB; switch current to last good release; restore prior Nginx config/certificate after nginx -t; retain evidence.

Evidence to Record: Backup hash/size, isolated DB name, restore output, row/file hashes, reboot timeline, symlink history, and certificate expiry/renewal.

Git Commit Boundary: docs(p3): record recovery and rollback runbook.

Out-of-Scope Guard: No enterprise DR, remote backup product, replication, HA, or live destructive restore.

## 6. Exact Expected Code/File Changes

### Expected new files

    deploy/pm2/ecosystem.config.cjs
    deploy/nginx/academic-writing-platform.conf
    deploy/scripts/host-preflight.sh
    deploy/scripts/release-install.sh
    deploy/scripts/release-activate.sh
    deploy/scripts/verify-live.sh
    deploy/scripts/rollback.sh
    deploy/scripts/prepare-storage.sh
    deploy/scripts/verify-storage.sh
    deploy/scripts/prepare-pm2-state.sh
    deploy/scripts/pm2-service-cli.sh
    deploy/scripts/verify-production-env.sh
    deploy/scripts/rotate-production-env.sh
    deploy/scripts/rotation-contract.js
    deploy/scripts/rotate-postgres-roles.js
    deploy/scripts/release-manifest.js
    docs/deployment/P3_RUNBOOK.md
    docs/deployment/P3_ENVIRONMENT_MANIFEST.md
    docs/deployment/P3_ACCEPTANCE_EVIDENCE.md
    client/src/auth/standalone-oidc.ts
    server/config/standalone-oidc-client.ts
    server/config/standalone-oidc-client.spec.ts
    server/modules/runtime-config/runtime-config.module.ts
    server/modules/runtime-config/runtime-config.controller.ts
    server/modules/runtime-config/runtime-config.service.ts
    server/modules/runtime-config/runtime-config.spec.ts
    test/unit/standalone-oidc-client.spec.ts
    test/unit/runtime-oidc-config.spec.ts
    playwright.config.ts
    test/e2e/p3-production.spec.ts
    test/e2e/support/p3-auth.ts

### Expected modified files

    scripts/build.sh
    scripts/test-production-artifact.js
    package.json
    package-lock.json
    client/src/auth/session.types.ts
    client/src/auth/session-provider.ts
    client/src/auth/AppAuthProvider.tsx
    client/src/auth/RequireAuth.tsx
    client/src/pages/Login/LoginPage.tsx
    client/src/app.tsx
    server/database/standard-postgres.module.ts
    scripts/db-migrate.js
    server/config/production-config.ts
    server/config/config-validation.ts
    .env.example

The database/config files are conditional. They change only if the audit proves the current DATABASE_SSL_CA content contract cannot safely consume the trusted CA; the approved compatibility path is DATABASE_SSL_CA_FILE read by both server/database/standard-postgres.module.ts and scripts/db-migrate.js. Existing production rejection rules must remain tests and must not be relaxed.

### Expected test rule

Every code change gets a targeted test before implementation, then relevant accepted regressions. New tests do not call real external providers unless explicitly environment-guarded and run in an authorized deployment stage.

## 7. Server Deployment Plan

Command context legend: [A] means implementation worktree or CI; [B] means the exact production release app at /opt/academic-writing-platform/current/app; [C] means production host OS or PostgreSQL administrative tooling. Production ECS operations do not require the full repository, Jest, devDependencies, or unapproved scripts.

1. Revalidate host and public/private port boundary.
2. Install only approved runtime packages: Node 22/npm 10, PostgreSQL 16/pgvector, Nginx, PM2, and certificate/time utilities.
3. Create service user, release root, private storage root, log root, and backup root with explicit owners/modes.
4. Provision PostgreSQL roles/database/vector/TLS/private listener.
5. Provision protected env file and validate it without printing values.
6. Run ordered migrations and verify schema/vector/readiness.
7. [A] Build and hash the exact artifact from the authorized commit. The build closure includes server/, dist/, node_modules/, package.json, run.sh, only scripts/db-migrate.js, scripts/db-backup.js, scripts/db-restore-verify.js, and exact drizzle/migrations from that commit. Copy this artifact to releases/<commit-sha>/app/, copy same-commit deploy metadata to releases/<commit-sha>/deploy/, and record one release manifest/hash evidence covering both trees.
8. [C/B] Activate current -> releases/<commit-sha>, start PM2 single fork with cwd=current/app, script=server/main.js, and node_args=--env-file=/etc/academic-writing-platform/production.env. Run production migrations, backup, and restore verification from the shipped B-context Node scripts, not npm scripts.
9. Install/test Nginx and public HTTPS.
10. Enable PM2 systemd startup for the academic-writing service user, run pm2 save, and verify PostgreSQL/Nginx/PM2 boot units.
11. Execute provider health and real OIDC validation.
12. Execute Playwright E2E and recovery rehearsal including the controlled ECS reboot.
13. Record evidence and stop for ChatGPT review; do not self-declare acceptance.

## 8. Environment / Secret Manifest

### Runtime and security

    NODE_ENV=production
    RUNTIME_PROFILE=standalone
    SERVER_HOST=127.0.0.1
    SERVER_PORT=3000
    BODY_SIZE_LIMIT=1mb
    CORS_ALLOWED_ORIGINS=https://<production-domain>
    TRUST_PROXY_HOPS=1
    RATE_LIMIT_WINDOW_MS=60000
    RATE_LIMIT_MAX_REQUESTS=120
    RATE_LIMIT_EXPENSIVE_MAX_REQUESTS=30
    LOG_DIR=/var/log/academic-writing-platform
    LOG_REQUEST_BODY=false
    LOG_RESPONSE_BODY=false
    DOCUMENT_STORAGE_DRIVER=filesystem
    DOCUMENT_STORAGE_ROOT=/var/lib/academic-writing-platform/documents
    DATABASE_SSL_CA_FILE=/etc/academic-writing-platform/postgres-ca.pem
    PGSSLMODE=verify-full
    PGSSLROOTCERT=/etc/academic-writing-platform/postgres-ca.pem

### Auth, database, and providers

Use the exact variables listed in WP2, WP4, and WP5. The protected env file is root:academic-writing mode 640, with a root:root mode-755 parent, excluded from release archives, and never used as frontend build input. The runtime can read but cannot replace it. OIDC client ID, redirect URIs, and issuer are public configuration; API keys, DB passwords, cursor secrets, encryption keys, and any provider client secret are confidential. The first production startup requires P3_SECURITY_SECRET_ROTATION_REQUIRED=YES and the root-only rotation completion marker; no secret value is printed or recorded.

The Node runtime and migration process use DATABASE_SSL_CA_FILE (or accepted DATABASE_SSL_CA content) with rejectUnauthorized=true. The libpq tools used by db-backup.js and db-restore-verify.js use PGSSLMODE=verify-full and PGSSLROOTCERT pointing at the trusted CA file. The database hostname in DATABASE_URL and MIGRATION_DATABASE_URL must match the PostgreSQL certificate SAN. PGSSLMODE=require, DATABASE_SSL=require, or any equivalent that does not verify the certificate is not an acceptance configuration.

### Provisioning rules

- Generate secrets with an approved secret generator; never use fixture values.
- Validate presence, HTTPS, lengths, dimensions, key bytes, issuer/audience/JWKS compatibility, and redirect allow-lists before PM2 start.
- Rotate credentials by replacing the protected env file and controlled PM2 reload; record key version/fingerprint, never key content.
- Scan release, logs, screenshots, Playwright artifacts, and Git diff for sentinel values and secret patterns.

## 9. Database / Storage Plan

The live database is PostgreSQL 16 with pgvector and four ordered Drizzle migrations. Runtime and migration pools use TLS with certificate verification via DATABASE_SSL_CA_FILE or accepted DATABASE_SSL_CA content and rejectUnauthorized=true. pg_dump, pg_restore, and psql use PGSSLMODE=verify-full and PGSSLROOTCERT=/etc/academic-writing-platform/postgres-ca.pem; sslmode=require alone is not sufficient. The application role is runtime-only; migrations use the separately approved migration role. The private filesystem root is /var/lib/academic-writing-platform/documents, not a release directory and not current/app/dist/client.

The first production index records the approved E2 model identity and profile/index fingerprints. A restored index is usable only when provider/model/revision/dimension/profile fingerprints match the active embedding configuration. If they do not match, stop and report incompatibility; do not silently re-embed or mutate E2 semantics.

## 10. OIDC Authentication Plan

    anonymous protected route
      -> /login?returnTo=/safe/path
      -> oidc-client-ts signinRedirect()
      -> provider Authorization Code + PKCE
      -> /auth/callback?code=...&state=...
      -> signinCallback() validates state/nonce and exchanges code
      -> StandaloneAuthAdapter exposes session/access token
      -> existing configureHttpAuth sends Bearer token
      -> existing StandaloneAuthGuard + JWKS verifier validates
      -> owner-scoped API resources

The browser adapter manages the OIDC session but does not authorize from local JWT claims. The server remains authoritative for identity, issuer, audience, signature, expiry, user claim, ownership, and permissions. Callback errors are sanitized and never echo the code/token.

## 11. Provider Activation Plan

Run providers in this order: embedding identity/health, database index compatibility, DeepSeek health/minimal generation, OpenAlex search, Zotero introspection/sync/import. This prevents Knowledge rows from being created with an unapproved embedding fingerprint.

Health evidence distinguishes configured from reachable. reachable=true requires a real bounded request. Failed providers produce safe errors and are never represented as successful business output.

## 12. Browser E2E Matrix

| ID | Scenario | Required real state | Pass evidence |
|---|---|---|---|
| E2E-01 | OIDC login/session | Real provider and two test identities | Callback, protected request, refresh restoration, logout |
| E2E-02 | Workflow A | Auth, real upload, task/result | Polish/Paper Revision, copy/export/re-run, owner task |
| E2E-03 | Workflow B upload | Auth, PostgreSQL, embedding, DeepSeek | Explicit index, grounded result, citations/bibliography/provenance |
| E2E-04 | Workflow B Zotero | Real Zotero account/key and attachment | Sync/import/index/grounded flow |
| E2E-05 | Academic Search | Real OpenAlex HTTPS | Normalized real result and safe pagination |
| E2E-06 | Owner isolation | User A and User B | No cross-owner resource access |
| E2E-07 | PM2 restart | Existing DB/file data | Health recovers; hashes unchanged |
| E2E-08 | ECS reboot | Approved maintenance window | PostgreSQL/PM2/Nginx/app recover |
| E2E-09 | Backup/restore | Isolated recovery DB | Vector, migrations, tables, representative data |
| E2E-10 | Release rollback | Release N and N+1 | N+1 healthy, N healthy after rollback, data preserved |

## 13. Backup / Restore / Restart / Rollback Plan

- Backup: custom-format pg_dump to private timestamped storage, with hash and size recorded.
- Restore: isolated recovery database only; --confirm-restore required; run existing verification and representative queries.
- Restart: PM2 graceful restart, then health and DB/file hash checks.
- Reboot: controlled ECS reboot after operator approval; verify PM2 systemd startup, systemd-enabled PostgreSQL/Nginx, and PM2 resurrection. If the reboot is not executed, P3 is not a Review Candidate and the omission must not be counted as a pass.
- Rollback: preserve N, activate N+1, verify, switch current back to N, reload PM2, rerun health and persistence. Never reverse migrations or remove persistent files.
- TLS renewal: renew out of band, run nginx -t, reload, verify hostname/chain/expiry, and retain prior certificate until verification.

## 14. Test & CI Matrix

### Pre-implementation regression [A: implementation worktree / CI]

    npm ci
    npm test -- --runInBand
    npm run test:integration:postgres
    npm run test:app-bootstrap
    npm run lint
    npm run type:check
    npm run build:server
    npm run build:client
    node scripts/test-reproducible-build.js
    npm run build
    node scripts/test-production-artifact.js

### Targeted P3 tests [A: implementation worktree / CI, except explicitly authorized deployed E2E]

    npx jest test/unit/production-config.spec.ts test/unit/production-bootstrap.spec.ts test/unit/graceful-shutdown.spec.ts --runInBand
    npx jest server/auth server/config server/database server/modules/health --runInBand
    npx jest test/unit/standalone-oidc-client.spec.ts test/unit/runtime-oidc-config.spec.ts test/unit/auth-session-client.spec.ts --runInBand
    npx playwright test --config=playwright.config.ts --list
    npx playwright test --config=playwright.config.ts test/e2e/p3-production.spec.ts

### Review Candidate gates

- Targeted tests and full regression pass.
- Type-check, lint, builds, artifact smoke, bootstrap, PostgreSQL/pgvector schema, migration idempotency, backup/restore verification pass.
- Deployment config tests pass.
- Real deployed E2E has no skipped required case. The controlled ECS reboot, PM2 systemd recovery, and post-reboot DB/file hash checks are required; if not executed, P3 is not a Review Candidate and the omission cannot count as pass.
- No secret, semantic drift, or out-of-scope infrastructure appears in git diff.

## 15. Git / PR / Review Checkpoints

After IMPLEMENTATION_AUTHORIZED only:

    accepted main
    -> phase/p3-deployment-e2e
    -> TDD implementation by WP
    -> targeted tests
    -> full regression/build/production gates
    -> reviewable commits
    -> verify origin and http.version=HTTP/1.1
    -> push Phase branch
    -> create PR
    -> ChatGPT Review
    -> FIX_REQUIRED or REVIEW_PASS
    -> Final Acceptance decision
    -> explicit PHASE_P3_ACCEPTED
    -> merge main
    -> post-merge closeout
    -> final main CI
    -> annotated phase-p3-accepted
    -> verify tag target
    -> P3_ACCEPTED_CLOSED

Before every push:

    git status --short
    git branch --show-current
    git remote -v
    git config --local --get http.version

The branch must be P3, origin must be the fixed repository, http.version must be HTTP/1.1, and force push is forbidden. REVIEW_PASS is not ACCEPTED; ACCEPTED is not ACCEPTED_CLOSED.

## 16. Risks

- OIDC provider mismatch: verify metadata and a real token through the existing verifier; do not weaken server checks.
- Browser config error: public-only runtime config, static secret scan, callback tests, and no client secret.
- Embedding incompatibility: approve identity before indexing and reject mismatches.
- PostgreSQL TLS on same host: use trusted CA and correct hostname/SAN; fail closed.
- Artifact/runtime drift: clean-artifact smoke before activation and PM2/live check.
- Nginx upload/timeouts: align proxy body/timeouts with accepted body limit and real upload.
- Disk exhaustion: readiness, restrictive roots, and operator-approved log/backup retention.
- Provider quota/billing: bounded calls, test accounts, explicit approval, no load testing.
- Rollback/schema coupling: additive forward-compatible migrations only.
- Governance drift: use accepted tag/final CI evidence and report drift; do not silently rewrite history.

## 17. Blocking Operator Inputs

Implementation remains paused until these are supplied or explicitly approved:

1. Production domain and DNS plan.
2. OIDC provider, client, issuer, audience, JWKS, claim, algorithms, callback, and logout redirect.
3. Embedding provider/base URL, model, revision, and dimensions.
4. PostgreSQL database/roles, password provisioning, CA/server certificate plan, and backup destination/retention.
5. Secret provisioning method for DeepSeek, embedding, OpenAlex cursor, Zotero key, and optional provider key.
6. Two non-production test identities and Playwright authentication/storage-state procedure.
7. Approval to install oidc-client-ts, @playwright/test, PM2, Nginx, PostgreSQL 16, pgvector, and Chromium dependencies at authorized stages.
8. Approval window for the required controlled ECS reboot and real provider calls.

Missing values are decision gates, not defaults to invent or secrets to commit.

## 18. Explicit Out-of-Scope

Redis, BullMQ, durable queue, workers, automatic crash replay, object storage/OSS/S3, distributed rate limiting, multi-node, Kubernetes, HA PostgreSQL, advanced APM, enterprise DR, real payment, large-scale performance testing, new AI algorithms, E7/E8, provider replacement, new retrieval/citation semantics, and unrelated refactors are excluded. If any becomes a true blocker, record REPORT_ONLY with options and stop for Controller decision.

## 19. Proposed Implementation Authorization Boundary

Implementation may begin only when all conditions are explicit:

- ChatGPT records P3_PLAN_REVIEW=P3_PLAN_REVIEW_PASS.
- Domain/provider/embedding/database/TLS/operator inputs are resolved or explicitly approved as assumptions.
- ChatGPT records IMPLEMENTATION_AUTHORIZED.
- Codex creates a new P3 Phase branch from accepted main; no work starts on main.
- The first implementation commit is limited to the authorized WP and includes failing tests before behavior changes.

This document is a plan artifact and does not authorize host mutation, secret provisioning, source implementation, branch creation, commit, push, PR, merge, or tag creation.

    P3_PLAN_READY_FOR_REVIEW=YES

    P3_IMPLEMENTATION_STARTED=NO
    SERVER_MUTATION_PERFORMED=NO
    CODE_MUTATION_PERFORMED=NO
    BRANCH_CREATED=NO
    COMMIT_CREATED=NO
    PUSH_PERFORMED=NO
    PR_CREATED=NO

    IMPLEMENTATION_AUTHORIZED=NO
