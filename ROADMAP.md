# Project Roadmap

Only the already established project phases are listed here. No phase below C1 is being implemented by this workflow-infrastructure task.

| Phase | Name | Goal / core deliverables | Status | Frozen? |
|---|---|---|---|---|
| A | DeepSeek foundation | Initial AI/LLM project foundation and local development path | ACCEPTED | Yes |
| B0 | Existing platform baseline | Existing product modules and baseline stabilization | ACCEPTED | Yes |
| B1 | Skill Runtime and academic safeguards | Skill loading/composition, invariant extraction/validation, academic polish/revision safeguards | ACCEPTED | Yes |
| C1 | Document Parsing Foundation | Buffer-based DOCX/PDF/TXT/Markdown parsing into deterministic `ParsedDocument` | IN_PROGRESS / REVIEW CANDIDATE PENDING | No, until accepted |
| C2 | Context Builder | NOT YET AUTHORIZED; record only | PLANNED | No |
| C3 | Chunking | NOT YET AUTHORIZED; record only | PLANNED | No |
| C4 | File Integration | NOT YET AUTHORIZED; record only | PLANNED | No |
| D | Tool Migration | NOT YET AUTHORIZED; record only | PLANNED | No |
| E | RAG / Zotero / Search | NOT YET AUTHORIZED; record only | PLANNED | No |
| F | Queue / Redis / BullMQ | NOT YET AUTHORIZED; record only | PLANNED | No |

## Status meanings

- ACCEPTED: explicit `PHASE_x_ACCEPTED`, Final Acceptance Report, accepted commit, and tag exist.
- IN_PROGRESS: implementation is active or awaiting review/acceptance.
- PLANNED: route is recorded but work has not started.
- NOT_STARTED: a confirmed item has no implementation yet.

Phase status changes require the workflow in `CODEX_WORKFLOW.md`; do not advance phases from chat context alone.
