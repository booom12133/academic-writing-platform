# Project Roadmap

Only established project phases are listed here. E1, E2, and E3 are accepted
and closed. E4, E5, and E6 are retained as historical accepted phases. P1 is
accepted and merged; its final main CI and accepted tag are pending post-merge
closeout.

| Phase | Name | Goal / core deliverables | Status | Frozen? |
|---|---|---|---|---|
| A | DeepSeek foundation | Initial AI/LLM project foundation and local development path | ACCEPTED | Yes |
| B0 | Existing platform baseline | Existing product modules and baseline stabilization | ACCEPTED | Yes |
| B1 | Skill Runtime and academic safeguards | Skill loading/composition, invariant extraction/validation, academic polish/revision safeguards | ACCEPTED | Yes |
| C1 | Document Parsing Foundation | Buffer-based DOCX/PDF/TXT/Markdown parsing into deterministic `ParsedDocument` | ACCEPTED | Yes |
| C2 | Context Builder | Context assembly for later document-aware tools; design approved and implemented | ACCEPTED | Yes |
| C3 | Chunking | Deterministic, lossless, structure-aware context partitioning | ACCEPTED | Yes |
| C4 | File Integration | Explicit multipart upload, durable storage, and C1 → C2 → C3 preparation | ACCEPTED | Yes |
| D1 | Tool Execution Foundation | Shared academic-tool execution foundation and runtime bindings | ACCEPTED | Yes |
| D2 | Polish Migration | Migrate Polish text/file execution onto the accepted preparation and execution pipeline | ACCEPTED | Yes |
| D3 | Paper Revision Migration | Migrate Paper Revision text/file execution onto the accepted preparation and execution pipeline | ACCEPTED | Yes |
| E1 | Knowledge Provenance Foundation | Standard PostgreSQL/Drizzle knowledge provenance foundation and immutable document-version lifecycle | ACCEPTED / CLOSED | Yes |
| E2 | Embedding & Index | Embedding provider abstraction, deterministic fingerprints, PostgreSQL/pgvector index lifecycle | ACCEPTED / CLOSED | Yes |
| E3 | Retrieval / Evidence Assembly | Indexed-only retrieval and provenance-preserving evidence assembly | ACCEPTED / CLOSED | Yes |
| E4 | Zotero Integration | Server-side personal Zotero connection, bibliographic sync, stored PDF attachment import and independent attachment version sync | ACCEPTED / POST-MERGE CLOSEOUT / TAG PENDING | Yes |
| E5 | Academic Search | OpenAlex external scholarly discovery with stateless authenticated search | ACCEPTED / POST-MERGE CLOSEOUT / TAG PENDING | Yes |
| E6 | Grounded Generation / Citation | Evidence-grounded generation and traceable academic citation | ACCEPTED / POST-MERGE CLOSEOUT / TAG PENDING | Yes |
| P1 | Production Readiness | Production auth/isolation, configuration, PostgreSQL/pgvector, storage, provider, API security, health, lifecycle, recovery basics, and CI gates | ACCEPTED / POST-MERGE CLOSEOUT / TAG PENDING | Yes |
| F | Queue / Redis / BullMQ | Record only; no implementation authorization | PLANNED / NOT AUTHORIZED | No |

## Status meanings

- ACCEPTED: explicit `PHASE_x_ACCEPTED` and Final Acceptance Report exist; accepted tag and closeout determine the separate CLOSED state.
- ACCEPTED / POST-MERGE CLOSEOUT / TAG PENDING: acceptance and merge are complete, but final governance closeout and accepted tag are still pending.
- IN_PROGRESS: implementation is active or awaiting review/acceptance.
- PLANNED: route is recorded but work has not started.
- NOT_STARTED: a confirmed item has no implementation yet.
- REVIEW PASS / FINAL ACCEPTANCE PENDING: implementation review passed; formal
  Final Acceptance has not yet been granted.
- ACCEPTED / CLOSED: Final Acceptance, merge, final `main` CI, and the annotated
  accepted tag have all been verified.

## Phase E5 current record

- Branch: `phase/e5-academic-search`.
- PR: [#12 Phase E5 — External Academic Search / Scholarly Discovery](https://github.com/booom12133/academic-writing-platform/pull/12), OPEN.
- Reviewed HEAD: `3d8d45545dd709e637b05848b5b2ba0e60e26b25`.
- Review: `PHASE_E5_REVIEW_PASS`, Review ID `5125877999`.
- Final Acceptance Report: [PHASE_E5_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_E5_FINAL_ACCEPTANCE_REPORT.md).
- CI run `34044506843`: `verify` and `postgres-schema` both SUCCESS.
- E5 is `PHASE_E5_ACCEPTED`; PR #12 merge commit is `0ed501ac0592c30987e9e9c6ba8754d934255040`.
- Final Acceptance Review ID: `5125902184`.
- Final Acceptance Preparation HEAD: `2dc9fd476ac0b233096fed4d33d33b71d47cc77d`.
- CI run `34044506843` passed `verify` and `postgres-schema`; merge-triggered main run `34044852534` also passed both jobs.
- E5 accepted tag remains the final closeout step; do not begin E6.

## Phase E6 current record

- Branch: `phase/e6-grounded-generation`.
- PR: [#13 Phase E6 — Grounded Generation / Citation](https://github.com/booom12133/academic-writing-platform/pull/13), MERGED with merge commit `0d40bda958794d178244fba3a6aaf852586317b6`.
- Reviewed HEAD: `ecdcdf6a9b9eb7fb91719eb7c6aa69c0d2f0b78e`.
- Final Acceptance Preparation HEAD: `ec3d571e31fbc926ecd7924c14995dc32fdf2855`.
- Review: `PHASE_E6_REVIEW_PASS`, Review ID `5127480833`.
- Final Acceptance: `PHASE_E6_ACCEPTED`, Review ID `5127586164`.
- Final Acceptance Report: [PHASE_E6_FINAL_ACCEPTANCE_REPORT.md](docs/reviews/PHASE_E6_FINAL_ACCEPTANCE_REPORT.md).
- Final authoritative review CI: run `34075066569`; `verify` and `postgres-schema` both SUCCESS.
- Final Acceptance governance CI: run `34076209448`; `verify` and `postgres-schema` both SUCCESS.
- Status: `PHASE_E6_ACCEPTED / MERGED / FINAL CLOSEOUT PENDING`; final main CI and accepted tag are pending.
- Do not create the accepted tag until final main CI is green; do not begin E7 or deployment/P1.

Phase status changes require the workflow in `CODEX_WORKFLOW.md`; do not advance phases from chat context alone.

## Phase P1 current record

- Branch: `phase-p1`.
- PR: [#14 P1 Production Readiness](https://github.com/booom12133/academic-writing-platform/pull/14), MERGED with merge commit `03b730454edc1b22add8af527eac8c08e9ef301e`.
- Accepted baseline: `6a3ee346bcf0b8cbd6ae7c6df58d30871bd74c30`.
- Review-Pass code HEAD: `14558f3f4efabbc8b42a7166bfae3d033ce822c3`.
- Final Acceptance candidate HEAD: `a84f1aa64a7424c62ad942f6e819085740816208`.
- Final Acceptance: `P1_ACCEPTED`, recorded in ChatGPT Final Acceptance comment `5568235876`.
- Candidate CI: run `34103737247`; `verify`, `postgres-schema`, and `production-gates` all SUCCESS.
- Status: `PHASE_P1_ACCEPTED / MERGED / FINAL CLOSEOUT PENDING`; final main CI and annotated `phase-p1-accepted` tag remain required to establish `P1_ACCEPTED_CLOSED`.
- Next phase: P2 Product Integration / UX — `NOT_STARTED / NOT AUTHORIZED`.
