# Project State

Last Updated: 2026-09-06

## Project

- Name: 学术写作AI工具平台
- GitHub: [https://github.com/booom12133/academic-writing-platform](https://github.com/booom12133/academic-writing-platform)
- Source of Truth: GitHub
- Stable Branch: `main`
- Git repository: INITIALIZED LOCALLY; local `origin/main` and `origin/phase/c1-document-parsing` tracking refs are present
- Repository-local Git HTTP: `HTTP/1.1`

## Stable state

- Current Stable Phase: Phase E1 — Knowledge Provenance Foundation
- Stable Status: ACCEPTED / FROZEN / CLOSED (`PHASE_E1_ACCEPTED`)
- Stable Branch: `main`
- Stable Main Commit: final post-merge E1 governance closeout commit, anchored by annotated tag `phase-e1-accepted`
- Latest Final Acceptance Report: [PHASE_E1_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_E1_FINAL_ACCEPTANCE_REPORT.md)
- Stable frozen state: Phase A, Phase B0, Phase B1, Phase C1, Phase C2, Phase C3, Phase C4, Phase D1, Phase D2, Phase D3, Phase D4, and Phase E1 are completed/frozen by project records

## Current development

- Current Development: Phase E2 — Embedding & Index implementation complete on the Review Candidate branch; awaiting ChatGPT GitHub Review.
- Current E2 status: `PHASE_E2_REVIEW_CANDIDATE`; implementation authorized after `PHASE_E2_DESIGN_REVIEW_PASS` and `PHASE_E2_PLAN_REVIEW_PASS`.
- E2 branch: `codex/phase-e2-embedding-index`.
- E2 accepted baseline: `d68331f594f671a1ce0099d008d3aaaa512448b1` (`origin/main`, `phase-e1-accepted`).
- E2 implementation HEAD: `8212070` (`fix(e2): keep version-binding integration fixture valid`).
- E2 PR: [#9 Phase E2 — Embedding & Index](https://github.com/booom12133/academic-writing-platform/pull/9); do not merge before explicit `PHASE_E2_ACCEPTED`.
- E2 scope: independent EmbeddingProvider/config/fake, deterministic semantic fingerprints, pgvector migration 0003, version-bound index lifecycle, bounded batch/retry/resume/re-index orchestration, and PostgreSQL integration coverage. No retrieval or E3 behavior.
- E2 migration boundary: 0001 and 0002 are unchanged; E1 provenance/parser/context-builder/chunker and D4 TextGenerationProvider/DeepSeek are unchanged.
- E2 local verification: targeted E2 PASS — 7 suites / 30 passed; full regression PASS — 68 suites / 401 passed / 8 skipped; lint PASS; combined type-check PASS; server/client build PASS; AppModule bootstrap PASS; static migration checks PASS.
- E2 PostgreSQL verification: integration tests are included in `test:integration:postgres` and CI uses PostgreSQL 16 + pgvector. Local real PostgreSQL execution was not available because `DATABASE_URL` is unset and Docker is unavailable; local integration result is 2 suites / 8 skipped.
- E2 GitHub Actions: run `33977703520` passed both [verify](https://github.com/booom12133/academic-writing-platform/actions/runs/33977703520/job/101337218630) and [postgres-schema](https://github.com/booom12133/academic-writing-platform/actions/runs/33977703520/job/101337218723) on Node 22.23.2/npm 10.9.8. The PostgreSQL job executed the 0001 → 0003 migrations on PostgreSQL 16 + pgvector and passed the E1 regression plus E2 vector persistence/version-binding integration. The preceding run `33977521292` failed only because the first E2 fixture attempted to violate E1's same-document immutable-version fingerprint constraint; commit `8212070` corrected that fixture and the rerun passed.
- Current E1 status: `ACCEPTED / FROZEN / CLOSED` (`PHASE_E1_ACCEPTED`), with PR #8 merged into `main`.
- E1 branch: `codex/phase-e1-task2-database-preflight`
- E1 base SHA: `156eb45e00bb727c69bb891f056f384bb600d415` (`phase-d4-accepted` peeled SHA)
- E1 implementation HEAD: `b6d82f684017cf39d8ef54b883905953dc4d7fe2` (`fix(e1): narrow drizzle version return type`).
- E1 review-candidate HEAD: `ebe9c1826d4a69b3cf8f63f38507fa0919cd293f`.
- E1 PR #8 merge commit: `c763602737927b7f3478443800f0371de2ef8bd5`.
- E1 PR: [#8 Phase E1](https://github.com/booom12133/academic-writing-platform/pull/8).
- E1 scope: standard PostgreSQL provider and versioned Drizzle schema/migrations, C2/C3/C4 neutral seams, pure provenance contracts, user-scoped repository, atomic import/readiness lifecycle, and no E2/indexing behavior.
- E1 verification: full regression PASS — 61 suites / 371 passed / 7 skipped; focused C1-C4/E1 PASS — 24 suites / 197 tests; task/AI regression PASS — 35 suites / 172 tests; lint PASS; combined type-check PASS; server build PASS; client build PASS; AppModule bootstrap PASS; Drizzle migration check PASS; clean `npm ci` PASS with npm 10.9.2 locally.
- E1 final verification evidence: GitHub Actions run [33849094910](https://github.com/booom12133/academic-writing-platform/actions/runs/33849094910) passed both [verify](https://github.com/booom12133/academic-writing-platform/actions/runs/33849094910/job/100947564114) and [postgres-schema](https://github.com/booom12133/academic-writing-platform/actions/runs/33849094910/job/100947563905) on Node 22.23.2/npm 10.9.8. The final evidence records 61 suites / 371 passed / 7 skipped, with lint, combined type-check, server/client build, AppModule bootstrap, and Drizzle migration check passing. The PostgreSQL 16 job used a fresh disposable database and passed the full 0001 → 0002 migration, second-migrate idempotency, schema/constraint checks, and transaction rollback/version lifecycle regressions.
- E1 deployment boundary: no ECS, Miaoda, production PostgreSQL, or E2 changes were made. Self-hosted authentication remains `PRODUCTION_DEPLOYMENT_BLOCKER`.
- E1 production database rollout: not performed; migration apply remains an explicit deployment-gate operation.
- E1 Final Acceptance Preparation Report: [PHASE_E1_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_E1_FINAL_ACCEPTANCE_REPORT.md).
- E1 Final Acceptance: `PHASE_E1_ACCEPTED`; post-merge governance closeout and annotated tag `phase-e1-accepted` are recorded on `main`.
- E1 deployment boundary: self-hosted authentication remains `PRODUCTION_DEPLOYMENT_BLOCKER`; no ECS deployment or production PostgreSQL mutation occurred.
- Next architecture step: complete ChatGPT review of the E2 candidate; E3 is not authorized.
- D3 Status: `ACCEPTED / FROZEN / CLOSED`
- D3 Branch: `phase/d3-paper-revision-migration`
- D3 Implementation Candidate SHA: `6290540811fdfe06af1316a035dc7a5d1466cc02`
- D3 Review Candidate SHA: `2178c90e5f6721e2b9052863d950c90cbda03313`
- D3 Final Acceptance HEAD: `8479fabaaf09ebf72bc428bbdc29f3b791a56989`
- D3 accepted: `YES` (`PHASE_D3_ACCEPTED`)
- D3 merged: `YES` — PR #6 merge commit `4abae19bcd6b5fc5edbb37b544020464a6e0ac98`
- D3 ChatGPT Review Pass ID: `5097012233`
- D3 Final Acceptance Review ID: `5097074648`
- D3 Review: `PHASE_D3_REVIEW_PASS`; `PHASE_D3_IMPLEMENTATION_AUTHORIZED`
- D4 Status: `ACCEPTED / FROZEN / CLOSED` (`PHASE_D4_ACCEPTED`); implementation review `PHASE_D4_REVIEW_PASS`
- D4 Branch: `phase/d4-text-generation-provider-abstraction`
- D4 Base SHA: `cae059e656d17981e5f4bd0116a6c37ab2d9d04e` (`phase-d3-accepted` peeled SHA)
- D4 Reviewed implementation HEAD: `7c4504fc62f3db58459d59d65c0ce0640af91829`
- D4 Final Acceptance Preparation HEAD: `38d4531be24095e258378252cae296458bbae135`
- D4 PR: `#7` merged — merge commit `924af966c1a2cbb1c6c63d6dc9072b8e6cb8ab03`
- D4 architecture: Generator → LlmService → TEXT_GENERATION_PROVIDER → TextGenerationProvider → DeepSeekProvider; DeepSeek remains the sole production provider
- D4 commits: docs-only baseline, token-backed generation boundary, provider identity propagation, provider-neutral chunk metadata, smoke/lint alignment
- D4 focused tests: PASS — 20 suites / 89 tests
- D4 full regression: PASS — 52 suites / 319 tests; inherited Jest open-handle warning only
- D4 lint: PASS
- D4 type-check: PASS — server and client
- D4 smoke TypeScript check: PASS — `npx tsc --noEmit --project tsconfig.smoke.json`
- D4 server build: PASS
- D4 client build: PASS — existing module-type and chunk-size warnings only
- D4 AppModule bootstrap: PASS — `AiToolsModule` execution foundation resolved
- D4 DeepSeek / external AI calls during verification: 0; real DeepSeek smoke scripts were not run during ordinary regression
- D4 frozen-path audit: PASS — PolishChunkExecutor, PaperRevisionChunkExecutor, D2/D3 modules, shared API, ROADMAP, and inherited platform-command spec unchanged
- D4 inherited CI issue: `test/unit/platform-command.spec.ts` remains unchanged and is `INHERITED / KNOWN / ACCEPTED / OUT_OF_SCOPE / NON-BLOCKING FOR D4`
- D4 Final Acceptance Preparation Report: [PHASE_D4_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_D4_FINAL_ACCEPTANCE_REPORT.md)
- D4 Final Acceptance: `PHASE_D4_ACCEPTED`; post-merge governance closeout is recorded on `main`
- D3 base SHA: `31a7002babed73bc325841c5622a2f2e03f38bc4`
- D3 scope: Paper Revision text and prepared-file migration onto the C1 → C2 → C3 → D1 preparation and execution pipeline, with server-owned chunking, fixed billing, asynchronous sequential execution, deterministic aggregation, and frontend structured file-reference submission.
- D3 focused tests: PASS — 8 suites / 35 tests
- D3 full regression: PASS — 50 suites / 306 tests
- D3 lint: PASS
- D3 type-check: PASS — server and client
- D3 server build: PASS
- D3 client build: PASS — existing module-type and chunk-size warnings only
- D3 AppModule bootstrap: PASS — AiToolsModule execution foundation resolved
- D3 automated DeepSeek / external AI calls: 0
- D3 inherited issue: `test/unit/platform-command.spec.ts` unchanged and out of scope
- D3 post-merge governance commit: this closeout commit, final `main` HEAD
- D3 accepted tag: `phase-d3-accepted` — annotated tag points to final `main` HEAD
- D3 Final Acceptance Report: [PHASE_D3_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_D3_FINAL_ACCEPTANCE_REPORT.md)
- Phase D2 scope: Polish text/file migration onto the C1 → C2 → C3 → D1 preparation and execution pipeline, server-owned chunking and billing, asynchronous sequential execution, deterministic aggregation, and frontend structured file-reference submission.
- Phase D2 accepted implementation/final-acceptance HEAD: `56dc2ff48fdf19f3f11ab1cc8270432fda917fd7`
- Phase D2 Final Acceptance: `PHASE_D2_ACCEPTED` (ChatGPT Review ID `5091748366`)
- Phase D2 PR: [#5 Phase D2: Polish Migration](https://github.com/booom12133/academic-writing-platform/pull/5) — MERGED
- Phase D2 PR merge commit: `acfa70a7cc9317946653c4249cb7f2dfad50ab6c`
- Phase D2 post-merge governance commit: this closeout commit, final `main` HEAD
- Phase D2 accepted tag: `phase-d2-accepted` — annotated tag points to final `main` HEAD
- Phase D2 Final Acceptance Report: [PHASE_D2_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_D2_FINAL_ACCEPTANCE_REPORT.md)
- Phase D1 historical accepted baseline: Tool Execution Foundation, accepted/frozen/closed on `main`.
- Phase D1 implementation commit before review fixes: `9903208`
- Phase D1 review head before current fixes: `1999fd5e0f8e0fe35d90658a12fb4e63cd6be8ac`
- Phase D1 current review-fix implementation commit: `3dbab6d`
- Phase D1 accepted candidate/PR head: `ce5f96cdcfded501576e92262d7090dfd9d96ee1`
- Phase D1 PR: [#4 Phase D1: Tool Execution Foundation](https://github.com/booom12133/academic-writing-platform/pull/4) — MERGED
- Phase D1 PR merge commit: `2ee5680169fcf1eeb03816d41a55267d9488e460`
- Phase D1 post-merge governance commit: this closeout commit, final `main` HEAD
- Phase D1 accepted tag: `phase-d1-accepted` — annotated tag points to final `main` HEAD
- Phase D1 Final Acceptance Report: [PHASE_D1_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_D1_FINAL_ACCEPTANCE_REPORT.md)
- Phase C3 Review Candidate Commit: `9f0df1f`
- Phase C3 Accepted Implementation Commit: `728e8e2`
- Phase C3 Acceptance PR: [#2 Phase C3: Chunking](https://github.com/booom12133/academic-writing-platform/pull/2) — MERGED
- Phase C3 Accepted Tag: `phase-c3-accepted` — annotated tag points to the final accepted main state after governance update
- Phase C2 Accepted Implementation Commit: `5cda43f`
- Phase C1 Accepted Implementation Commit: `4d95db8`
- Phase C1 Accepted Tag: `phase-c1-accepted`
- Phase C2 Accepted PR: [#1 Phase C2: Context Builder](https://github.com/booom12133/academic-writing-platform/pull/1) — MERGED
- Phase C2 Accepted Tag: `phase-c2-accepted` — annotated tag points to the final accepted main state `85ff344`
- Phase C4 Accepted PR: [#3 Phase C4: File Integration](https://github.com/booom12133/academic-writing-platform/pull/3) — MERGED
- Phase C4 Accepted Implementation HEAD: `bdc23099a454eb7e257ae3161b213106c89b8bf4`
- Phase C4 Merge Commit: `ad8ce030ec1195d924efadf174d1bfaaa36357c5`
- Phase C4 Accepted Tag: `phase-c4-accepted` — annotated tag points to the final accepted main state after closeout governance.
- Phase C4 Final Acceptance Report: [PHASE_C4_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_C4_FINAL_ACCEPTANCE_REPORT.md)

## Completed phases

- Phase A: DONE / FROZEN
- Phase B0: DONE / FROZEN
- Phase B1: ACCEPTED / FROZEN
- Phase C1: ACCEPTED / FROZEN
- Phase C2: ACCEPTED / FROZEN
- Phase C3: ACCEPTED / FROZEN
- Phase C4: ACCEPTED / FROZEN / CLOSED
- Phase D1: ACCEPTED / FROZEN / CLOSED (`PHASE_D1_ACCEPTED_CLOSED`)
- Phase D2: ACCEPTED / FROZEN / CLOSED (`PHASE_D2_ACCEPTED_CLOSED`)
- Phase D3: ACCEPTED / FROZEN / CLOSED (`PHASE_D3_ACCEPTED_CLOSED`)

## Previous accepted Phase goal (C3)

Phase C3 converted one validated C2 `TaskContext` and an explicit `ChunkingPolicy` into a deterministic, lossless, model-agnostic, structure-aware `ChunkedTaskContext` using Unicode code-point sizing and zero overlap.

## Previous accepted Phase implemented items (C3)

- Independent `ChunkingModule` exporting `ChunkingService`, intentionally not registered in `AppModule`, `AiToolsModule`, or `TasksModule`.
- C3 input contract for one C2 `TaskContext` plus `{ maxSize }`, with output policy explicitly recording version `1`, Unicode code-point sizing, and overlap `0`.
- Deterministic source-order greedy packing with stable zero-padded chunk IDs and mandatory section boundaries.
- Atomic preservation of heading, table, code, and formula units, including standalone oversized atomic chunks and deterministic warnings.
- Lossless paragraph/list-item fragmentation with Unicode code-point spans and newline/sentence/whitespace/hard-boundary priority.
- Fragment items contain only required provenance and metadata; they do not carry a complete `ContextUnit` or original block text.
- Defensive copying, C3 runtime validation, instruction/evidence separation, and no filesystem/network/database/LLM integration.

## Accepted Phase goal (C4)

Integrate one explicit user-triggered multipart document upload with selectable
durable storage and a server-side validated preparation path into the frozen
C1 → C2 → C3 pipeline, without creating an AI task or deducting points in
file mode. C4 self-hosted acceptance uses filesystem storage.

## Accepted Phase implemented items (C4)

- Actual dependency preflight completed against `@lark-apaas/fullstack-nestjs-core@1.1.60`, `@lark-apaas/file-service@0.1.2`, and Multer `2.0.2`; platform mode remains supported but is optional for self-hosted acceptance.
- The verified platform import is `@lark-apaas/fullstack-nestjs-core`; its Nest `FileService` provider is registered by global `PlatformModule.forRoot()`.
- Verified API contract: `getDefaultBucket(): Promise<string>`, `from(bucket).upload(Buffer, options)`, `from(bucket).download(path)` returning a PromiseLike result with `Blob` content, and `from(bucket).remove(string[])`. App identity is acquired internally by the platform FileService from request context; Buffer upload is supported.
- Added `DocumentInputRef` / `DocumentInputDescriptor`, C4 storage port, platform adapter, explicit unavailable local adapter, upload controller, and controller-local C4 exception filter.
- Upload validates through frozen C1 before persistence, persists the original durably, returns metadata-only descriptor evidence, and best-effort compensates partial persistence with remove.
- `prepare()` treats every client ref field as untrusted, validates version/provider, default bucket, generated path grammar, user scope, path-derived filename/extension/source type, optional MIME, downloaded size, and recomputed SHA-256 before frozen C1 → C2 → C3.
- Polish and Paper Revision file mode now retains a selected File locally and uploads only after explicit `上传并准备文档`; it stores the returned ref and stops without `/api/ai-tools/submit`, task creation, generator execution, or point deduction. Re-selection clears client descriptor/ref state without deleting persisted originals. Text mode remains on existing `submitTask` behavior.
- Added `DOCUMENT_STORAGE_DRIVER=filesystem` with an absolute non-public `DOCUMENT_STORAGE_ROOT`, a durable self-hosted filesystem adapter, strict generated-key/root containment, exact-object compensation removal, and provider identity `self-hosted-filesystem`.
- Filesystem mode wires the filesystem adapter without `PlatformModule.forRoot()` or a `FileService` provider; invalid driver/root configuration fails clearly. Platform mode continues to use the preflight-confirmed FileService adapter.

## Accepted Phase verification (C4)

- Targeted C4 server: PASS — `npx jest server/modules/document-input --runInBand` → 8 suites / 45 tests.
- Targeted client multipart API: PASS — `npx jest test/unit/document-input-client.spec.ts --runInBand` → 1 test.
- Full regression: PASS — `npm test -- --runInBand` → 31 suites / 235 tests.
- Lint: PASS — `npm run lint`.
- Type-check: PASS — `npm run type:check`.
- Server build: PASS — `npm run build:server`.
- Client build: PASS — `npm run build:client`, with existing non-blocking module-type and chunk-size warnings.
- Dependency dry-run: PASS — `npx --yes npm@10.9.2 ci --ignore-scripts --dry-run --loglevel=error`.
- Self-hosted server smoke: PASS — on the user's real CentOS 8 Linux server using Node v22.23.2 and npm 10.9.8, filesystem mode wrote and read the synthetic `c4-smoke-test.md` below `/var/lib/academic-writing-platform/documents`; size and SHA-256 matched; `DocumentInputService.prepare()` completed C1 → C2 → C3 successfully. The storage root was outside the public web root, no public URL was created, and no `FORCE_AUTHN_INNERAPI_DOMAIN` or DeepSeek/LLM call was used.
- Self-hosted smoke evidence: HTTP `201`; provider and bucket `self-hosted-filesystem`; file size `138`; SHA-256 `54226ccee52283fc2b751ef107a9e1de7936241c4ab575e2d1113fbe7ba5e2d3`; upload-time C1 title `C4 Smoke Test`, `6` blocks, `1` warning; prepare summary `6` blocks, `3` chunks, `88` content code points, `31` reference code points; byte-for-byte comparison exit code `0`.
- Self-hosted smoke harness: auth mode `repository local-development test harness`; database mode `repository LocalDevelopmentDatabaseModule test harness`; storage mode `real self-hosted Linux filesystem`. This proves the C4 document-input runtime contract, not production self-hosted authentication, production PostgreSQL deployment, or full self-hosted production readiness.
- Full self-hosted AppModule bootstrap issue: the frozen `SkillLoader` constructor parameter is interpreted by Nest DI as `Object`. This is inherited unchanged from accepted `main`, is outside C4 scope, and was documented only; it does not invalidate the isolated C4 DocumentInput runtime contract smoke.
- Review fixes: path validation now rejects raw backslashes and case-insensitive `%2F`/`%5C` before bucket/download access, with canonical path reconstruction; the C4 filter now catches only `DocumentInputError` and Nest `PayloadTooLargeException`.
- GitHub Actions runs `33555613324`, `33555570549`, `33592919434`, and `33592921452`: all failed only in `Full tests` at `test/unit/platform-command.spec.ts › commandForPlatform › uses npm cli scripts when npm provides its executable path`; Ubuntu expected `/opt/hostedtoolcache/node/22.23.2/x64/bin/node` but received `npx.cmd`. This remains the accepted inherited Windows-path fixture issue and was not changed.
- DeepSeek / external AI calls during C4 verification: 0.

## Test baseline and current results

- Stable accepted baseline: Phase D2 on `main` is the current frozen accepted implementation baseline.
- Current focused D2 tests: PASS — 8 suites / 27 tests.
- Current full regression: PASS — `npm test -- --runInBand` → 44 suites / 274 tests.
- Current lint: PASS — `npm run lint`.
- Current combined type-check: PASS — `npm run type:check` completed with both server and client subprocesses passing.
- Current server type-check: PASS.
- Current client type-check: PASS.
- Current server build: PASS — `npm run build:server`.
- Current client build: PASS — `npm run build:client`, with existing non-blocking module-type and chunk-size warnings.
- Current full AppModule bootstrap: PASS — `npm run test:app-bootstrap`; built application context resolved `AiToolsModule` and `AcademicToolExecutionService` without a DeepSeek call.
- Current DeepSeek / external AI calls during D2 verification: 0.
- Inherited GitHub Actions issue: `test/unit/platform-command.spec.ts` remains unchanged and out of scope; local Windows full regression passes.

## Frozen components / interfaces

- Client files outside the explicitly authorized C4 paths
- `server/modules/document-parsing/**`
- `server/modules/context-builder/**`
- `server/modules/chunking/**`
- `shared/api.interface.ts`
- Existing `server/modules/ai-tools/**` production flows remain frozen except for the D1-authorized execution foundation and minimal DI/bootstrap bindings.
- `server/modules/tasks/**`
- `server/database/schema.ts`
- `server/common/filters/exception.filter.ts`
- Existing B1 SkillLoader, SkillRegistry, SkillComposer, InvariantValidator, InvariantExtractor, project skills, generators, DeepSeekProvider, and LlmService behavior remains frozen; D1 only changes the runtime DI registration for SkillLoader and InvariantValidator.
- Existing file-only guards in Polish and Revision generators

## Known issues

- Historical C4 report: the inherited full self-hosted `AppModule` bootstrap issue interpreted the SkillLoader constructor parameter as `Object`. D1 resolves this through explicit runtime DI factories; the historical C4 report remains unchanged.
- Targeted/full Jest runs emit the existing non-blocking `ts-jest` `TS151001` `esModuleInterop` warning.
- `npm test -- --runInBand` logs expected DeepSeek provider auth/rate-limit warnings from existing unit tests; DeepSeek API calls remain `0`.
- Client build retains existing non-fatal `[MODULE_TYPELESS_PACKAGE_JSON]` and chunk-size warnings.
- On Windows, the aggregate `npm run build` wrapper remains non-portable because it invokes `./scripts/build.sh`; D1 verification therefore runs the existing `build:server` and `build:client` scripts directly, both passing.
- GitHub Actions `verify` may fail on the pre-existing `test/unit/platform-command.spec.ts` Windows-path fixture when running on Linux; the local Windows full regression passes. This unrelated cross-platform baseline issue is intentionally not changed in Phase C3.
- C3 intentionally does not connect frontend files, upload/storage flows, tasks, AI tools, prompt rendering, tokenizer/model windows, OCR, retrieval, or multi-document orchestration.

## Do not modify

- Frontend and shared API files during C2.
- Existing B1 and C1 frozen production modules and skills.
- Database schema, migrations, task/file attachment contracts, upload/storage integration, and AI tool integration unless a future Phase explicitly authorizes them.
- Historical acceptance and diagnostic reports.

## Related documents

- Latest C1 final report: [PHASE_C1_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_C1_FINAL_ACCEPTANCE_REPORT.md)
- Historical B1 final report: [PHASE_B1_FINAL_ACCEPTANCE_REPORT.md](PHASE_B1_FINAL_ACCEPTANCE_REPORT.md)
- C2 design context: [2026-09-01-phase-c2-context-builder-design.md](docs/superpowers/specs/2026-09-01-phase-c2-context-builder-design.md)
- C2 final acceptance report: [PHASE_C2_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_C2_FINAL_ACCEPTANCE_REPORT.md)
- C3 design: [2026-09-02-phase-c3-chunking-design.md](docs/superpowers/specs/2026-09-02-phase-c3-chunking-design.md)
- C3 implementation plan: [2026-09-02-phase-c3-chunking-plan.md](docs/superpowers/plans/2026-09-02-phase-c3-chunking-plan.md)
- C3 final acceptance report: [PHASE_C3_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_C3_FINAL_ACCEPTANCE_REPORT.md)
- C4 design: [2026-09-02-phase-c4-file-integration-design.md](docs/superpowers/specs/2026-09-02-phase-c4-file-integration-design.md)
- C4 implementation plan: [2026-09-02-phase-c4-file-integration-plan.md](docs/superpowers/plans/2026-09-02-phase-c4-file-integration-plan.md)
- Report index and naming rules: [docs/reviews/README.md](docs/reviews/README.md)

## Next Phase

- Next Phase: E2 — Review Candidate
- Next Phase Status: `PHASE_E2_REVIEW_CANDIDATE`; awaiting ChatGPT GitHub Review; not accepted and not merged.
- Next Phase Goal: Embedding and version-bound pgvector index materialization over E1 persisted knowledge data; retrieval remains E3 and is not authorized.
