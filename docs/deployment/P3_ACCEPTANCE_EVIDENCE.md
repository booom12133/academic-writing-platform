# P3 Acceptance Evidence

This template is populated only after authorized WP0-WP10 execution. It is
not an acceptance decision and does not authorize production mutation.

## Identity

- Repository: booom12133/academic-writing-platform
- Phase branch: phase/p3-deployment-e2e
- Base SHA: 666f40309b42f2c0d44e4fd6ecbcd1e81f869a8d
- Candidate commit:
- Production release SHA:

## WP0-WP1 checkpoint

- Baseline proof:
- Host preflight:
- Changed files:
- Targeted tests:
- Full relevant regression:
- Reproducible-build output:
- Artifact closure output:
- Artifact smoke output:
- No-secret scan:
- Production mutation before checkpoint: NO

## Deployment and E2E

- Part A remediation baseline before final A9 gates: `8d54b7357c232d44c13b2015e80de1a68c403577`
- Required GitHub CI jobs: `verify`, `wp6-step5b`, `nginx-upload-boundary`,
  `postgres-schema`, and their aggregate `production-gates`
- Production-equivalent CI scope: synthetic PostgreSQL roles and credentials,
  controlled migration, app-role verification/readiness, denial cases, pristine
  rotation, Nginx upload boundaries, provider-auth regression, rollback
  compatibility, artifact closure, and full baseline
- PostgreSQL 16 and pgvector:
- PostgreSQL certificate verification:
- Migration and schema:
- Pre-start app-role database verification:
- Persistent storage:
- PM2 single-fork lifecycle:
- PM2 systemd boot recovery:
- Nginx HTTPS boundary:
- Auth0 OIDC:
- PART_A_ACTIVATION (PM2/systemd + live + ready): RUNTIME_UNKNOWN
- AUTHENTICATED_PROVIDER_ACCEPTANCE (existing OIDC/NeedLogin): RUNTIME_UNKNOWN
- Workflow A:
- Workflow B:
- Owner isolation:

`current` records only the offline selected release. It is not deployment
acceptance. Until an authorized operator supplies runtime evidence, production
database, PM2/systemd, Nginx, and provider results remain `RUNTIME_UNKNOWN` and
must not be promoted to PASS from GitHub/CI evidence alone.

## Recovery

- Pre-release backup hash:
- Persistent document hash:
- Representative database state:
- Approved previous supported release SHA: `666f40309b42f2c0d44e4fd6ecbcd1e81f869a8d`
- Rollback compatibility integration: CI_PASS at remediation baseline
  `8d54b7357c232d44c13b2015e80de1a68c403577`; this is compatibility evidence,
  not production rollback authorization
- Rollback compatibility CI run: GitHub Actions run `34978478048`,
  `postgres-schema` job `104412266657`: PASS
- Production rollback authorized: NO
- Controlled ECS reboot:
- Post-reboot PostgreSQL/Nginx/PM2/Node/live/ready:
- Post-reboot database and document hashes:

## Final status

### Final remediation code candidate

- Plan SHA-256: `9d68d0d1642809f7893eedb70cf8536b23c267dbc8468a3c9c9768cdccb623f6`
- PDF parser root cause: production artifact pruning omitted the dynamically
  resolved `pdfjs-dist` runtime package and standard-font assets.
- Local/unit verification: PASS — `npm test -- --runInBand`: 195 suites
  passed, 9 environment-gated suites skipped; 1,099 tests passed, 55 skipped.
- Lint and combined type-check: PASS
- Full production build: PASS via repository `scripts/build.sh`; 467 packages
  copied, zero failures.
- Artifact closure/startup/frontend/health/shutdown: PASS; packaged PDF parser
  regression: 23 pages and 2,323 non-empty parsed blocks.
- Disposable PostgreSQL/Nginx verification: delegated to required CI jobs
- Migration diff: EMPTY
- Production deployment: NOT_EXECUTED
- Production revalidation: NOT_EXECUTED
- Production rollback authorized: NO
- E2E-10: BLOCKED_BY_AUTHORIZATION
- Handoff target: `P3_REMEDIATION_CODE_READY_FOR_CONTROLLER_REVIEW`

P3_ACCEPTED=NO
P3_ACCEPTED_CLOSED=NO
STOP_FOR_CHATGPT_REVIEW=YES
