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

- Current Stable Phase: Phase C2 — Context Builder
- Stable Status: ACCEPTED / FROZEN (`PHASE_C2_ACCEPTED`)
- Stable Branch: `main`
- Stable Main Commit: `54655ec326e8c60324b8ab160db580768212204e` (latest accepted main governance state)
- Latest Final Acceptance Report: [PHASE_C2_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_C2_FINAL_ACCEPTANCE_REPORT.md)
- Stable frozen state: Phase A, Phase B0, Phase B1, Phase C1, and Phase C2 are completed/frozen by project records

## Current development

- Current Development Phase: Phase C3 — Chunking
- Current Development Branch: `phase/c3-chunking`
- Current Phase Status: `PHASE_C3_REVIEW_CANDIDATE; PHASE_C2_ACCEPTED_CLOSED`
- Phase C3 Review Candidate Commit: `728e8e2`
- Phase C2 Accepted Implementation Commit: `5cda43f`
- Phase C1 Accepted Implementation Commit: `4d95db8`
- Phase C1 Accepted Tag: `phase-c1-accepted`
- Phase C2 Accepted PR: [#1 Phase C2: Context Builder](https://github.com/booom12133/academic-writing-platform/pull/1) — MERGED
- Phase C2 Accepted Tag: `phase-c2-accepted` — annotated tag points to the final accepted main state `85ff344`
- Latest Final Acceptance Report: [PHASE_C2_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_C2_FINAL_ACCEPTANCE_REPORT.md)

## Completed phases

- Phase A: DONE / FROZEN
- Phase B0: DONE / FROZEN
- Phase B1: ACCEPTED / FROZEN
- Phase C1: ACCEPTED / FROZEN
- Phase C2: ACCEPTED / FROZEN

## Current Phase goal

Convert one validated C2 `TaskContext` and an explicit `ChunkingPolicy` into a deterministic, lossless, model-agnostic, structure-aware `ChunkedTaskContext` using Unicode code-point sizing and zero overlap.

## Current Phase implemented items

- Independent `ChunkingModule` exporting `ChunkingService`, intentionally not registered in `AppModule`, `AiToolsModule`, or `TasksModule`.
- C3 input contract for one C2 `TaskContext` plus `{ maxSize }`, with output policy explicitly recording version `1`, Unicode code-point sizing, and overlap `0`.
- Deterministic source-order greedy packing with stable zero-padded chunk IDs and mandatory section boundaries.
- Atomic preservation of heading, table, code, and formula units, including standalone oversized atomic chunks and deterministic warnings.
- Lossless paragraph/list-item fragmentation with Unicode code-point spans and newline/sentence/whitespace/hard-boundary priority.
- Fragment items contain only required provenance and metadata; they do not carry a complete `ContextUnit` or original block text.
- Defensive copying, C3 runtime validation, instruction/evidence separation, and no filesystem/network/database/LLM integration.

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
- DeepSeek API calls during C2 verification: 0.

## Frozen components / interfaces

- `client/**`
- `server/modules/document-parsing/**`
- `shared/api.interface.ts`
- `server/app.module.ts`
- `server/modules/ai-tools/**`
- `server/modules/tasks/**`
- `server/database/schema.ts`
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
- Report index and naming rules: [docs/reviews/README.md](docs/reviews/README.md)

## Next Phase

- Next Phase: Phase C4 — File Integration
- Next Phase Status: PLANNED; not authorized and not started.
- Next Phase Goal: Record only; do not enter C4 before explicit design approval and C3 acceptance.
