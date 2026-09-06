# Project Roadmap

Only established project phases are listed here. E1, E2, and E3 are accepted
and closed. E4 is accepted and merged, with post-merge closeout and its
accepted tag pending. E5 and E6 remain planned and unauthorized.

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
| E1 | Knowledge Provenance Foundation | Standard PostgreSQL/Drizzle knowledge provenance foundation and immutable document-version lifecycle | ACCEPTED | Yes |
| E2 | Embedding & Index | Embedding provider abstraction, deterministic fingerprints, PostgreSQL/pgvector index lifecycle | ACCEPTED / CLOSED | Yes |
| E3 | Retrieval / Evidence Assembly | Indexed-only retrieval and provenance-preserving evidence assembly | ACCEPTED / CLOSED | Yes |
| E4 | Zotero Integration | Server-side personal Zotero connection, bibliographic sync, stored PDF attachment import and independent attachment version sync | ACCEPTED / POST-MERGE CLOSEOUT / TAG PENDING | Yes |
| E5 | Academic Search | Future academic search capabilities | PLANNED / NOT AUTHORIZED | No |
| E6 | Grounded Generation / Citation | Future grounded generation and citation capabilities | PLANNED / NOT AUTHORIZED | No |
| F | Queue / Redis / BullMQ | Record only; no implementation authorization | PLANNED / NOT AUTHORIZED | No |

## Status meanings

- ACCEPTED: explicit `PHASE_x_ACCEPTED` and Final Acceptance Report exist; accepted tag and closeout determine the separate CLOSED state.
- ACCEPTED / POST-MERGE CLOSEOUT / TAG PENDING: acceptance and merge are complete, but final governance closeout and accepted tag are still pending.
- IN_PROGRESS: implementation is active or awaiting review/acceptance.
- PLANNED: route is recorded but work has not started.
- NOT_STARTED: a confirmed item has no implementation yet.

Phase status changes require the workflow in `CODEX_WORKFLOW.md`; do not advance phases from chat context alone.
