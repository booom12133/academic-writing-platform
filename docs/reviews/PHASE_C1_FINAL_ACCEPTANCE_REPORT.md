# Phase C1 Final Acceptance Report

## 1. Executive Summary

- Phase: Phase C1 — Document Parsing Foundation
- Final Decision: `PHASE_C1_ACCEPTED`
- Final Status: ACCEPTED / FROZEN
- Accepted Implementation Commit: `4d95db8`
- Accepted Tag: `phase-c1-accepted`

Phase C1 is the one-time GitHub bootstrap accepted baseline. Its implementation was completed before a GitHub remote was configured, and the upstream ChatGPT review explicitly returned `PHASE_C1_ACCEPTED`.

## 2. Scope

```text
Buffer + safe metadata
  → DocumentParserService
  → Parser Adapters
  → ParsedDocument
```

Supported inputs are DOCX, PDF, TXT, and Markdown. The implementation remains isolated from upload, storage, task, AI, OCR, and RAG integration.

## 3. Pre-C1 Baseline Repair

The original Windows build failure came from POSIX-style `NODE_ENV=production` script syntax. The scripts were repaired to use `cross-env NODE_ENV=production`; the existing direct development dependency is `cross-env 10.1.0`. This repair made no business-source changes.

The repaired baseline passed:

- 13 suites / 75 tests
- Lint
- Server type-check
- Client type-check
- Server build
- Client build

## 4. Dependencies

The parser adapters use the following CommonJS/Jest-compatible versions:

- `mammoth 1.12.2`
- `htmlparser2 9.1.0`
- `pdfjs-dist 3.11.174`
- `marked 4.3.0`

## 5. ParsedDocument Architecture

The contract contains:

```text
source
title
blocks
outline
referenceSection
plainText
metadata
warnings
```

`blocks` is the single source of truth. `plainText`, `outline`, and `referenceSection` are deterministically derived from normalized blocks, with deterministic block IDs and ordering.

## 6. Parser Results

- DOCX: PASS — title, headings, paragraphs, lists, and tables.
- PDF: PASS — selectable text, page provenance, and no-selectable-text rejection.
- TXT: PASS — UTF-8, BOM, CRLF/LF normalization, and paragraph recovery.
- Markdown: PASS — headings, paragraphs, lists, code, tables, and display formulas.

## 7. Security

The frozen boundary includes:

- 25 MiB Buffer limit.
- Extension whitelist and MIME conflict validation.
- PDF and DOCX signature validation.
- Fatal invalid UTF-8 decoding.
- No arbitrary server-path input.
- No temporary-file requirement.
- No OCR.
- No code execution.

## 8. Frozen Boundary Verification

The C1 feature implementation did not modify:

```text
client/**
shared/api.interface.ts
server/app.module.ts
server/modules/ai-tools/**
server/modules/tasks/**
server/database/schema.ts
```

The following B1 components remain frozen and unchanged:

```text
SkillLoader
SkillRegistry
SkillComposer
InvariantValidator
InvariantExtractor
PolishGenerator
PaperRevisionGenerator
TopicGenerationGenerator
DeepSeekProvider
LlmService
```

## 9. Tests

- C1 targeted: 7 suites / 31 tests PASS
- Full regression: 20 suites / 106 tests PASS
- Original B1 regression: 75/75 PASS
- Lint: PASS
- Server type-check: PASS
- Client type-check: PASS
- Server build: PASS
- Client build: PASS
- DeepSeek API calls during C1: 0

The final verification was rerun on `main` after the C1 closeout merge.

## 10. Explicitly Out of Scope

The following remain unimplemented:

- C2 Context Builder
- C3 Long-document Chunking
- C4 File Integration
- Frontend file integration
- Backend upload integration
- Polish file integration
- Revision file integration
- OCR
- RAG

## 11. Key Decisions

- C1 is the one-time accepted GitHub bootstrap baseline.
- The existing B1 historical acceptance reports are preserved at the project root.
- From C2 onward, an unaccepted Phase branch must never enter `main`.
- The accepted tag is the canonical stable pointer because a commit cannot record its own final merge hash.

## 12. Known Non-Blocking Issues

- No real GitHub remote is configured yet; the accepted tag and stable baseline are currently local.
- The client build retains existing non-blocking bundle-size and module-type warnings.

## 13. Final Decision

```text
PHASE_C1_ACCEPTED
```

Next Phase: Phase C2 — Context Builder (`NOT_STARTED`; record only, not implemented).
