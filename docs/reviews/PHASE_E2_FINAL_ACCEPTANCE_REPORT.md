# Phase E2 Final Acceptance Report

Date: 2026-09-06  
Status: `PHASE_E2_ACCEPTED`

This document records ChatGPT Final Acceptance and the post-merge governance
closeout for Phase E2.

## 1. Executive Summary

- Phase: Phase E2 — Embedding & Index
- Reviewed implementation/code candidate SHA: `f2fdd9e87d24257094146af07e9d4899d206d9aa`
- Final Acceptance Preparation HEAD: `db1d08e5aff058b0aa2912cf5ea943d487c253b5`
- Pull request: [#9 Phase E2 — Embedding & Index](https://github.com/booom12133/academic-writing-platform/pull/9)
- Accepted baseline: `d68331f594f671a1ce0099d008d3aaaa512448b1`
- ChatGPT review status: `PHASE_E2_REVIEW_PASS`
- Review ID: `5122161365`
- PR state: MERGED
- PR #9 merge commit: `7acd0720f4d892a11fc10457b418e9e05a2fd718`
- Acceptance state: `PHASE_E2_ACCEPTED`
- Accepted tag: `phase-e2-accepted`

## 2. Accepted Baseline

E2 was implemented from the accepted E1 baseline:

- Stable branch: `main`
- Baseline SHA: `d68331f594f671a1ce0099d008d3aaaa512448b1`
- Baseline phase: Phase E1 — Knowledge Provenance Foundation
- Baseline tag: `phase-e1-accepted`

The E2 branch was merged into `main` with the recorded PR merge commit after
ChatGPT issued Final Acceptance.

## 3. Phase Scope

The reviewed E2 implementation covers:

- Independent `EmbeddingProvider` contract, model identity, configuration,
  embedding profile, and deterministic fake provider.
- Semantic embedding profile, chunk input, and ordered index fingerprints.
- PostgreSQL/pgvector migration `0003_e2_embedding_indexes.sql`.
- `knowledge_embedding_indexes` and `knowledge_chunk_embeddings` persistence.
- Immutable `KnowledgeDocumentVersion` binding and user ownership isolation.
- `indexing`, `indexed`, `failed`, and `stale` lifecycle states.
- Bounded batching, leases, bounded retry, partial-failure resume, and
  same-version re-index.
- Successful-finalization replacement arbitration.
- PostgreSQL integration and CI validation on PostgreSQL 16 + pgvector.

The implementation consumes E1-persisted `KnowledgeDocumentVersion` and
`KnowledgeChunk` records. It does not add another parser, context builder, or
chunker.

## 4. Explicit Out-of-Scope Confirmation

The following are not implemented in E2:

- E3 retrieval, query embedding, similarity search, top-k, or hybrid retrieval
- RAG or evidence assembly
- A second vector database
- Redis, BullMQ, or a queue
- ECS deployment or production database mutation
- Production self-hosted authentication changes

The following frozen boundaries were verified unchanged from the accepted
baseline:

- Migration `0001` unchanged
- Migration `0002` unchanged
- E1 provenance unchanged
- E1 parser unchanged
- E1 chunker unchanged
- D4 `TextGenerationProvider` unchanged
- DeepSeek unchanged

## 5. Review Findings Closure

### Blocking 1 — Fingerprint Contract

`computeChunkInputFingerprint()` binds the following semantic inputs:

- `userId`
- `documentVersionId`
- `knowledgeChunkId`
- `ordinal`
- `e1IndexInputFingerprint`
- `textHash`

The embedding profile/model identity is represented separately by
`embeddingProfileFingerprint`. `computeIndexFingerprint()` includes the user
and immutable version binding together with the E1 fingerprint, profile
fingerprint, and ordered chunk input fingerprints.

Execution-only settings (`batchSize`, retry count, backoff, and lease) and the
retrieval-only distance metric are excluded. Ordered chunk arrays are
order-sensitive, and cross-user materializations do not share the same index
semantic identity.

Evidence:

- `server/modules/knowledge/indexing/embedding.fingerprint.spec.ts`
- `server/modules/knowledge/indexing/knowledge-indexing.service.spec.ts`
- `test/unit/postgres-e2-migration-order.spec.ts`

### Blocking 2 — Lifecycle

The lifecycle helper and repository/service behavior cover the approved
transitions:

- `indexing -> indexed`
- `indexing -> failed`
- `failed -> indexing`
- `indexed -> stale`
- `indexing -> stale`
- `stale -> indexing`

Invalid transitions are covered by tests. A stale materialization can be
explicitly reopened and re-indexed; a new document version does not
automatically stale an older version's materialization.

Evidence:

- `server/modules/knowledge/indexing/knowledge-indexing.lifecycle.ts`
- `server/modules/knowledge/indexing/knowledge-indexing.lifecycle.spec.ts`
- `server/modules/knowledge/indexing/knowledge-indexing.service.spec.ts`

### Important 1 — Input Policy

The `e2-reject-over-limit-v1` profile is enforced before provider invocation.
`maxInputCodePoints` is measured with Unicode code-point counting, not UTF-16
string length. Over-limit input is rejected, never silently truncated or
normalized, and the provider is not called.

Covered cases include ASCII, Chinese characters, emoji/surrogate pairs,
combining characters, CRLF, exact boundary input, and one-code-point-over-limit
input. Invalid input records a failed materialization with `invalid-input`.

Evidence:

- `server/modules/knowledge/indexing/knowledge-indexing.service.spec.ts`
- `server/modules/knowledge/indexing/knowledge-indexing.service.ts`

### Important 2 — Replacement Arbitration

Replacement is decided during successful finalization, not during
`createOrGetIndex()` creation-time inspection. Finalization locks the
same-user, same-immutable-version index rows in a transaction. A successful
candidate stales competing same-version `indexed` or `indexing` materializations;
an unsuccessful candidate does not stale the previously indexed materialization.
Different document versions are not affected.

Late batch writes for a materialization already made stale are ignored, so an
in-flight replacement cannot restore a stale index. The PostgreSQL regression
constructs A create, B create, A finalize indexed, and B finalize indexed, and
verifies that only the successful finalization remains indexed.

Evidence:

- `server/modules/knowledge/indexing/knowledge-index.repository.ts`
- `test/unit/postgres-e2-embedding.integration.spec.ts`
- GitHub `postgres-schema` job in run `33979745583`

## 6. Database / Migration Evidence

Migration: `drizzle/migrations/0003_e2_embedding_indexes.sql`

The migration:

- Enables `CREATE EXTENSION IF NOT EXISTS vector`.
- Creates `knowledge_embedding_indexes`.
- Creates `knowledge_chunk_embeddings` with pgvector storage.
- Enforces composite ownership foreign keys.
- Binds indexes to `document_version_id` and `user_id`.
- Enforces `UNIQUE(document_version_id, index_fingerprint)`.
- Enforces the natural key on user, document version, E1 fingerprint, and
  embedding profile fingerprint.
- Enforces positive dimensions and vector-dimension agreement.
- Requires an embedding whenever a chunk row is `indexed`.
- Allows only the four E2 lifecycle statuses.

Migration ordering was verified as `0001 -> 0002 -> 0003`. Direct baseline
diff checks confirm that `0001` and `0002` are unchanged.

## 7. Verification Evidence

Local verification on the reviewed implementation:

- Targeted Review-fix tests: 4 suites / 27 passed
- Full regression: 68 suites / 409 passed / 9 skipped
- Lint: PASS
- Server type-check: PASS
- Client type-check: PASS
- Server build: PASS
- Client build: PASS
- AppModule bootstrap: PASS
- PostgreSQL local integration: SKIPPED / NOT AVAILABLE — `DATABASE_URL` was
  unset and Docker was unavailable; `npm run test:integration:postgres` reported
  2 suites / 9 skipped.

## 8. Authoritative GitHub Actions Evidence

Authoritative run for the reviewed implementation HEAD:

- Run: [33979745583](https://github.com/booom12133/academic-writing-platform/actions/runs/33979745583)
- Head SHA: `f2fdd9e87d24257094146af07e9d4899d206d9aa`
- [verify job](https://github.com/booom12133/academic-writing-platform/actions/runs/33979745583/job/101342723832): PASS
- [postgres-schema job](https://github.com/booom12133/academic-writing-platform/actions/runs/33979745583/job/101342723891): PASS

The workflow uses Node.js 22 and the `pgvector/pgvector:pg16` service image.
The PostgreSQL job runs `npm run test:integration:postgres`, which covers the
0001 -> 0003 migrations, E1 PostgreSQL regression, E2 vector persistence,
immutable-version binding, and same-version replacement-finalization
regression.

## 9. Git / Repository State

- Stable branch: `main`
- Reviewed implementation SHA: `f2fdd9e87d24257094146af07e9d4899d206d9aa`
- Final Acceptance Preparation SHA: `db1d08e5aff058b0aa2912cf5ea943d487c253b5`
- Base SHA: `d68331f594f671a1ce0099d008d3aaaa512448b1`
- PR #9: MERGED
- PR #9 merge commit: `7acd0720f4d892a11fc10457b418e9e05a2fd718`
- Final main HEAD: the post-merge governance closeout commit recorded in `PROJECT_STATE.md` and verified on GitHub.
- Annotated tag: `phase-e2-accepted`, pointing to final main HEAD
- Working tree: clean after closeout
- E3 is not authorized

## 10. Known Non-blocking Items

- Existing `ts-jest` `TS151001` warning: INHERITED / NON-BLOCKING / OUT OF E2
  SCOPE.
- Existing client build module-type and chunk-size warnings: INHERITED /
  NON-BLOCKING / OUT OF E2 SCOPE.
- Local PostgreSQL integration was unavailable as recorded above; the required
  real PostgreSQL 16 + pgvector evidence is provided by the authoritative CI
  job.

No unrelated warning or inherited issue was modified during Final Acceptance
Preparation or closeout.

## 11. Final Acceptance and Closeout Statement

Phase E2 satisfied the reviewed and frozen implementation contract. ChatGPT
issued `PHASE_E2_ACCEPTED`; PR #9 was merged into `main`, and the annotated
accepted tag was created only after the post-merge governance closeout.

Final status:

`PHASE_E2_ACCEPTED_CLOSED`
