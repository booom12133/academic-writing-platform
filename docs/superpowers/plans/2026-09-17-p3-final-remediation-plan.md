# P3 Final Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Implementation remains forbidden until the ChatGPT Controller records `IMPLEMENTATION_AUTHORIZED`. That authorization ends at the non-production review candidate; it does not authorize deployment or any production operation.

**Goal:** Close the six P3 final-remediation deltas with one cohesive, test-first change set while preserving accepted P3 capabilities, forward-only migrations, owner isolation, and the explicit production-operation gates.

**Architecture:** Keep the accepted upload → C1 parse → C2 context → C3 chunks → E1 version → E2 index → E3/E6 grounded-writing path and add only the missing integration and operational boundaries. Separate the PostgreSQL runtime, migration, and backup identities; make restore provably isolated; serve ACME HTTP-01 tokens from a dedicated webroot; compose Academic Search import beside (not inside) the frozen discovery service; and make release rollback fail closed until backup, isolated restore, and explicit authorization evidence are present.

**Tech Stack:** Node.js 22, TypeScript, NestJS, React/Vite, Jest, Playwright, PostgreSQL 16/pgvector, Drizzle, `pdfjs-dist` 3.11.174, Nginx, Certbot webroot, PM2/systemd.

**Spec:** Controller request “P3 Final Remediation 1–6”; `docs/plans/PHASE_P3_IMPLEMENTATION_PLAN.md`; `docs/deployment/P3_RUNBOOK.md`; `docs/deployment/P3_ACCEPTANCE_EVIDENCE.md`; accepted P2 contracts in `docs/reviews/PHASE_P2_FINAL_ACCEPTANCE_REPORT.md`.

## Global Constraints

- Work only on `phase/p3-deployment-e2e`; do not merge, tag, reboot, migrate production, run production rollback, or mutate production before the applicable Controller/operator gate.
- `IMPLEMENTATION_AUTHORIZED` permits only code/document changes in this plan, TDD, local/integration tests, CI, and updating PR #16. It does not permit production deployment, production environment/role changes, production backup/restore, Certbot/Nginx operations, or production E2E.
- After implementation and all non-production verification, stop and report exactly `P3_REMEDIATION_CODE_READY_FOR_CONTROLLER_REVIEW`. Production deployment/revalidation requires a later, explicit Controller instruction naming the permitted manual operations.
- A later production-revalidation instruction still does not authorize real rollback. Real rollback additionally requires the separate exact authorization `PRODUCTION_ROLLBACK_AUTHORIZED` plus matching backup and isolated-restore evidence.
- Baseline identity is `a560bf4521c45848d4b7af4fe76c2c6e0b582be6`, verified as both local HEAD and `origin/phase/p3-deployment-e2e`/PR #16 head on 2026-09-17.
- Preserve the existing OpenAlex search behavior; only add an import composition path.
- Preserve the Zotero backend and `/zotero` route. Zotero OAuth remains deferred optional work.
- Do not create, edit, reorder, or rerun Drizzle migrations. No file below `drizzle/migrations/` changes in this remediation.
- Import never implies indexing. Only an active, explicitly indexed document version can become grounded evidence.
- Metadata and abstracts remain bibliographic metadata. They must never be written as a document body, chunked, indexed, or presented as full-text evidence.
- Production backup uses a dedicated read-only database role and connection. The runtime application role must not gain backup-only privileges.
- Restore accepts only an isolated recovery database and must reject the live database before invoking `pg_restore`.
- Rollback changes only the release pointer and application process. It never reverses or reruns a database migration.
- `PRODUCTION_ROLLBACK_AUTHORIZED=YES` is necessary but not sufficient: a matching backup receipt and isolated-restore receipt are also mandatory.
- Secrets remain outside Git, command output, test fixtures, screenshots, Playwright artifacts, and evidence files.
- Existing user changes in `AGENTS.md` and existing untracked P3 audit/plan files are preserved.

---

## Delta Audit Summary

### Verified repository and GitHub state

- Local branch: `phase/p3-deployment-e2e`.
- Local HEAD: `a560bf4521c45848d4b7af4fe76c2c6e0b582be6`.
- Remote branch head: the same SHA.
- PR #16: OPEN, non-draft, mergeable, head `a560bf...`, with current `verify`, `postgres-schema`, `wp6-step5b`, `nginx-upload-boundary`, and `production-gates` checks successful.
- Repository-local `http.version`: `HTTP/1.1`.
- `PROJECT_STATE.md` and `ROADMAP.md` still describe P3 as not started/not authorized. This conflicts with the current GitHub branch/PR and must be corrected only as governance state (`IN_PROGRESS / FINAL REMEDIATION REVIEW`), never as accepted state.

### Existing test evidence

The following current suites passed without code changes: 15 suites / 95 tests covering PDF parser basics, document-input mapping, backup/restore wrapper mocks, grant-source static checks, deployment contract, Academic Search, Knowledge Product, and Zotero client behavior.

That PASS is not evidence for the six remediation items:

- the only selectable-text PDF fixture is 1,021 bytes;
- `db-backup-restore.spec.ts` mocks the PostgreSQL tools and never exercises role privileges;
- current CI backs up and restores with an administrative `DATABASE_URL`, into the same CI database;
- Nginx tests do not request `/.well-known/acme-challenge/*`;
- Academic Search has no import endpoint or UI action;
- E2E-10 only opens `/health/live` and does not prove or guard rollback.

### Classification and root-cause status

| Item | Classification | Evidence / root cause status |
|---|---|---|
| 1. Real textual PDF upload | **Blocking** | `requires regression reproduction`. The production error is collapsed to `INVALID_DOCUMENT_UPLOAD`; the exact PDF.js exception is not stored in the repository. Existing fixture coverage is not representative. |
| 2. Database backup + isolated restore | **Blocking** | Confirmed. `db-backup.js` reads `DATABASE_URL`; production `DATABASE_URL` is the `academic_writing_app` role. Grants give that role no sequence access in schema `drizzle`, while `pg_dump` reads `drizzle.__drizzle_migrations_id_seq`. Restore also lacks a live-vs-isolated target guard. |
| 3. Certbot renewal | **Blocking** | Confirmed configuration gap: the port-80 server returns a blanket HTTPS redirect and neither server block serves an ACME webroot. The complete cause of the live `unauthorized` response still requires post-change DNS/path validation. |
| 4. Academic Search import | **Product UX remediation — required for P3 acceptance** | Confirmed. Search results expose links only; there is no import API, persistence orchestration, metadata-only workspace projection, or upload prompt. Search itself remains PASS and out of re-review scope. This is mandatory for final P3 acceptance but is not a dependency of the backup/restore or ACME safety remediations. |
| 5. Zotero positioning | **Product UX remediation** | Confirmed. Zotero is a first-level desktop/mobile navigation item and has no “Optional Advanced Integration” positioning. Backend behavior is not a blocker and remains unchanged. |
| 6. E2E-10 rollback | **Blocking safety gate** | Confirmed. `rollback.sh` verifies release integrity but has no explicit authorization or backup/restore evidence gate; the Playwright item is only a placeholder. Actual production rollback remains prohibited. |
| Zotero OAuth | **Deferred optional** | No implementation in this delta. |
| Production rollback execution | **Deferred pending separate authorization** | Not part of implementation or ordinary revalidation. It may occur only after Controller review and a separate user authorization containing `PRODUCTION_ROLLBACK_AUTHORIZED`. |

## File Topology

The remediation is one PR delta with six reviewable tasks. No database migration is added.

### New files

- `server/modules/document-parsing/__fixtures__/academic-textual-realworld.pdf` — sanitized/minimized reproduction of the failing selectable-text PDF.
- `server/modules/document-parsing/__fixtures__/README.md` — fixture provenance, license/privacy disposition, SHA-256, size, and why it reproduces the failure without including private content.
- `test/integration/p3-real-pdf-knowledge-pipeline.integration.spec.ts` — real fixture through parse/import/index/retrieval seams.
- `test/integration/p3-backup-restore.integration.spec.ts` — real PostgreSQL backup-role and isolated-restore regression.
- `deploy/scripts/rollback-preflight.js` — validates authorization and matching recovery receipts without printing secrets.
- `deploy/scripts/prepare-acme-webroot.sh` — idempotently creates/verifies the dedicated ACME webroot.
- `test/integration/p3-acme-webroot.integration.spec.ts` — disposable-Nginx challenge/redirect regression.
- `server/modules/academic-search/openalex-import.gateway.ts` — authoritative work resolution and bounded safe PDF retrieval, with no persistence dependency.
- `server/modules/academic-search/openalex-import.gateway.spec.ts` — resolution, redirects, SSRF, size, MIME/signature, and timeout tests.
- `server/modules/academic-search-import/academic-search-import.module.ts`
- `server/modules/academic-search-import/academic-search-import.controller.ts`
- `server/modules/academic-search-import/academic-search-import.service.ts`
- `server/modules/academic-search-import/academic-search-import.errors.ts`
- `server/modules/academic-search-import/academic-search-import.exception-filter.ts`
- `server/modules/academic-search-import/openalex-source.mapper.ts`
- `server/modules/academic-search-import/academic-search-import.controller.spec.ts`
- `server/modules/academic-search-import/academic-search-import.service.spec.ts`
- `server/modules/academic-search-import/academic-search-import.exception-filter.spec.ts`
- `server/modules/academic-search-import/openalex-source.mapper.spec.ts`
- `test/unit/academic-search-import.http.integration.spec.ts`
- `client/src/pages/Profile/pages/Integrations.tsx` — optional third-party integrations entry containing Zotero.
- `test/unit/zotero-product-positioning.spec.ts` — navigation/positioning regression.

### Principal modified files

- PDF/pipeline: `server/modules/document-parsing/parsers/pdf.parser.ts` only if reproduction identifies its root cause; parser/document-input/knowledge tests listed below.
- Database/recovery: `scripts/db-backup.js`, `scripts/db-restore-verify.js`, `deploy/postgres/production-role-grants.sql`, rotation/env scripts, PostgreSQL fixtures/tests, CI, runbook/evidence.
- ACME: `deploy/nginx/academic-writing-platform.conf`, Nginx tests/CI, runbook/evidence.
- Search import/workspace: existing Academic Search client/module files only for additive resolution/import wiring; Knowledge repository/product projections; shared interfaces; Search and Knowledge pages; `server/app.module.ts`.
- Zotero UX: `client/src/components/Navbar.tsx`, Profile files, and copy in `client/src/pages/Zotero/ZoteroPage.tsx`.
- Rollback: `deploy/scripts/rollback.sh`, P3 E2E contract, deployment tests, runbook/evidence.
- Governance: `PROJECT_STATE.md` and `ROADMAP.md` at Review Candidate only, recording P3 as in review rather than accepted.

---

## Task 1: Reproduce and Fix the Real Textual PDF Path

**Classification:** Blocking.

**Confirmed evidence:** The HTTP 400 is produced by `DocumentInputService.mapParseError()`, which maps most parser errors to `INVALID_DOCUMENT_UPLOAD`. The repository cannot currently distinguish whether failure occurs in PDF.js loading, page text extraction, normalization, storage, Knowledge import, or a later step. The existing PDF fixture is 1,021 bytes and cannot reproduce a ~600 KB academic PDF.

**Root cause:** `requires regression reproduction`. Do not prescribe CMap, font, MIME, size, encryption, or scanning fixes until the exact fixture and nested exception identify the failing boundary.

**Files:**

- Create: `server/modules/document-parsing/__fixtures__/academic-textual-realworld.pdf`
- Create: `server/modules/document-parsing/__fixtures__/README.md`
- Create: `test/integration/p3-real-pdf-knowledge-pipeline.integration.spec.ts`
- Modify: `server/modules/document-parsing/parsers/pdf.parser.spec.ts`
- Modify only if the direct parser regression fails: `server/modules/document-parsing/parsers/pdf.parser.ts`
- Modify only if the failure is above the parser: the single identified boundary among `document-parser.service.ts`, `document-input.service.ts`, storage adapter, or Knowledge import; do not change multiple layers speculatively.
- Modify: `test/e2e/p3-production.spec.ts` to make E2E-03 use a real PDF and prove downstream states.
- Update evidence only after runtime verification: `docs/deployment/P3_ACCEPTANCE_EVIDENCE.md`

**Interfaces:**

- Preserve `PdfParser.parse(input: ValidatedDocumentInput): Promise<ParsedDocumentDraft>`.
- Preserve the public `DocumentInputError` HTTP contract; production responses remain sanitized.
- Preserve `DocumentInputRef`, parser profile `c1-document-parser-v1`, chunking semantics, version immutability, and explicit indexing.
- The fixture test must assert selectable text, page count/provenance, non-empty blocks, and deterministic normalized content. It must not assert a full copyrighted article body.

- [ ] **Step 1: Capture a safe regression fixture.**

  Copy the exact failing PDF into a private staging location, record its SHA-256 and parser exception locally, then minimize or redact it while preserving the failure. Commit only the safe fixture plus `README.md` containing source/license/privacy disposition, byte size, SHA-256, selectable-text check, and the fact that no credentials or user identifiers are present. If a safe redistributable fixture cannot be produced, stop and request a Controller-approved private-fixture test mechanism; do not substitute another PDF and claim reproduction.

- [ ] **Step 2: Write the direct failing parser test before changing production code.**

```ts
it('parses the real-world selectable-text academic PDF deterministically', async () => {
  const buffer = await readFile(fixture('academic-textual-realworld.pdf'));
  const draft = await new PdfParser().parse({
    buffer,
    fileName: 'academic-textual-realworld.pdf',
    mimeType: 'application/pdf',
    extension: '.pdf',
    sourceType: 'pdf',
    sizeBytes: buffer.length,
  });
  expect(draft.metadata.pageCount).toBeGreaterThan(0);
  expect(draft.blocks.some((block) => block.text.trim().length > 0)).toBe(true);
});
```

- [ ] **Step 3: Run only the direct parser test and record the exact nested exception.**

Run:

```powershell
npx jest server/modules/document-parsing/parsers/pdf.parser.spec.ts --runInBand
```

Expected: FAIL on the new fixture. Record the exception class/name and the failing PDF.js operation in the implementation evidence. Do not copy document text into logs.

- [ ] **Step 4: Trace the same fixture through successively wider boundaries.**

  Run the fixture through `PdfParser`, `DocumentParserService`, `DocumentInputService.upload()` with the real filesystem adapter, `KnowledgeService.importDocument()`, and the PostgreSQL/fake-embedding indexing seam. Stop at the first failing boundary. A lower layer that passes must remain unchanged.

- [ ] **Step 5: Implement one root-cause fix.**

  Change only the first failing component. If PDF.js requires an additional packaged runtime asset or option, resolve it from the installed `pdfjs-dist` package exactly as `standardFontDataUrl` is resolved and test the production build artifact. If the parser succeeds and another boundary fails, leave `pdf.parser.ts` untouched and correct that boundary only. Do not add OCR, increase size limits, relax signature/MIME checks, or swallow parser errors.

- [ ] **Step 6: Add the end-to-end regression.**

  `p3-real-pdf-knowledge-pipeline.integration.spec.ts` must prove, with a disposable filesystem root, owner-scoped PostgreSQL fixture, and fake embedding provider:

```text
fixture upload
→ ParsedDocument has selectable text
→ stored DocumentInputRef hash/size match
→ KnowledgeDocumentVersion is active
→ chunks are non-empty and retain page/source provenance
→ explicit index reaches indexed
→ retrieval returns an EvidenceItem bound to that version
```

  The E6 unit/integration suite remains the proof that an `EvidenceSet` becomes structurally bound claims/citations; production E2E-03 supplies the final real-provider grounded-writing proof.

- [ ] **Step 7: Run targeted tests.**

```powershell
npx jest server/modules/document-parsing server/modules/document-input server/modules/knowledge test/integration/p3-real-pdf-knowledge-pipeline.integration.spec.ts --runInBand
```

**Later manual production re-validation (not authorized by `IMPLEMENTATION_AUTHORIZED`):** After separate Controller authorization, upload the same approved regression PDF through the browser; record only file hash/size and status transitions. Verify document descriptor → active version → non-zero chunks → explicit `indexed` → selectable in Grounded Writing → one grounded response with evidence trace to the PDF version. Repeat a DOCX production smoke only if the implemented fix changes shared `DocumentInputService`, `DocumentParserService`, storage, or common parser dispatch behavior; a fix confined to `pdf.parser.ts` or PDF-only runtime assets does not reopen the accepted DOCX workflow. Do not log extracted paper text.

**Rollback/recovery:** This task adds no schema or migration. Reverting the parser/release restores prior behavior; stored originals remain outside releases. If the fix changes runtime asset packaging, rollback requires the previous complete release artifact and does not touch documents or database state.

---

## Task 2: Separate Backup Privilege, Enforce Isolated Restore, and Gate Rollback

**Classification:** Blocking (items 2 and 6 are one recovery boundary).

**Confirmed root cause:** `db-backup.js` reads `DATABASE_URL`, while production defines that URL as `academic_writing_app`. The canonical grants give app access to public sequences and drizzle tables, but not drizzle sequences. `pg_dump` therefore fails on `drizzle.__drizzle_migrations_id_seq`. Granting backup privileges to the runtime role would blur the accepted runtime/operational boundary.

**Additional confirmed safety gaps:** `db-restore-verify.js` uses `DATABASE_URL` as the restore target and invokes `pg_restore --clean`; it does not compare the target with the live database. `rollback.sh` requires neither recovery receipts nor `PRODUCTION_ROLLBACK_AUTHORIZED=YES`.

**Files:**

- Modify: `deploy/postgres/production-role-grants.sql`
- Modify: `scripts/db-backup.js`
- Modify: `scripts/db-restore-verify.js`
- Create: `deploy/scripts/rollback-preflight.js`
- Modify: `deploy/scripts/rollback.sh`
- Modify: `deploy/scripts/rotation-contract.js`
- Modify: `deploy/scripts/rotate-postgres-roles.js`
- Modify: `deploy/scripts/rotate-production-env.sh`
- Modify: `deploy/scripts/verify-production-env.sh`
- Modify: `.env.example`
- Modify: `docs/deployment/P3_ENVIRONMENT_MANIFEST.md`
- Modify: `docs/deployment/P3_RUNBOOK.md`
- Modify: `docs/deployment/P3_ACCEPTANCE_EVIDENCE.md`
- Modify: `docs/operations/database-backup-restore.md`
- Modify: `test/support/p3-postgres-role-fixture.ts`
- Modify: `test/unit/db-backup-restore.spec.ts`
- Modify: `test/unit/postgres-role-grants.spec.ts`
- Modify: `test/unit/p3-wp6-security-contract.spec.ts`
- Modify: `test/unit/p3-deployment-contract.spec.ts`
- Modify: `test/unit/p3-release-integrity.spec.ts`
- Create: `test/integration/p3-backup-restore.integration.spec.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `test/unit/p3-ci-gates.spec.ts`
- Modify: `test/e2e/p3-production.spec.ts`
- Do not modify: `drizzle/migrations/**`

**Interfaces / contracts:**

```text
DATABASE_URL           -> academic_writing_app       (runtime only)
MIGRATION_DATABASE_URL -> academic_writing_migrator  (forward migration only)
BACKUP_DATABASE_URL    -> academic_writing_backup    (read-only pg_dump only)
RESTORE_DATABASE_URL   -> operator-provisioned isolated recovery DB only
```

`runBackup()` reads only `BACKUP_DATABASE_URL`. `runRestoreVerify()` receives both the live database identity and a separate restore target, rejects equality before spawning a child process, requires `--confirm-isolated-restore`, and emits a sanitized recovery receipt. Neither script falls back to the migration URL.

Recovery receipt contract:

```ts
interface BackupReceiptV1 {
  version: 1;
  status: 'pass';
  backupSha256: string;
  backupSizeBytes: number;
  sourceDatabaseIdentity: string; // sanitized host:port/database, no user/password
  createdAt: string;
}

interface IsolatedRestoreReceiptV1 {
  version: 1;
  status: 'pass';
  backupSha256: string;
  liveDatabaseIdentity: string;
  restoreDatabaseIdentity: string;
  isolatedTarget: true;
  vectorExtension: true;
  tableCount: 14;
  migrationCount: 4;
  verifiedAt: string;
}
```

- [ ] **Step 1: Write failing static grant tests.**

  Assert the canonical SQL creates `academic_writing_backup` as `LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`; grants only `CONNECT`, schema `USAGE`, and `SELECT` on all tables/sequences in `public` and `drizzle`; installs matching migrator default privileges; and does not grant INSERT/UPDATE/DELETE/CREATE or membership in owner/migrator/app roles.

- [ ] **Step 2: Write the real PostgreSQL privilege regression.**

  Extend `P3PostgresRoleFixture` with `backupUrl`. In a disposable database, apply canonical grants, run the existing migrations once with the migrator, reapply grants idempotently, insert representative data with the app, then assert:

```text
pg_dump with appUrl    -> FAIL on insufficient privilege
pg_dump with backupUrl -> PASS, non-empty custom-format dump
backup role DML/DDL    -> DENIED
migration count        -> unchanged at 4
```

- [ ] **Step 3: Add the dedicated role and default grants.**

  Modify only `production-role-grants.sql`. Keep the application and migrator grants unchanged. The script remains credential-free and idempotent.

- [ ] **Step 4: Add a separate, normal-future-only `BACKUP_DATABASE_URL` bootstrap contract.**

  Preserve `INITIAL_SECRET_KEYS` exactly as the current four keys and preserve the existing `ROLE_BY_DATABASE_KEY` app/migrator map and `INITIAL_COMPROMISE_ROTATION` behavior unchanged. Do **not** add `BACKUP_DATABASE_URL` to that map, because its comparison loop requires a current value that the deployed environment does not yet have.

  Extend the existing function without changing its default behavior: `createRotationPlan({ mode, currentEnv, candidateEnv, allowBackupCredentialBootstrap = false })`. Add a separate backup-credential state to its return value and to `rotate-postgres-roles.js`:

```ts
type BackupCredentialAction = 'none' | 'bootstrap' | 'rotate';

interface BackupCredentialPlan {
  key: 'BACKUP_DATABASE_URL';
  role: 'academic_writing_backup';
  action: BackupCredentialAction;
}
```

  The exact transition rules are:

```text
INITIAL_COMPROMISE_ROTATION
  -> existing four-key/app/migrator contract remains byte-for-byte equivalent
  -> never bootstraps academic_writing_backup

NORMAL_FUTURE_ROTATION, current lacks BACKUP_DATABASE_URL
  + canonical grants have already created academic_writing_backup
  + candidate contains a valid URL for exactly academic_writing_backup
  + explicit --bootstrap-backup-credential flag is present
  -> action=bootstrap

NORMAL_FUTURE_ROTATION, current lacks BACKUP_DATABASE_URL, flag absent
  -> FAIL before any ALTER ROLE or env-file write

NORMAL_FUTURE_ROTATION, current contains BACKUP_DATABASE_URL
  -> candidate must contain it; compare current/candidate passwords
  -> changed password gives action=rotate; unchanged gives action=none
  -> --bootstrap-backup-credential is rejected because bootstrap is already complete
```

  For `bootstrap`, the admin helper must confirm the role already exists and must not create it, set only that role's candidate password inside the existing transactional `ALTER ROLE` boundary, then validate candidate connectivity using the existing CA-backed `rejectUnauthorized: true` client and assert `current_user='academic_writing_backup'`. Only after that check succeeds may `rotate-production-env.sh` atomically install the root-owned protected candidate file. If role mutation or connectivity fails, the existing environment file remains unchanged; retrying the same protected candidate is permitted because the database role change is idempotent. Output includes only action/role/success state and never URLs or passwords.

  Add tests proving: existing initial-compromise expectations are unchanged; missing-current backup fails without the explicit bootstrap flag; the flag is invalid outside `NORMAL_FUTURE_ROTATION`; bootstrap requires the canonical role and verified connectivity; a failed connectivity check prevents the atomic env replacement; and once the installed current env contains the key, later normal rotations require the current value and use `rotate`, never `bootstrap`. No other missing credential receives this exception.

  Update the shell/Node CLI boundary explicitly:

```text
rotate-production-env.sh <candidate> <app-root> NORMAL_FUTURE_ROTATION --bootstrap-backup-credential
rotation-contract.js <current> <candidate> NORMAL_FUTURE_ROTATION --bootstrap-backup-credential
rotate-postgres-roles.js <current> <candidate> NORMAL_FUTURE_ROTATION <app-root> --bootstrap-backup-credential
```

  The fourth/sixth flag position is optional only for ordinary existing-credential rotations and is rejected for `INITIAL_COMPROMISE_ROTATION`. Keep `BACKUP_DATABASE_URL` out of `verify-production-env.sh`'s unconditional legacy required-key loop so an existing pre-bootstrap environment and the preserved initial-compromise flow do not fail merely because the new key is absent. When the key is present, the verifier must require a non-empty value without printing it; the rotation contract performs the role-specific URL validation. The P3 remediation readiness gate—not the legacy initial-secret contract—requires the key after bootstrap.

- [ ] **Step 5: Make backup fail closed on the backup connection.**

```js
const databaseUrl = (env.BACKUP_DATABASE_URL || '').trim();
if (!databaseUrl) {
  throw new Error('BACKUP_DATABASE_URL is required to create a PostgreSQL backup.');
}
```

  Preserve `PGSSLMODE=verify-full` and `PGSSLROOTCERT`. After `pg_dump` succeeds, verify a non-empty regular file, compute SHA-256, and atomically write a mode-600 receipt to `BACKUP_EVIDENCE_PATH`. The CLI prints only PASS, byte count, digest, and receipt path—never the URL.

- [ ] **Step 6: Make restore provably isolated before spawn.**

  Parse the live `DATABASE_URL` and `RESTORE_DATABASE_URL` into sanitized host/port/database identities. Reject missing values, credentials in evidence, identical targets, a target database name that does not equal the explicit `RESTORE_DATABASE_NAME_CONFIRM`, or absence of `--confirm-isolated-restore`. Only then run `pg_restore --clean --if-exists --no-owner` against `RESTORE_DATABASE_URL`, followed by the existing vector/table/migration verification and `current_database()` check. Write the isolated-restore receipt atomically with mode 600.

- [ ] **Step 7: Add rollback preflight and fail-closed shell ordering.**

  `rollback-preflight.js` validates:

```text
PRODUCTION_ROLLBACK_AUTHORIZED=YES
backup receipt is root-owned, mode 600, regular, not symlink
restore receipt is root-owned, mode 600, regular, not symlink
both receipts are status=pass and version=1
backup SHA matches between receipts and the current dump file
isolatedTarget=true and restore identity != live identity
target release SHA equals the reviewed rollback SHA argument
```

  `rollback.sh` must invoke preflight before `ln -sfn`, PM2 reload, or health requests. It still must not contain `db-migrate`, migration-down logic, `DROP SCHEMA`, or `pg_restore`.

- [ ] **Step 8: Replace E2E-09/E2E-10 placeholders with explicit gates.**

  E2E-09 becomes post-operation verification of recorded backup/isolated-restore receipts. E2E-10 is skipped unless `PRODUCTION_ROLLBACK_AUTHORIZED=YES` and receipt paths are supplied; it verifies post-rollback browser health only. The Playwright test never executes `rollback.sh` itself. Ordinary P3 E2E runs must report E2E-10 as `BLOCKED_BY_AUTHORIZATION`, not PASS.

- [ ] **Step 9: Update CI to use separate databases and the backup role.**

  The `postgres-schema` job creates a disposable source database through the existing role fixture and a second empty recovery database, backs up with `backupUrl`, restores only into the recovery database, verifies receipts/data, and drops only the disposable databases. It does not run migrations on the recovery database.

- [ ] **Step 10: Run targeted verification.**

```powershell
npx jest test/unit/db-backup-restore.spec.ts test/unit/postgres-role-grants.spec.ts test/unit/p3-wp6-security-contract.spec.ts test/unit/p3-deployment-contract.spec.ts test/unit/p3-release-integrity.spec.ts --runInBand
npx jest test/integration/p3-backup-restore.integration.spec.ts --runInBand
```

**Later manual production re-validation (not authorized by `IMPLEMENTATION_AUTHORIZED`):** After separate Controller authorization, apply the updated canonical grants, use the controlled `NORMAL_FUTURE_ROTATION --bootstrap-backup-credential` path to add the first backup credential, and run `pg_dump` with `BACKUP_DATABASE_URL`; hash the dump; create a new isolated recovery database through operator/admin tooling; run restore verification with `RESTORE_DATABASE_URL`; compare vector/table/migration counts and representative row counts; retain receipts. Do not run `db:migrate` on either live or recovery database. Stop before rollback and return evidence to the Controller.

**Rollback/recovery:** The new role is additive and does not modify application data or migrations. If backup-role rollout fails, leave `DATABASE_URL` and the running app untouched, preserve the failed evidence, and fix only grants/credential rotation. The recovery database may be dropped only after evidence review. No production release rollback is performed in this remediation.

---

## Task 3: Add a Minimal ACME Webroot Exception

**Classification:** Blocking.

**Confirmed root cause:** `deploy/nginx/academic-writing-platform.conf` has a server-level port-80 `return 301`, so it cannot serve `/.well-known/acme-challenge/<token>` from a Certbot webroot. The 443 block proxies all paths to the SPA/API. This is sufficient to explain why a webroot token is not served, but live DNS, firewall, selected Certbot authenticator, and filesystem permissions still require one post-change verification.

**Files:**

- Modify: `deploy/nginx/academic-writing-platform.conf`
- Create: `deploy/scripts/prepare-acme-webroot.sh`
- Create: `test/integration/p3-acme-webroot.integration.spec.ts`
- Modify: `test/unit/p3-deployment-contract.spec.ts`
- Modify: `test/unit/p3-deployment-shell-syntax.spec.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `test/unit/p3-ci-gates.spec.ts`
- Modify: `docs/deployment/P3_RUNBOOK.md`
- Modify: `docs/deployment/P3_ACCEPTANCE_EVIDENCE.md`

**Interface / Nginx contract:**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name write.yingrenji.cn;

    location ^~ /.well-known/acme-challenge/ {
        root /var/lib/letsencrypt;
        default_type text/plain;
        try_files $uri =404;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```

HTTPS, SPA fallback, API proxying, upload limit, upstream, certificates, and security headers remain unchanged.

- [ ] **Step 1: Write the failing static and disposable-Nginx tests.**

  Assert a known token file returns HTTP 200 and exact token bytes over HTTP; a missing token returns 404 without reaching Node; `/`, `/api/*`, and arbitrary HTTP paths still return 301 to the same HTTPS host/path; the HTTPS server retains the loopback proxy and 22 MiB body limit.

- [ ] **Step 2: Add the dedicated webroot preparation script.**

  Idempotently create `/var/lib/letsencrypt/.well-known/acme-challenge` as a non-symlink directory, `root:root`, mode 755, outside releases/document storage/PM2 state. Fail on incompatible ownership, mode, or symlink rather than repairing an unknown path destructively.

- [ ] **Step 3: Move the blanket redirect into `location /` and add the exact challenge location.**

  Do not add a second public server, change TLS protocols, modify the 443 proxy, or expose any filesystem other than the challenge directory.

- [ ] **Step 4: Add the integration suite to the existing Nginx CI job.**

```powershell
npx jest test/integration/p3-acme-webroot.integration.spec.ts test/integration/p3-upload-boundary.integration.spec.ts --runInBand
```

**Later manual production re-validation (not authorized by `IMPLEMENTATION_AUTHORIZED`):** After separate Controller authorization, run the preparation helper, create a one-time harmless challenge probe file, run `nginx -t`, reload Nginx, verify `http://write.yingrenji.cn/.well-known/acme-challenge/<probe>` returns exact bytes and ordinary HTTP redirects, remove the probe, then run `certbot renew --dry-run --webroot -w /var/lib/letsencrypt`. Record sanitized Certbot status and certificate dates; do not print account data or private-key paths beyond the already public config path.

**Rollback/recovery:** Keep the current certificate files in place. If `nginx -t` fails, do not reload. Restore the prior Nginx config and retest; the new empty webroot can remain because it contains no application data. HTTPS/API/SPA service must stay available throughout.

---

## Task 4: Compose Academic Search Import with the Existing Knowledge Pipeline

**Classification:** Product UX remediation — required for P3 acceptance. It is mandatory before final P3 acceptance but is independent of the backup/restore and ACME safety remediation dependency chain.

**Confirmed evidence:** `/api/academic-search/search` returns real normalized OpenAlex discovery results and the UI renders DOI/landing/PDF links, but there is no import endpoint or action. `KnowledgeProductService.importDocument()` requires a real owned `DocumentInputRef`; `SourceRecord` already supports standalone bibliographic metadata. This existing split permits the remediation without a migration.

**Architecture decision:** Keep `AcademicSearchService.search()` unchanged. Add an authoritative OpenAlex import gateway that resolves one work by server-side `externalRecordId`; add a separate import-composition module that persists metadata and, only when a bounded safe PDF download succeeds, reuses `DocumentInputService.upload()` and `KnowledgeService.importDocument()`/`createNextVersion()`. Metadata-only entries remain `SourceRecord` rows with no document/version/chunks/index.

**Files:**

- Modify: `shared/academic-search.interface.ts`
- Modify: `shared/knowledge-product.interface.ts`
- Modify: `server/modules/academic-search/openalex.types.ts`
- Modify: `server/modules/academic-search/openalex.client.ts`
- Modify: `server/modules/academic-search/academic-search.module.ts`
- Create: `server/modules/academic-search/openalex-import.gateway.ts`
- Create: `server/modules/academic-search/openalex-import.gateway.spec.ts`
- Create: `server/modules/academic-search-import/*` files listed in File Topology
- Modify: `server/modules/knowledge/knowledge.repository.ts`
- Modify: `server/modules/knowledge/knowledge.repository.spec.ts`
- Modify: `server/modules/knowledge-product/knowledge-product.types.ts`
- Modify: `server/modules/knowledge-product/knowledge-product.service.ts`
- Modify: `server/modules/knowledge-product/knowledge-product.controller.ts`
- Modify: their existing specs and `test/unit/knowledge-product.http.integration.spec.ts`
- Modify: `server/app.module.ts`
- Modify: `client/src/api/academic-search.ts`
- Modify: `client/src/api/knowledge.ts`
- Modify: `client/src/api/integration-error.ts`
- Modify: `client/src/components/academic-search/AcademicSearchResultCard.tsx`
- Modify: `client/src/pages/AcademicSearch/AcademicSearchPage.tsx`
- Modify: `client/src/components/documents/DocumentUploadFlow.tsx`
- Modify: `client/src/components/documents/document-workspace.state.ts`
- Modify: `client/src/pages/Knowledge/KnowledgePage.tsx`
- Modify: `test/unit/academic-search-client.spec.ts`
- Modify: `test/unit/academic-search-frozen-boundary.spec.ts` only to preserve the discovery/import boundary, not to weaken it
- Modify: `test/unit/knowledge-product-client.spec.ts`
- Create: `server/modules/academic-search-import/academic-search-import.controller.spec.ts`
- Create: `server/modules/academic-search-import/academic-search-import.service.spec.ts`
- Create: `server/modules/academic-search-import/academic-search-import.exception-filter.spec.ts`
- Create: `server/modules/academic-search-import/openalex-source.mapper.spec.ts`
- Create: `test/unit/academic-search-import.http.integration.spec.ts`
- Modify: `test/e2e/p3-production.spec.ts`
- Do not modify: database schema or migrations

**Public interfaces:**

```ts
export interface AcademicSearchImportRequest {
  provider: 'openalex';
  externalRecordId: string;
}

export type AcademicSearchImportResult =
  | {
      kind: 'full-text';
      source: KnowledgeWorkspaceSource;
      document: KnowledgeWorkspaceDocument;
      indexStatus: 'not-indexed';
      uploadRequired: false;
    }
  | {
      kind: 'metadata-only';
      source: KnowledgeWorkspaceSource;
      fullTextReason: 'not-advertised' | 'unavailable' | 'invalid-pdf' | 'processing-failed';
      uploadRequired: true;
    };
```

Endpoint: authenticated `POST /api/academic-search/import`, body containing only provider and external record ID. Client-supplied title, abstract, metadata, PDF URL, owner ID, indexing state, and evidence state are rejected/ignored by strict DTO validation.

For full-text imports, use the deterministic identity `openalex:work:<externalRecordId>:primary-pdf`. The authoritative resolver also returns OpenAlex `updated_date`; normalize it to epoch milliseconds for the existing numeric external-version comparison. Use the downloaded bytes' MD5 only for the existing `ExternalSyncState.externalChecksum` contract, while retaining SHA-256 as the canonical `DocumentInputRef` integrity hash and in the idempotency key. A repeat import with the same authoritative version and bytes must return the existing document/version; a newer authoritative version with different bytes may call the existing `createNextVersion()` path. Do not add a second versioning scheme or a schema column.

`KnowledgeWorkspaceSource` projects safe canonical metadata plus:

```ts
contentStatus: 'metadata-only' | 'full-text-linked';
isGroundedEvidence: false;
```

The `isGroundedEvidence` value remains false even when full text is linked; only a separately indexed version is selectable by Grounded Writing.

- [ ] **Step 1: Write the authoritative work-resolution tests.**

  Add `OpenAlexClient.getWork(externalRecordId)` using the configured OpenAlex base URL and the same timeout/retry/sanitization rules as search. Normalize server-fetched metadata. Reject malformed IDs and invalid provider responses. Existing search request/response tests must remain byte-for-byte compatible except for additive exports that do not change the search payload.

- [ ] **Step 2: Write safe PDF retrieval tests before implementing download.**

  The gateway accepts only the PDF URL from the freshly resolved OpenAlex record. Test HTTPS-only URLs, DNS/IP rejection for loopback/private/link-local ranges, manual redirect validation on every hop, bounded redirects, deadline, `Content-Length` precheck, streaming 20 MiB cap, `application/pdf` or safe octet-stream handling, `%PDF-` signature, and cancellation. A client body can never supply or override the URL.

- [ ] **Step 3: Write metadata mapping tests.**

  Map title/authors/year/venue/abstract/DOI/URL to `observed` assertions and canonical fields, with external provenance `connectorKind='academic-discovery'`, `provider='openalex'`. Test explicitly that `abstract` appears only in source metadata and never in `KnowledgeDocumentInput`.

- [ ] **Step 4: Write import orchestration tests.**

  Cover:

```text
no pdfUrl                    -> SourceRecord only, metadata-only result
download unavailable        -> SourceRecord only, explicit unavailable reason
invalid/non-PDF response     -> SourceRecord only, explicit invalid-pdf reason
valid PDF                    -> upload -> C1/C2/C3/E1 document/version/chunks
repeat same work/content     -> idempotent source/document, no duplicate active version
knowledge import failure     -> best-effort uploaded-file compensation
different owner             -> independent owner-scoped source/document
all branches                -> zero automatic index calls
```

  Reuse the Zotero attachment service's compensation and external-identity pattern rather than inventing a second document pipeline.

- [ ] **Step 5: Implement metadata-only workspace projection.**

  Add owner-scoped `listSourceRecords(userId)` in the repository and `GET /api/knowledge/sources` in Knowledge Product. `KnowledgeProductService.listSources()` compares owner-scoped documents by `sourceRecordId` to compute `contentStatus`; it never synthesizes a version or index for a metadata-only source.

- [ ] **Step 6: Add the explicit Search import UX.**

  Each result card gets one “导入工作区” action with per-record busy/error state. On result:

- full text: show “全文已导入；请到文档工作区显式建立索引” and link to `/knowledge`;
- metadata-only: show “仅元数据已导入；摘要不是全文证据，请上传 PDF” and link to the matching source in `/knowledge`.

- [ ] **Step 7: Let an uploaded PDF attach to a metadata-only source.**

  Extend `runDocumentUploadFlow()` and `DocumentUploadFlow` with optional `sourceRecordId`. The Knowledge page lists metadata-only source cards and offers “上传 PDF 并关联”; the resulting normal workspace import includes that source ID. Existing unassociated uploads omit it and remain unchanged.

- [ ] **Step 8: Preserve explicit indexing and evidence selection.**

  Full-text imports stop at `content-ready-for-indexing`. Metadata-only sources have no index button and never appear in `getSelectableKnowledgeSources()`. Once a linked document is explicitly indexed, existing Grounded Writing selection works unchanged.

- [ ] **Step 9: Run targeted verification.**

```powershell
npx jest server/modules/academic-search server/modules/academic-search-import server/modules/knowledge server/modules/knowledge-product test/unit/academic-search-client.spec.ts test/unit/academic-search-state.spec.ts test/unit/knowledge-product-client.spec.ts test/unit/grounded-writing-client.spec.ts --runInBand
```

**Later manual production re-validation (not authorized by `IMPLEMENTATION_AUTHORIZED`):** After separate Controller authorization, use one OpenAlex record whose authoritative current location yields a valid textual PDF and one record with no usable full text. For the first, record search → import → document/version/chunks → explicit index → grounded trace. For the second, record metadata-only source, upload-required copy, absence from grounded selection, then manually upload a PDF and repeat explicit indexing. Do not treat the abstract as generated or retrieved evidence.

**Rollback/recovery:** No migration. Imported sources/documents use existing owner-scoped tables and lifecycle semantics. Failed full-text import removes only its newly uploaded artifact best-effort. Reverting the release removes the new UI/API while preserving already created valid SourceRecords/Documents; no data deletion is automatic.

---

## Task 5: Reposition Zotero as an Optional Advanced Integration

**Classification:** Product UX remediation.

**Confirmed evidence:** `client/src/components/Navbar.tsx` exposes `/zotero` as a primary desktop/mobile item. The existing backend, API-key connection, item sync, and PDF attachment import are accepted and should not be rewritten.

**Files:**

- Modify: `client/src/components/Navbar.tsx`
- Modify: `client/src/pages/Profile/ProfileSidebar.tsx`
- Modify: `client/src/pages/Profile/ProfilePage.tsx`
- Create: `client/src/pages/Profile/pages/Integrations.tsx`
- Modify: `client/src/pages/Zotero/ZoteroPage.tsx`
- Create: `test/unit/zotero-product-positioning.spec.ts`
- Preserve unchanged: `server/modules/zotero/**`, `client/src/api/zotero.ts`, shared Zotero contracts, and `/zotero` route in `client/src/app.tsx`

**UX contract:** Zotero is labeled “可选高级集成 / Optional Advanced Integration”, reachable from 个人中心 → 第三方集成. It is absent from the primary desktop/mobile navigation. Direct bookmarked access continues to work. Copy states that manual PDF upload and Academic Search are normal core paths and that Zotero OAuth is not included.

- [ ] **Step 1: Write the positioning regression.**

  Assert the primary `navItems` contains no `/zotero`, Profile has an `integrations` tab, Integrations links to `/zotero`, and the optional/deferred copy is present. Assert backend source files are unchanged in this task's diff.

- [ ] **Step 2: Add the integrations profile tab and remove only the primary-nav item.**

  Do not remove the route, API, page, backend module, connection health, or import buttons.

- [ ] **Step 3: Update Zotero page copy.**

  Add an optional-advanced badge and a concise note that API-key integration is supported, OAuth is deferred, and imported metadata/PDF still requires explicit indexing.

- [ ] **Step 4: Run client-focused checks.**

```powershell
npx jest test/unit/zotero-product-positioning.spec.ts --runInBand
npm run type:check:client
npm run build:client
```

**Later manual production re-validation (not authorized by `IMPLEMENTATION_AUTHORIZED`):** After separate Controller authorization, verify desktop and mobile primary navigation omit Zotero, 个人中心 → 第三方集成 opens `/zotero`, and direct/bookmarked `/zotero` access still renders the existing page. Do not rerun backend/API list, sync, connection-health, or live-import validation when `server/modules/zotero/**`, the shared Zotero contracts, and `client/src/api/zotero.ts` are unchanged.

**Rollback/recovery:** UI-only. Reverting the release restores prior navigation. Existing encrypted credentials and imported records are untouched.

---

## Task 6: Consolidated Verification, Production Gates, and Evidence

**Classification:** Blocking acceptance preparation; no production rollback authorization.

**Files:**

- Modify: `docs/deployment/P3_RUNBOOK.md`
- Modify: `docs/deployment/P3_ENVIRONMENT_MANIFEST.md`
- Modify: `docs/deployment/P3_ACCEPTANCE_EVIDENCE.md`
- Modify: `docs/operations/database-backup-restore.md`
- Modify at Review Candidate: `PROJECT_STATE.md`
- Modify at Review Candidate: `ROADMAP.md`
- Modify: `.github/workflows/ci.yml`
- Modify: `test/unit/p3-ci-gates.spec.ts`

**Interfaces / non-production handoff state:**

```text
LOCAL_AND_INTEGRATION_TESTS=PASS
CI_EXACT_CANDIDATE=PASS
MIGRATION_DIFF=EMPTY
PRODUCTION_DEPLOYMENT=NOT_EXECUTED
PRODUCTION_REVALIDATION=NOT_EXECUTED
PRODUCTION_ROLLBACK_AUTHORIZED=NO
E2E_10=BLOCKED_BY_AUTHORIZATION
HANDOFF=P3_REMEDIATION_CODE_READY_FOR_CONTROLLER_REVIEW
```

- [ ] **Step 1: Run all targeted suites from Tasks 1–5.**

  Every new regression must fail on baseline and pass after its minimal implementation. Preserve failure output as sanitized local/CI evidence.

- [ ] **Step 2: Run full repository verification once.**

```powershell
npm test -- --runInBand
npm run lint
npm run type:check
npm run build:server
npm run build:client
npm run test:app-bootstrap
node scripts/test-production-artifact.js
```

- [ ] **Step 3: Run real PostgreSQL and Nginx CI gates.**

  Require `verify`, `postgres-schema` (including backup/isolated restore), `nginx-upload-boundary` (including ACME), `wp6-step5b`, and aggregate `production-gates` on the exact remediation candidate SHA.

- [ ] **Step 4: Verify the frozen/no-migration diff.**

```powershell
git diff --name-only a560bf4521c45848d4b7af4fe76c2c6e0b582be6...HEAD
git diff --exit-code a560bf4521c45848d4b7af4fe76c2c6e0b582be6...HEAD -- drizzle/migrations
git status --short
```

  Search discovery behavior, Zotero backend, accepted retrieval/citation semantics, and prior deployment gates receive only the minimum non-production regression checks required by the changed files; do not reopen their accepted design review.

- [ ] **Step 5: Update non-production candidate evidence.**

  Record exact candidate SHA, CI run IDs, fixture hash/size, sanitized parser cause and fix boundary, local PostgreSQL backup/isolated-restore results, disposable-Nginx ACME results, Search import test outcomes, and Zotero UI test proof. Mark all live-production fields `NOT_EXECUTED / PENDING_CONTROLLER_AUTHORIZATION`. Keep `Production rollback authorized: NO`, `E2E-10: BLOCKED_BY_AUTHORIZATION`, `P3_ACCEPTED=NO`, and `STOP_FOR_CHATGPT_REVIEW=YES`.

- [ ] **Step 6: Correct governance drift without claiming acceptance.**

  Update `PROJECT_STATE.md` and `ROADMAP.md` only to the verified current state: P3 branch/PR/candidate and `FINAL_REMEDIATION_CODE_REVIEW_PENDING`. Do not write `PHASE_P3_ACCEPTED`, production PASS, merge status, accepted tag, or next-phase authorization.

- [ ] **Step 7: Update PR #16 and stop at the implementation boundary.**

  Push/update PR #16 only after `IMPLEMENTATION_AUTHORIZED` has been granted and all non-production checks pass. Return the remediation candidate SHA and evidence, then stop with exactly `P3_REMEDIATION_CODE_READY_FOR_CONTROLLER_REVIEW`. Do not deploy, modify production configuration or roles, run production backup/restore, run Certbot/Nginx operations, execute production E2E, rollback, reboot, merge, or tag.

### Later Controller-controlled manual production phase

This phase is not authorized by `IMPLEMENTATION_AUTHORIZED` and must not run as a continuation of code implementation. It begins only after the Controller reviews the code-ready candidate and issues a separate instruction that explicitly names the allowed production deployment/revalidation operations. Its manual order is:

```text
deploy reviewed release
→ health live/ready
→ real PDF upload/import/index/grounded proof
→ updated grants + backup-role credential rollout
→ backup PASS
→ create isolated recovery DB
→ isolated restore verify PASS (no migration)
→ ACME probe + certbot renew --dry-run PASS
→ Search full-text and metadata-only import proofs
→ Zotero positioning proof
→ STOP before rollback
```

After those authorized manual checks, record backup/restore receipt hashes, isolated DB name, ACME result, production Search import outcomes, and production UI proof. Even if every item passes, keep `PRODUCTION_ROLLBACK_AUTHORIZED=NO` and `E2E_10=BLOCKED_BY_AUTHORIZATION`. A real rollback may run only after the user separately supplies `PRODUCTION_ROLLBACK_AUTHORIZED`; that authorization is not implied by code approval, CI PASS, deployment approval, production revalidation approval, backup PASS, or isolated-restore PASS.

## Production Recovery Decision Table

| Failure | Required response | Forbidden response |
|---|---|---|
| Real PDF regression still fails | Preserve exact sanitized exception; return to first failing boundary | MIME/size relaxation, OCR fallback, or guessing |
| Backup role cannot dump | Stop; inspect grants/ownership with admin read-only queries | Grant backup privileges to app role |
| Restore target equals live | Script exits before `pg_restore`; preserve evidence | Override the guard or use live `DATABASE_URL` |
| Isolated restore verify fails | Retain dump and isolated DB for diagnosis | Rerun migrations or proceed to rollback |
| ACME probe/renewal fails | Keep current cert/config, inspect DNS/path/authenticator | Replace cert or break HTTPS proxy |
| Search PDF download is unusable | Persist metadata only and prompt PDF upload | Index abstract/metadata as full text |
| Search pipeline import fails after upload | Best-effort remove only the new artifact | Delete prior source/document/version |
| Rollback lacks any gate | `STOP / NO ROLLBACK` | Change `current`, reload PM2, or touch DB |

## Explicit Non-Goals

- No OCR or alternate PDF extraction stack unless the reproduced exception proves the accepted parser cannot handle a supported textual PDF and the Controller approves that architectural expansion.
- No database migration, migration rerun, schema redesign, queue, worker, or object storage.
- No OpenAlex search relevance/pagination/provider re-review.
- No automatic indexing after any import.
- No use of abstract or metadata as document text/evidence.
- No Zotero backend deletion, OAuth implementation, or credential migration.
- No real production rollback, reboot, merge, or tag.

## Controller Review Gates

Controller approval should verify:

1. The real failing PDF fixture is legally/privacy-safe and reproduces the exact failure before a fix is accepted.
2. `academic_writing_backup` is read-only, the app role receives no new operational privilege, existing `INITIAL_SECRET_KEYS`/initial-compromise semantics remain unchanged, and only the explicit normal-future bootstrap admits a missing current backup credential.
3. Restore cannot target live, and neither restore nor rollback executes a migration.
4. ACME exception serves only the challenge path; all other HTTP traffic redirects and HTTPS behavior is unchanged.
5. Metadata-only Search imports structurally cannot produce versions, chunks, indexes, or evidence.
6. Zotero remains functional but is no longer a core navigation gate.
7. E2E-10 remains blocked until backup and isolated restore pass and the user separately authorizes `PRODUCTION_ROLLBACK_AUTHORIZED`.
8. `IMPLEMENTATION_AUTHORIZED` stops at the PR/code candidate and cannot trigger production deployment or revalidation; the executor reports `P3_REMEDIATION_CODE_READY_FOR_CONTROLLER_REVIEW` and stops.

On approval, the next permitted state is `IMPLEMENTATION_AUTHORIZED`, limited to code changes, TDD, local/integration tests, CI, and PR update. Until then, stop.
