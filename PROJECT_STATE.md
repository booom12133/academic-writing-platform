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

- Current Stable Phase: Phase C3 — Chunking
- Stable Status: ACCEPTED / FROZEN (`PHASE_C3_ACCEPTED`)
- Stable Branch: `main`
- Stable Main Commit: `e97a4372dd265429006aef0675ae7e399b862762` (Phase C3 acceptance merge)
- Latest Final Acceptance Report: [PHASE_C3_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_C3_FINAL_ACCEPTANCE_REPORT.md)
- Stable frozen state: Phase A, Phase B0, Phase B1, Phase C1, Phase C2, and Phase C3 are completed/frozen by project records

## Current development

- Current Development Phase: Phase C4 — File Integration
- Current Development Branch: `phase/c4-file-integration`
- Current Phase Status: `PHASE_C4_REVIEW_BLOCKED_PLATFORM_RUNTIME`
- Phase C3 Review Candidate Commit: `9f0df1f`
- Phase C3 Accepted Implementation Commit: `728e8e2`
- Phase C3 Acceptance PR: [#2 Phase C3: Chunking](https://github.com/booom12133/academic-writing-platform/pull/2) — MERGED
- Phase C3 Accepted Tag: `phase-c3-accepted` — annotated tag points to the final accepted main state after governance update
- Phase C2 Accepted Implementation Commit: `5cda43f`
- Phase C1 Accepted Implementation Commit: `4d95db8`
- Phase C1 Accepted Tag: `phase-c1-accepted`
- Phase C2 Accepted PR: [#1 Phase C2: Context Builder](https://github.com/booom12133/academic-writing-platform/pull/1) — MERGED
- Phase C2 Accepted Tag: `phase-c2-accepted` — annotated tag points to the final accepted main state `85ff344`
- Latest Final Acceptance Report: [PHASE_C3_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_C3_FINAL_ACCEPTANCE_REPORT.md)

## Completed phases

- Phase A: DONE / FROZEN
- Phase B0: DONE / FROZEN
- Phase B1: ACCEPTED / FROZEN
- Phase C1: ACCEPTED / FROZEN
- Phase C2: ACCEPTED / FROZEN
- Phase C3: ACCEPTED / FROZEN

## Stable Phase goal (C3)

Phase C3 converted one validated C2 `TaskContext` and an explicit `ChunkingPolicy` into a deterministic, lossless, model-agnostic, structure-aware `ChunkedTaskContext` using Unicode code-point sizing and zero overlap.

## Stable Phase implemented items (C3)

- Independent `ChunkingModule` exporting `ChunkingService`, intentionally not registered in `AppModule`, `AiToolsModule`, or `TasksModule`.
- C3 input contract for one C2 `TaskContext` plus `{ maxSize }`, with output policy explicitly recording version `1`, Unicode code-point sizing, and overlap `0`.
- Deterministic source-order greedy packing with stable zero-padded chunk IDs and mandatory section boundaries.
- Atomic preservation of heading, table, code, and formula units, including standalone oversized atomic chunks and deterministic warnings.
- Lossless paragraph/list-item fragmentation with Unicode code-point spans and newline/sentence/whitespace/hard-boundary priority.
- Fragment items contain only required provenance and metadata; they do not carry a complete `ContextUnit` or original block text.
- Defensive copying, C3 runtime validation, instruction/evidence separation, and no filesystem/network/database/LLM integration.

## Current Phase goal (C4)

Integrate one explicit user-triggered multipart document upload with durable
platform FileService storage and a server-side validated preparation path into
the frozen C1 → C2 → C3 pipeline, without creating an AI task or deducting
points in file mode.

## Current Phase implemented items (C4)

- Actual dependency preflight completed against `@lark-apaas/fullstack-nestjs-core@1.1.60`, `@lark-apaas/file-service@0.1.2`, and Multer `2.0.2`.
- The verified platform import is `@lark-apaas/fullstack-nestjs-core`; its Nest `FileService` provider is registered by global `PlatformModule.forRoot()`.
- Verified API contract: `getDefaultBucket(): Promise<string>`, `from(bucket).upload(Buffer, options)`, `from(bucket).download(path)` returning a PromiseLike result with `Blob` content, and `from(bucket).remove(string[])`. App identity is acquired internally by the platform FileService from request context; Buffer upload is supported.
- Added `DocumentInputRef` / `DocumentInputDescriptor`, C4 storage port, platform adapter, explicit unavailable local adapter, upload controller, and controller-local C4 exception filter.
- Upload validates through frozen C1 before persistence, persists the original durably, returns metadata-only descriptor evidence, and best-effort compensates partial persistence with remove.
- `prepare()` treats every client ref field as untrusted, validates version/provider, default bucket, generated path grammar, user scope, path-derived filename/extension/source type, optional MIME, downloaded size, and recomputed SHA-256 before frozen C1 → C2 → C3.
- Polish and Paper Revision file mode now retains a selected File locally and uploads only after explicit `上传并准备文档`; it stores the returned ref and stops without `/api/ai-tools/submit`, task creation, generator execution, or point deduction. Re-selection clears client descriptor/ref state without deleting persisted originals. Text mode remains on existing `submitTask` behavior.

## Current Phase verification (C4)

- Targeted C4 server: PASS — `npx jest server/modules/document-input --runInBand` → 5 suites / 27 tests.
- Targeted client multipart API: PASS — `npx jest test/unit/document-input-client.spec.ts --runInBand` → 1 test.
- Full regression: PASS — `npm test -- --runInBand` → 28 suites / 217 tests.
- Lint: PASS — `npm run lint`.
- Type-check: PASS — `npm run type:check`.
- Server build: PASS — `npm run build:server`.
- Client build: PASS — `npm run build:client`, with existing non-blocking module-type and chunk-size warnings.
- Dependency dry-run: PASS — `npx --yes npm@10.9.2 ci --ignore-scripts --dry-run --loglevel=error`.
- Platform runtime smoke: BLOCKED — the real PlatformModule startup attempt stopped because this environment has no `FORCE_AUTHN_INNERAPI_DOMAIN`; no local unavailable-adapter result is being counted as platform evidence. Status remains `PHASE_C4_REVIEW_BLOCKED_PLATFORM_RUNTIME`.
- Review fixes: path validation now rejects raw backslashes and case-insensitive `%2F`/`%5C` before bucket/download access, with canonical path reconstruction; the C4 filter now catches only `DocumentInputError` and Nest `PayloadTooLargeException`.
- GitHub Actions runs `33555613324` and `33555570549`: both failed only in `Full tests` at `test/unit/platform-command.spec.ts › commandForPlatform › uses npm cli scripts when npm provides its executable path`; Ubuntu expected `/opt/hostedtoolcache/node/22.23.2/x64/bin/node` but received `npx.cmd`. This remains the accepted inherited Windows-path fixture issue and was not changed.
- DeepSeek / external AI calls during C4 verification: 0.

## Test baseline and current results

- Stable accepted baseline: Phase C2 on `main` remains the frozen accepted implementation baseline.
- Current targeted C3: PASS — `npx jest server/modules/chunking/chunking.service.spec.ts --runInBand` → 39 tests.
- Current full regression: PASS — `npm test -- --runInBand` → 22 suites / 189 tests.
- Current lint: PASS — `npm run lint`.
- Current combined type-check: PASS — `npm run type:check` completed with both server and client subprocesses passing.
- Current server type-check: PASS.
- Current client type-check: PASS.
- Current server build: PASS — `npm run build:server`.
- Current client build: PASS — `npm run build:client`, with existing non-blocking module-type and chunk-size warnings.
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

- Targeted/full Jest runs emit the existing non-blocking `ts-jest` `TS151001` `esModuleInterop` warning.
- `npm test -- --runInBand` logs expected DeepSeek provider auth/rate-limit warnings from existing unit tests; DeepSeek API calls remain `0`.
- Client build retains existing non-fatal `[MODULE_TYPELESS_PACKAGE_JSON]` and chunk-size warnings.
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
- Next Phase Status: PLANNED; not authorized.
- Next Phase Goal: Record only; do not enter Phase D before explicit C4 acceptance and closeout.
