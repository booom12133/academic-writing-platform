# Project State

Last Updated: 2026-09-01

## Project

- Name: 学术写作AI工具平台
- GitHub: NOT CONFIGURED (local repository bootstrap completed; no remote URL available)
- Git repository: INITIALIZED LOCALLY

## Stable state

- Current Stable Phase: Phase B1
- Stable Status: ACCEPTED according to the existing B1 final acceptance evidence; no accepted GitHub main commit exists yet
- Stable Main Commit: UNKNOWN (repository was created after the historical B1 work)
- Latest Final Acceptance Report: [PHASE_B1_FINAL_ACCEPTANCE_REPORT.md](PHASE_B1_FINAL_ACCEPTANCE_REPORT.md)
- Stable frozen state: Phase A, Phase B0, and Phase B1 are treated as completed/frozen by the existing project records

## Current development

- Current Development Phase: Phase C1 — Document Parsing Foundation
- Current Development Branch: `phase/c1-document-parsing`
- Current Phase Status: `REVIEW_CANDIDATE_PENDING_UPSTREAM_REVIEW`
- Current Review Candidate Commit: NOT YET CREATED (will be populated after the first Phase branch commit)
- Current PR: NOT CONFIGURED (no GitHub remote)

## Completed phases

- Phase A: DONE / FROZEN
- Phase B0: DONE / FROZEN
- Phase B1: ACCEPTED / FROZEN

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

- GitHub remote, GitHub PR, and CI history are not configured yet.
- The current Phase C1 implementation is locally review-ready but has not received the upstream ChatGPT/GitHub review decision; it is not marked accepted here.
- Client build retains existing non-fatal warnings.
- C1 intentionally does not connect frontend files, backend multipart upload, storage, tasks, Polish/Revision integration, Context Builder, chunking, RAG, or OCR.

## Do not modify

- Frontend and shared API files during C1.
- Existing B1 frozen production modules and skills.
- Database schema, migrations, task/file attachment contracts, and AI tool integration unless a future Phase explicitly authorizes them.
- Historical acceptance and diagnostic reports.

## Related documents

- Latest B1 final report: [PHASE_B1_FINAL_ACCEPTANCE_REPORT.md](PHASE_B1_FINAL_ACCEPTANCE_REPORT.md)
- C1 review/design context: [PHASE_C1_CODE_REVIEW.md](PHASE_C1_CODE_REVIEW.md)
- Report index and naming rules: [docs/reviews/README.md](docs/reviews/README.md)

## Next Phase

- Next Phase: Phase C2
- Next Phase Goal: NOT YET AUTHORIZED / record only; do not implement until C1 is explicitly accepted and closed out.
