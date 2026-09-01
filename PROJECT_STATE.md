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

- Current Stable Phase: Phase C1 — Document Parsing Foundation
- Stable Status: ACCEPTED / FROZEN (`PHASE_C1_ACCEPTED`)
- Stable Main Commit: canonical pointer is the annotated tag `phase-c1-accepted` on final `main` HEAD; the exact merge hash is intentionally not self-recorded in the merge commit
- Latest Final Acceptance Report: [PHASE_C1_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_C1_FINAL_ACCEPTANCE_REPORT.md)
- Stable frozen state: Phase A, Phase B0, Phase B1, and Phase C1 are completed/frozen by project records

## Current development

- Current Development Phase: Phase C2 — Context Builder
- Current Development Branch: `phase/c2-context-builder`
- Current Phase Status: `IN_PROGRESS / REVIEW_CANDIDATE`
- Current Review Candidate Commit: `5cda43f` (`fix(c2): harden context builder validation`; local post-review fix tip, pending GitHub push)
- Phase C1 Accepted Implementation Commit: `4d95db8`
- Phase C1 Accepted Tag: `phase-c1-accepted`
- Current PR: [#1 Phase C2: Context Builder](https://github.com/booom12133/academic-writing-platform/pull/1) OPEN against `main`; post-review local head `b5bb473` is pushed to `origin/phase/c2-context-builder`.

## Completed phases

- Phase A: DONE / FROZEN
- Phase B0: DONE / FROZEN
- Phase B1: ACCEPTED / FROZEN
- Phase C1: ACCEPTED / FROZEN

## Current Phase goal

Convert one validated C1 `ParsedDocument`, a narrow academic task type, and optional user instructions into a deterministic, provenance-aware `TaskContext` without chunking, truncation, prompt rendering, upload, storage, task submission, OCR, or external AI/service calls.

## Current Phase implemented items

- Independent `ContextBuilderModule` exporting `ContextBuilderService`, intentionally not registered in `AppModule`, `AiToolsModule`, or `TasksModule`.
- Narrow C2 context contract for `'polish' | 'paper-revision'` inputs and `TaskContext` outputs with fixed source ID `document-1`.
- Deterministic one-pass mapping from C1 `document.blocks` into `ContextUnit` records with stable unit IDs, preserved source block IDs/indexes, and no reordering, chunking, filtering, or rewriting.
- Heading-path derivation from preceding heading blocks with ancestor replacement/pop semantics and self-inclusive heading paths for heading blocks.
- Reference-section classification derived only from the optional C1 `referenceSection` bounds; no keyword re-detection or fabricated headings.
- Explicit C2 runtime validation for malformed task input, missing/empty documents, duplicate block IDs, invalid block shapes, invalid reference bounds, and non-object reference sections.
- Preservation of source metadata, warnings, page provenance, table row/cell arrays, and separation between `task.userInstructions` and document evidence.

## Test baseline and current results

- Stable accepted baseline: Phase C1 on `main` remains the frozen accepted implementation baseline.
- Current targeted C2: PASS — `npx jest server/modules/context-builder/context-builder.service.spec.ts --runInBand` → 1 suite / 20 tests.
- Current full regression: PASS — `npm test -- --runInBand` → 21 suites / 126 tests.
- Current lint: PASS.
- Current combined type-check: PASS — `npm run type:check` completed with both server and client subprocesses passing.
- Current server type-check: PASS (covered by `npm run type:check` and the lint pipeline).
- Current client type-check: PASS (covered by `npm run type:check` and the lint pipeline).
- Current server build: PASS.
- Current client build: PASS, with existing non-blocking module-type and chunk-size warnings.
- Current post-review targeted C2: PASS — 44 tests.
- Current post-review full regression: PASS — 21 suites / 150 tests.
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

- Phase C2 is only a review candidate on `phase/c2-context-builder`; it is not accepted, merged into `main`, or tagged.
- Post-review local fix `5cda43f` is committed, verified, and included in the pushed Phase branch; PR #1 remains open and unmerged.
- Targeted/full Jest runs emit the existing non-blocking `ts-jest` `TS151001` `esModuleInterop` warning.
- `npm test -- --runInBand` logs expected DeepSeek provider auth/rate-limit warnings from existing unit tests; DeepSeek API calls remain `0`.
- Client build retains existing non-fatal `[MODULE_TYPELESS_PACKAGE_JSON]` and chunk-size warnings.
- C2 intentionally does not connect frontend files, upload/storage flows, tasks, AI tools, chunking, OCR, retrieval, or multi-document orchestration.

## Do not modify

- Frontend and shared API files during C2.
- Existing B1 and C1 frozen production modules and skills.
- Database schema, migrations, task/file attachment contracts, upload/storage integration, and AI tool integration unless a future Phase explicitly authorizes them.
- Historical acceptance and diagnostic reports.

## Related documents

- Latest C1 final report: [PHASE_C1_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_C1_FINAL_ACCEPTANCE_REPORT.md)
- Historical B1 final report: [PHASE_B1_FINAL_ACCEPTANCE_REPORT.md](PHASE_B1_FINAL_ACCEPTANCE_REPORT.md)
- C2 design context: [2026-09-01-phase-c2-context-builder-design.md](docs/superpowers/specs/2026-09-01-phase-c2-context-builder-design.md)
- Report index and naming rules: [docs/reviews/README.md](docs/reviews/README.md)

## Next Phase

- Next Phase: Phase C2 — Context Builder
- Next Phase Status: CURRENT AUTHORIZED PHASE / IN_PROGRESS / REVIEW_CANDIDATE
- Next Phase Goal: Deterministic context assembly from one validated C1 parsed document for later document-aware tools; do not advance to C3 before explicit C2 acceptance.
