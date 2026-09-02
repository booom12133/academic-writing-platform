# Project State

Last Updated: 2026-09-02

## Project

- Name: 学术写作AI工具平台
- GitHub: [https://github.com/booom12133/academic-writing-platform](https://github.com/booom12133/academic-writing-platform)
- Source of Truth: GitHub
- Stable Branch: `main`
- Git repository: INITIALIZED LOCALLY; local `origin/main` and `origin/phase/c1-document-parsing` tracking refs are present
- Repository-local Git HTTP: `HTTP/1.1`

## Stable state

- Current Stable Phase: Phase C4 — File Integration
- Stable Status: ACCEPTED / FROZEN (`PHASE_C4_ACCEPTED`)
- Stable Branch: `main`
- Stable Main Commit: `ad8ce030ec1195d924efadf174d1bfaaa36357c5` (Phase C4 PR #3 merge commit; final accepted main state is the post-merge closeout commit recorded by `phase-c4-accepted`.)
- Latest Final Acceptance Report: [PHASE_C4_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_C4_FINAL_ACCEPTANCE_REPORT.md)
- Stable frozen state: Phase A, Phase B0, Phase B1, Phase C1, Phase C2, Phase C3, and Phase C4 are completed/frozen by project records

## Current development

- Current Development Phase: Phase D1 — Tool Execution Foundation
- Current Development Branch: `phase/d1-tool-execution-foundation`
- Current Phase Status: `REVIEW_CANDIDATE` / awaiting ChatGPT review and explicit acceptance
- Phase D1 scope: execution contracts, deterministic chunk rendering/aggregation, text/file preparation reuse, provenance, reference pass-through, and preparation-before-billing safety boundary. Existing Polish/Paper Revision production submission flows remain unchanged.
- Phase D1 candidate implementation commit: `cdeafa9`
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
- Latest Final Acceptance Report: [PHASE_C4_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_C4_FINAL_ACCEPTANCE_REPORT.md)

## Completed phases

- Phase A: DONE / FROZEN
- Phase B0: DONE / FROZEN
- Phase B1: ACCEPTED / FROZEN
- Phase C1: ACCEPTED / FROZEN
- Phase C2: ACCEPTED / FROZEN
- Phase C3: ACCEPTED / FROZEN
- Phase C4: ACCEPTED / FROZEN / CLOSED

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

- Stable accepted baseline: Phase C2 on `main` remains the frozen accepted implementation baseline.
- Current targeted D1: PASS — execution preparation, execution aggregation, DI, and contract suites.
- Current full regression: PASS — `npm test -- --runInBand` → 36 suites / 244 tests.
- Current lint: PASS — `npm run lint`.
- Current combined type-check: PASS — `npm run type:check` completed with both server and client subprocesses passing.
- Current server type-check: PASS.
- Current client type-check: PASS.
- Current server build: PASS — `npm run build:server`.
- Current client build: PASS — `npm run build:client`, with existing non-blocking module-type and chunk-size warnings.
- Current full AppModule bootstrap: PASS — `npm run test:app-bootstrap`; built application context resolved `AiToolsModule` and `AcademicToolExecutionService` without a DeepSeek call.
- Current DeepSeek / external AI calls during D1 verification: 0.
- Current npm 10 clean-install dry-run: PASS — `npx --yes npm@10.9.2 ci --ignore-scripts --dry-run --loglevel=error`.
- DeepSeek / external AI calls during C3 verification: 0.

## Frozen components / interfaces

- Client files outside the explicitly authorized C4 paths
- `server/modules/document-parsing/**`
- `server/modules/context-builder/**`
- `server/modules/chunking/**`
- `shared/api.interface.ts`
- `server/modules/ai-tools/**`
- `server/modules/tasks/**`
- `server/database/schema.ts`
- `server/common/filters/exception.filter.ts`
- B1 SkillLoader, SkillRegistry, SkillComposer, InvariantValidator, InvariantExtractor, project skills, generators, DeepSeekProvider, and LlmService
- Existing file-only guards in Polish and Revision generators

## Known issues

- Inherited full self-hosted `AppModule` bootstrap issue: the frozen `SkillLoader` constructor parameter is interpreted by Nest DI as `Object`. This was present unchanged on accepted `main`, was not introduced or fixed by C4, and remains out of scope.
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

- Next Phase: Phase D — Tool Migration
- Next Phase Status: PLANNED / NOT_STARTED / NOT_AUTHORIZED
- Next Phase Goal: Record only; do not enter Phase D without a separate explicit authorization.
