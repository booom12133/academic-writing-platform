# Project State

Last Updated: 2026-09-01

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

- Current Development Phase: NONE — C1 closeout complete; waiting for authorized Phase C2 design
- Current Development Branch: `main`
- Current Phase Status: `PHASE_C1_ACCEPTED_CLOSED; PHASE_C2_NOT_STARTED`
- Current Review Candidate Commit: `4d95db8` (`docs(c1): record review candidate state`; accepted C1 implementation baseline)
- Phase C1 Accepted Implementation Commit: `4d95db8`
- Phase C1 Accepted Tag: `phase-c1-accepted`
- Current PR: C1 PR NOT REQUIRED — one-time bootstrap accepted phase.

## Completed phases

- Phase A: DONE / FROZEN
- Phase B0: DONE / FROZEN
- Phase B1: ACCEPTED / FROZEN
- Phase C1: ACCEPTED / FROZEN

## Current Phase goal

Build an isolated Buffer + safe metadata document parsing foundation for DOCX, PDF, TXT, and Markdown, returning deterministic `ParsedDocument` values without upload, storage, task, AI, OCR, or RAG integration.

## Current Phase implemented items

- Deterministic `ParsedDocument` contract, draft contract, parser interface, error model, and normalizer.
- DOCX structured parsing through Mammoth and htmlparser2.
- PDF selectable-text parsing with page provenance and simplified layout warning.
- TXT UTF-8 parsing with BOM/CRLF handling and fatal invalid encoding rejection.
- Markdown token parsing with headings, lists, code blocks, tables, and display formulas.
- Extension, MIME, size, signature, path-metadata, corrupt-document, password-PDF, and no-selectable-text protections.
- Independent `DocumentParsingModule`, intentionally not imported into `AppModule` or AI tools.

## Test baseline and current results

- Pre-C1 baseline: 13 suites / 75 tests PASS; lint, server/client type-check and server/client build PASS after the Windows `cross-env` script repair.
- Current targeted C1: 7 suites / 31 tests PASS.
- Current full regression: 20 suites / 106 tests PASS.
- Current lint: PASS.
- Current server type-check: PASS.
- Current client type-check: PASS.
- Current server build: PASS.
- Current client build: PASS, with existing non-blocking bundle-size/module-type warnings.
- DeepSeek API calls during C1: 0.

## Frozen components / interfaces

- `shared/api.interface.ts`
- `server/app.module.ts`
- `server/modules/ai-tools/**`
- `server/modules/tasks/**`
- `server/database/schema.ts`
- B1 SkillLoader, SkillRegistry, SkillComposer, InvariantValidator, InvariantExtractor, project skills, generators, DeepSeekProvider, and LlmService
- Existing file-only guards in Polish and Revision generators

## Known issues

- Phase C1 is accepted and frozen under the explicit upstream decision `PHASE_C1_ACCEPTED`.
- GitHub remote is configured and the accepted C1 baseline has been pushed.
- `main` is the stable accepted branch.
- `phase-c1-accepted` remains the canonical C1 acceptance tag.
- Phase C2 remains `NOT_STARTED`.
- Client build retains existing non-fatal warnings.
- C1 intentionally does not connect frontend files, backend multipart upload, storage, tasks, Polish/Revision integration, Context Builder, chunking, RAG, or OCR.

## Do not modify

- Frontend and shared API files during C1.
- Existing B1 frozen production modules and skills.
- Database schema, migrations, task/file attachment contracts, and AI tool integration unless a future Phase explicitly authorizes them.
- Historical acceptance and diagnostic reports.

## Related documents

- Latest C1 final report: [PHASE_C1_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_C1_FINAL_ACCEPTANCE_REPORT.md)
- Historical B1 final report: [PHASE_B1_FINAL_ACCEPTANCE_REPORT.md](PHASE_B1_FINAL_ACCEPTANCE_REPORT.md)
- C1 review/design context: [PHASE_C1_CODE_REVIEW.md](PHASE_C1_CODE_REVIEW.md)
- Report index and naming rules: [docs/reviews/README.md](docs/reviews/README.md)

## Next Phase

- Next Phase: Phase C2 — Context Builder
- Next Phase Status: NOT STARTED
- Next Phase Goal: NOT YET AUTHORIZED / record only; do not implement until upstream design approval is provided.
