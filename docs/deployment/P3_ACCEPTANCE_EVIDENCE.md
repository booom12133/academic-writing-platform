# P3 Acceptance Evidence

This document records the authorized P3 production deployment and revalidation
evidence. It is not an acceptance decision, does not grant
`PHASE_P3_ACCEPTED`, and does not authorize any further production mutation.

## Identity

- Repository: `booom12133/academic-writing-platform`
- Phase branch: `phase/p3-deployment-e2e`
- PR: `#16` (OPEN)
- Base SHA: `666f40309b42f2c0d44e4fd6ecbcd1e81f869a8d`
- Candidate commit: `40d83f351ad5b42b1b1849919b0bc231098aa75f`
- Production release SHA: `40d83f351ad5b42b1b1849919b0bc231098aa75f`
- Release package: `academic-writing-platform-p3-40d83f351ad5b42b1b1849919b0bc231098aa75f.tar.gz`
- Package size: `54,986,604 bytes`
- Package SHA-256: `8b6a1f05b4c7830581a26f62be46c86868ef524f8bbdca92aaf4dd670d6b2e1f`
- Release path: `/opt/academic-writing-platform/releases/40d83f351ad5b42b1b1849919b0bc231098aa75f`
- Release manifest: `PASS`

## WP0-WP1 checkpoint

- Part A remediation baseline before final A9 gates: `8d54b7357c232d44c13b2015e80de1a68c403577`
- Required GitHub CI jobs: `verify`, `wp6-step5b`, `nginx-upload-boundary`,
  `postgres-schema`, and their aggregate `production-gates`
- Production-equivalent CI scope: synthetic PostgreSQL roles and credentials,
  controlled migration, app-role verification/readiness, denial cases, pristine
  rotation, Nginx upload boundaries, provider-auth regression, rollback
  compatibility, artifact closure, and full baseline
- Production mutation before the authorized deployment checkpoint: `NO`
- Migration diff: `EMPTY`

## Production deployment and runtime

### Release and persistent storage

- Production deployment: `PASS`
- Persistent storage path: `/var/lib/academic-writing-platform/documents`
- Persistent storage owner: `academic-writing:academic-writing`
- Persistent storage mode: `700`
- Persistent storage status: `PERSISTENT_STORAGE_VERIFY_PASS`
- Production environment: `/etc/academic-writing-platform/production.env`
- Production environment owner: `root:academic-writing`
- Production environment mode: `640`
- Production environment status: `PRODUCTION_ENV_VERIFY_PASS`
- Secret values recorded in this evidence: `NO`

### PostgreSQL

- Verification mode: production database read-only verification only
- Status: `P3_PRODUCTION_DATABASE_VERIFICATION_PASS`
- Dedicated backup role: `academic_writing_backup`
- Backup role, grants, and credential bootstrap: `PASS`
- Final temporary administrator password state: `POSTGRES_PASSWORD_ABSENT`
- `DATABASE_MIGRATION_RERUN_AUTHORIZED = NO`
- `NO PRODUCTION MIGRATION RERUN`

### PM2/runtime

- Runtime entrypoint: `/opt/academic-writing-platform/current/app/server/main.js`
- Resolved cwd: `/opt/academic-writing-platform/releases/40d83f351ad5b42b1b1849919b0bc231098aa75f/app`
- Runtime target verification: `PASS`
- `verify-live`: `PASS`
- PM2 saved state: `pm2 save` completed after verification
- `PART_A_ACTIVATION=PASS`

## Recovery evidence

### Production backup

- Dump: `/var/backups/academic-writing-platform/20260918T150122Z.dump`
- Receipt: `/var/backups/academic-writing-platform/20260918T150122Z.backup.receipt.json`
- Bytes: `180838`
- SHA-256: `fbf87e5e1d375ca59af909ab206fb3579baa1cbbdb749349ed6c2ab7d052df79`
- Owner: `root:root`
- Mode: `600`
- Status: `PASS`

### Isolated restore

- Recovery database: `academic_writing_recovery_p3_20260918`
- Restore receipt: `/var/backups/academic-writing-platform/20260918T150122Z.restore.receipt.json`
- Status: `PASS`
- Backup SHA in restore receipt matches backup receipt: `YES`
- Restore target differs from live database: `YES`
- Migration executed during restore: `NO`
- Receipt verification: `RESTORE_RECEIPT_VERIFY_PASS`
- Final temporary PostgreSQL password state: `ABSENT / NULL`

### Rollback boundary

- Approved previous supported release SHA: `666f40309b42f2c0d44e4fd6ecbcd1e81f869a8d`
- Rollback compatibility integration: CI `PASS` at remediation baseline
  `8d54b7357c232d44c13b2015e80de1a68c403577`; this is compatibility evidence,
  not production rollback authorization
- Rollback compatibility CI run: GitHub Actions run `34978478048`,
  `postgres-schema` job `104412266657`: `PASS`
- `PRODUCTION_ROLLBACK_AUTHORIZED = NO`
- `E2E-10 rollback = BLOCKED_BY_AUTHORIZATION`

## ACME / Nginx / Certbot

- ACME webroot: `/var/lib/letsencrypt`
- Nginx challenge location active: `YES`
- Challenge probe: `PASS`
- HTTP to HTTPS 301: `PASS`
- Certbot renewal setting: `webroot_path = /var/lib/letsencrypt`
- Dry-run command: `certbot renew --dry-run --cert-name write.yingrenji.cn`
- Dry-run result: `CERTBOT_RENEW_DRY_RUN_PASS`
- Final status: `POST_ACME_LIVE_READY_PASS`

## Authentication

- Public runtime config: `200`
- Anonymous Academic Search: `401`
- Boundary status: `OIDC_AUTH_BOUNDARY_PRECHECK_PASS`
- Real-browser Auth0 login: `OIDC_LOGIN_SESSION_PASS`
- `AUTHENTICATED_PROVIDER_ACCEPTANCE=PASS`

## Production workflows

### Real PDF to Knowledge to Grounded Writing

- Source file: `LIPIcs.ITP.2023.19.pdf`
- Upload/import: `PASS`
- Workspace persistence: `PASS`
- Explicit indexing: `1148 / 1148 chunks`
- Indexing status: `KNOWLEDGE_INDEXING_PASS`
- Grounded Writing generation: `PASS`
- Claims bound: `YES`
- Citations `[1]` and `[2]` present: `YES`
- Citation-to-chunk mapping present: `YES`
- Evidence trace/source present: `YES`
- Final status: `GROUNDED_WRITING_E2E_PASS`

The verified path is:

```text
PDF upload
→ parse
→ persistence
→ chunking
→ embedding
→ pgvector index
→ retrieval
→ LLM grounded generation
→ claim binding
→ citation
→ evidence trace
```

### Academic Search

- Metadata-only import: `ACADEMIC_SEARCH_METADATA_ONLY_IMPORT_PASS`
- Full-text-unavailable product message:
  `仅元数据已导入；摘要不是全文证据，请上传 PDF。`
- Full-text direct import: `ACADEMIC_SEARCH_FULL_TEXT_IMPORT_DEFERRED`
- Deferred-item effect: non-blocking for P3 governance closure; retained as
  follow-up backlog
- Non-blocking external issue: some OpenAlex records have title metadata that
  does not match DOI/authors/abstract/PDF metadata. This is an upstream
  data-quality issue, not a PDF parser failure.

### Zotero

- Production UI positioning: `ZOTERO_POSITIONING_PASS`
- Product position: `Optional Advanced Integration`
- Core paths: Manual PDF Upload and Academic Search
- Zotero OAuth: `DEFERRED`

## Authorization boundary

```text
PRODUCTION_ROLLBACK_AUTHORIZED = NO
DATABASE_MIGRATION_RERUN_AUTHORIZED = NO
REBOOT_AUTHORIZED = NO
MERGE_AUTHORIZED = NO
TAG_AUTHORIZED = NO
```

No rollback, reboot, migration rerun, merge, tag, or new production mutation is
authorized by this evidence update.

## Final remediation code evidence

- Plan SHA-256: `9d68d0d1642809f7893eedb70cf8536b23c267dbc8468a3c9c9768cdccb623f6`
- PDF parser root cause: production artifact pruning omitted the dynamically
  resolved `pdfjs-dist` runtime package and standard-font assets.
- Local/unit verification: `PASS` — `npm test -- --runInBand`: 195 suites
  passed, 9 environment-gated suites skipped; 1,099 tests passed, 55 skipped.
- Lint and combined type-check: `PASS`
- Full production build: `PASS` via repository `scripts/build.sh`; 467 packages
  copied, zero failures.
- Artifact closure/startup/frontend/health/shutdown: `PASS`; packaged PDF parser
  regression: 23 pages and 2,323 non-empty parsed blocks.
- Disposable PostgreSQL/Nginx verification: delegated to required CI jobs.

## Current governance status

```text
P3_REMEDIATION_CODE_REVIEW_PASS
P3_PRODUCTION_REVALIDATION_COMPLETE_WITH_ONE_DEFERRED_ITEM
ACADEMIC_SEARCH_FULL_TEXT_IMPORT_DEFERRED
FINAL_ACCEPTANCE_PENDING
P3_ACCEPTED=NO
P3_ACCEPTED_CLOSED=NO
STOP_FOR_CHATGPT_REVIEW=YES
```

The only deferred item is `ACADEMIC_SEARCH_FULL_TEXT_IMPORT_DEFERRED`. P3 has
not received explicit Final Acceptance; no P3 Final Acceptance Report has been
created.
