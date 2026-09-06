# PHASE_E4_FINAL_ACCEPTANCE_REPORT

Date: 2026-09-06  
Status: `PHASE_E4_ACCEPTED / POST-MERGE CLOSEOUT / TAG PENDING`

This is the Phase E4 Final Acceptance record and post-merge closeout record. It
records ChatGPT's `PHASE_E4_ACCEPTED` decision and the normal PR merge. The
accepted tag is intentionally still pending; `PHASE_E4_ACCEPTED_CLOSED` has not
yet been established, and E5/E6 remain unauthorized.

## 1. Executive Summary

Phase E4 adds the reviewed server-side Zotero Web API v3 personal-library
integration. It connects an encrypted Zotero API key, derives the authoritative
personal library identity from `/keys/current`, synchronizes bibliographic
metadata into the existing E1 SourceRecord model, and imports stored PDF
attachments into the existing C4 → C1 → C2 → C3 → E1 path.

Parent bibliographic versions and child attachment versions are independently
discovered and synchronized. Attachment external state is persisted on the
KnowledgeDocument, while KnowledgeDocumentVersion, chunks, and provenance
remain immutable. The final reviewed implementation is the candidate for
ChatGPT final acceptance.

## 2. Accepted Baseline Candidate

- Stable accepted baseline before E4: `main @ 90ce381ab766150d4c90cb821e4235efca9da164`.
- Implementation branch: `phase/e4-zotero-integration`.
- Reviewed implementation HEAD: `de46ad07f2df9132fe677e4d3cd2acc9afc0243f`.
- Pull request: [#11 Phase E4 — Zotero Integration](https://github.com/booom12133/academic-writing-platform/pull/11).
- PR base: `main @ 90ce381ab766150d4c90cb821e4235efca9da164`.
- ChatGPT final implementation review: `PHASE_E4_REVIEW_PASS`, Review ID `5124623969`.
- ChatGPT Final Acceptance: `PHASE_E4_ACCEPTED`.
- PR state: MERGED.
- PR merge commit: `36b252ad684721c1798fe7f446b4e4b3941a8b9a`.
- Merged at: `2026-09-06T08:41:50Z`.
- Post-merge main SHA before governance closeout: `36b252ad684721c1798fe7f446b4e4b3941a8b9a`.
- Primary post-merge governance commit: `300dcd8a89659fab4fc1ea525c270be99ab2bcfb`.
- Governance correction commit: `520b86197e4bfc12b39702f681c343e7203f52ed`.
- Governance correction commit: `d8c44f69313f6e34bd75974f72700e472a925b4d`.
- Verified main CI before this final correction: run `34023063603` on head
  `d8c44f69313f6e34bd75974f72700e472a925b4d`; `verify` and `postgres-schema`
  were both SUCCESS.
- `34023063603` is the verified pre-correction main CI evidence. The final
  accepted-tag target will be the final governance-only main HEAD after this
  correction and its CI passes.
- Accepted tag: `phase-e4-accepted` — PENDING; no tag object SHA exists.
- `PHASE_E4_ACCEPTED_CLOSED`: NOT YET.

The reviewed implementation HEAD is unchanged. The merge commit and this
post-merge governance change contain no further business implementation.

## 3. Phase E4 Goal

Implement a bounded, server-side, personal Zotero library integration without
rewriting the existing architecture. Support authoritative connection identity,
bibliographic SourceRecord synchronization, stored PDF attachment ingestion,
independent attachment external-version synchronization, immutable document
history, and safe retry/concurrency behavior by reusing the accepted C4, C1,
C2, C3, and E1 boundaries.

## 4. Implemented Scope

- Zotero Web API v3 personal library integration.
- `/keys/current` credential introspection with header authentication.
- Server-side encrypted credential persistence and connection health/status.
- Typed Zotero bounded-context DTOs and error mapping.
- Parent item metadata normalization into additive E1 canonical citation fields.
- SourceRecord identity and bibliographic provenance through existing E1 contracts.
- Independent child attachment discovery and stored-PDF filtering.
- Attachment external identity, external version, and upstream MD5 state on
  KnowledgeDocument.
- C4 buffered upload, verified read, C1 parsing, C2 context handling, C3
  chunking, and E1 version/provenance persistence.
- Immutable next KnowledgeDocumentVersion creation when attachment bytes change.
- Best-effort provider-neutral C4 cleanup after downstream import failure.
- Bounded pagination, download size checks, ETag/MD5/SHA-256 validation,
  timeout, retry, and concurrency behavior.
- REST/module wiring and PostgreSQL integration coverage.

Import success remains distinct from indexing success. E4 does not own E2
indexing lifecycle.

## 5. Architecture / Frozen Boundaries

- `SourceRecord` represents the Zotero bibliographic item.
- `KnowledgeDocument` represents one supported Zotero attachment.
- No `ZoteroReference` knowledge model was added.
- Zotero connection, credential, privilege, status, request, and response types
  remain in `server/modules/zotero/zotero.types.ts` and the Zotero bounded
  context.
- `knowledge.types.ts` contains only generic KnowledgeDocument external sync
  state and the minimal additive platform citation fields.
- E1 provenance and lifecycle semantics remain frozen except for the approved
  additive citation-field extension.
- E2 and E3 behavior and lifecycle ownership remain unchanged.
- Existing C4, C1, C2, and C3 boundaries are reused; no Zotero parser or
  chunker was introduced.
- No distributed lock, Redis, BullMQ, queue, reranker, or new vector database
  was introduced.

## 6. Migration 0004 Summary

Migration `0004_e4_zotero_connections.sql` is the minimal E4 migration. It
adds the `zotero_connections` table and the generic KnowledgeDocument external
sync columns:

- `external_identity`
- `external_version`
- `external_checksum_algorithm`
- `external_checksum`

It enforces the user-scoped connection identity
`UNIQUE(user_id, library_type, library_id)` and user-scoped external attachment
identity uniqueness. Nullable legacy documents remain compatible. The Drizzle
snapshot/journal and migration-order coverage include `0001 → 0002 → 0003 →
0004`; prior migrations and immutable version tables were not rewritten.

No migration was changed during final-acceptance preparation.

## 7. Zotero Connection / Credential Contract

The connection input is an API key only. The server uses the dedicated
`ZoteroCredentialIntrospectionClient`:

```text
client POST apiKey
  → GET /keys/current
     Zotero-API-Key: <apiKey>
     Zotero-API-Version: 3
  → authoritative userID and privileges
  → validate access.user.library === true
  → validate access.user.files === true
  → libraryType=user, libraryId=authoritative userID
```

Ordinary Zotero requests use the same headers and never put the key in a query
string. The client cannot control the final authoritative library identity.
The persisted connection records derived identity, encrypted credential data,
key fingerprint, encryption key version, status, and health timestamps; the
plaintext key is short-lived in memory only.

## 8. SourceRecord / KnowledgeDocument Provenance Contract

The platform canonical citation fields are the existing `title`, `authors`,
`year`, `venue`, `abstract`, `doi`, and `citationKey`, plus the approved minimal
additive fields `publisher`, `volume`, `issue`, `pages`, `url`, `isbn`, `issn`,
and `language`. They continue through `CanonicalField`, assertion references,
and existing resolution/verification semantics.

Zotero `itemType`, tags, collections, full creator roles, raw fields, and
provider-specific relations/dates are ephemeral provider DTO data in E4 v1;
there is no raw Zotero snapshot persistence and no arbitrary provider JSON in
canonical metadata.

Bibliographic external provenance identifies the Zotero source, while direct
attachment provenance identifies the imported attachment and its accepted
artifact. Attachment identity is not treated as bibliographic SourceRecord
identity. All stored knowledge remains owner-scoped.

## 9. Attachment Sync / Versioning Contract

Parent and attachment synchronization are independent:

- Parent item version controls bibliographic metadata refresh only.
- Parent version unchanged never skips attachment discovery.
- Attachment discovery compares library type, library ID, attachment key,
  persisted external version, and persisted upstream MD5.
- Unchanged attachment external state skips download.
- Changed external state fetches and validates the attachment.
- Changed external state with unchanged downloaded SHA-256 updates only the
  KnowledgeDocument external state and creates no new version.
- Changed attachment bytes create a new immutable
  `KnowledgeDocumentVersion` under the same KnowledgeDocument.
- Existing versions, chunks, and provenance are retained.

KnowledgeDocument external fields are mutable synchronization state. The
accepted external version and checksum advance only after the full import
transaction succeeds.

## 10. Concurrency / Idempotency Guarantees

KnowledgeDocument external identity is arbitrated by the database with the
user-scoped unique constraint. A concurrent first-import loser detects only the
expected external-identity collision, owner-safely re-reads the winner, and
continues through normal version/state arbitration. It does not expose the
expected collision as a permanent error or swallow unrelated unique violations.

Concurrent imports of different upstream versions converge to one document and
the newest accepted external state. Row locking/CAS protects state updates;
same-SHA races create no unnecessary version, while changed bytes create one
immutable next version. Idempotency markers do not substitute for external
identity arbitration. Cross-owner lookups and participation are rejected.

## 11. Trash / Restore / 404 Semantics

- Ordinary upstream `404 / item not found` is not a tombstone signal.
- A single ordinary 404 does not tombstone records, delete versions/chunks/
  provenance, or imply permanent deletion.
- When status must be determined, discovery can observe explicit Zotero trash
  through an `includeTrashed=1`-capable contract.
- Only an explicit upstream trash state tombstones the affected
  KnowledgeDocument.
- The SourceRecord is retained by default; sibling attachment documents are
  unaffected.
- A later active observation with the same external identity restores the same
  KnowledgeDocument rather than creating a second document.
- `/deleted?since=<libraryVersion>` permanent deletion detection is deferred;
  E4 v1 does not implement a full-library sync cursor/deletion engine.
- Immutable versions, chunks, and provenance remain intact through trash and
  restore.

## 12. C4 Compensation / Orphan Prevention

Attachment flow is:

```text
download → integrity validation → C4 upload → DocumentInputRef
  → verified read → C1/C2/C3 → E1 transaction
```

If any downstream operation fails before a successful E1 commit, the import
attempt invokes provider-neutral `removeOwned(userId, documentRef)` as
best-effort compensation. It reuses DocumentInputRef owner validation and
checks provider, bucket, canonical user-scoped path, and current-user
ownership before calling the existing `DocumentStoragePort.remove()`.

Cleanup failure never masks the original import error and cannot advance
accepted external state or activeVersion. A successful E1 commit retains the
artifact and records the accepted `sourceArtifactRef`. Existing user-upload C4
semantics are unchanged; no Zotero-specific filesystem writer or storage
provider was added.

## 13. Transport / Backoff / Retry Contract

The Zotero client uses API v3 headers, bounded pagination, timeout handling,
bounded streaming/download limits, ETag validation, and bounded retry counts
with `maxConcurrency <= 4`.

Backoff is a shared client-wide deadline gate. All requests through one client
instance observe the gate; a waiting worker cannot clear it for other workers,
and a newly observed longer deadline extends rather than shortens the gate.
Valid finite server-provided `Backoff: N` and `Retry-After: N` windows are
honored in full, including values greater than five seconds. Malformed,
negative, non-finite, overflowing, or operationally unreasonable values use the
approved safe fallback/typed retryable behavior without early retry. Timeout,
pagination, bounded download, ETag, and concurrency behavior remain bounded.

## 14. Security / Secret Handling

- API keys are encrypted server-side with ciphertext, nonce, authentication
  tag, algorithm, and encryption key version to support rotation.
- Key fingerprint is non-reversible and used for identity/rotation/revoke
  correlation only.
- API keys never enter SourceRecord, KnowledgeDocument, provenance, import
  markers, logs, errors, traces/APM, proxy/debug output, or metrics.
- Authentication headers are redacted; returned errors expose only stable typed
  codes, safe messages, retry hints, and correlation identifiers.
- Rotation validates the new key before replacing the active encrypted record;
  revoke/disable prevents further synchronization.
- No credential is used in a URL path or query parameter.

## 15. Testing Evidence

Authoritative reviewed-HEAD evidence:

- Targeted Zotero client: 22 tests passed.
- Targeted E4/Zotero/knowledge/C4 set: 10 suites passed, 57 passed, 7
  skipped, 64 total.
- Required behavior includes parent-unchanged attachment discovery,
  state-only updates, immutable version creation, trash/restore boundaries,
  owner isolation, C4 compensation, and different-version first-import
  arbitration.

## 16. PostgreSQL + pgvector Evidence

The local PostgreSQL integration command completed with one available guarded
suite and 19 environment-guarded skips because local `DATABASE_URL`/Docker was
not available.

The authoritative CI PostgreSQL job used PostgreSQL + pgvector and a real
`DATABASE_URL`. PR workflow run
[34019329627](https://github.com/booom12133/academic-writing-platform/actions/runs/34019329627)
reported:

- `postgres-schema`: success.
- Four PostgreSQL integration suites passed.
- Twenty tests passed.
- E1/E2/E3/E4 integration was included, including E4 concurrency, ownership,
  version, rollback, and migration coverage.

## 17. Full Regression Evidence

The reviewed HEAD full regression was:

- 95 suites passed.
- 514 tests passed.
- 19 tests skipped by environment guards.

The command was `npm test -- --runInBand`. Tests used fakes/fixtures and did not
call real Zotero, DeepSeek, Redis, or production services.

## 18. CI Evidence

PR workflow run
[34019329627](https://github.com/booom12133/academic-writing-platform/actions/runs/34019329627)
was green:

- `verify`: success.
- `postgres-schema`: success.

The corresponding push workflow run `34019327217` also reported both checks
successful. CI therefore supplied the authoritative PostgreSQL + pgvector
evidence unavailable in the local environment.

Post-merge main CI for the governance closeout passed in run
[34022670076](https://github.com/booom12133/academic-writing-platform/actions/runs/34022670076)
on main HEAD `300dcd8a89659fab4fc1ea525c270be99ab2bcfb`:

- `verify`: SUCCESS.
- `postgres-schema`: SUCCESS.

The run executed the full regression and PostgreSQL + pgvector migration/test
job. The accepted tag remains pending and cannot be created by this task.

## 19. Review History / Findings Closure

### Initial Review

Status: `PHASE_E4_FIX_REQUIRED`.

- Blocking: official Zotero v3 response wrapper mismatch.
- Important: ETag/timeout/backoff/pagination/bounded download; PostgreSQL
  concurrency arbitration; direct attachment provenance; controller-wide typed
  error mapping; parent trash propagation.

### Re-review

Status: `PHASE_E4_FIX_REQUIRED`, Review ID `5124504400`.

- Important: concurrency-safe shared Backoff.
- Important: concurrent first import with different upstream versions.

### Final Re-review

Status: `PHASE_E4_FIX_REQUIRED`, Review ID `5124540724`.

- Important: valid Backoff/Retry-After duration was incorrectly capped at five
  seconds.

### Final Implementation Review

Status: `PHASE_E4_REVIEW_PASS`, Review ID `5124623969`.

All Blocking and Important findings listed above were closed in reviewed HEAD
`de46ad07f2df9132fe677e4d3cd2acc9afc0243f`. No implementation changes were
made after that reviewed HEAD before this preparation document.

## 20. Out-of-Scope Confirmation

The following were not entered:

- E5 Academic Search.
- E6 Grounded Generation / Citation.
- RAG generation or citation generation.
- Zotero group library.
- Zotero Desktop Local API.
- Notes, annotations, or highlights.
- Tags/collections persistence or raw Zotero snapshot persistence.
- Redis/BullMQ/queue infrastructure.
- Vector redesign or a new vector database.
- Authentication repair.
- ECS or production rollout.

## 21. Known Non-Blocking Warnings

- Local PostgreSQL integration was environment-guarded because local
  `DATABASE_URL`/Docker was unavailable; the CI PostgreSQL + pgvector job is
  the authoritative integration evidence.
- Jest/ts-jest reports the existing `esModuleInterop` advisory.
- Client build reports the existing module-type and large-chunk warnings.
- Test output contains expected fixture-related provider warning logs; no real
  external provider call was made.
- No production deployment or production database migration was performed.

## 22. Final Acceptance Checklist

- [x] Stable base is `90ce381ab766150d4c90cb821e4235efca9da164`.
- [x] PR #11 is merged with normal merge commit `36b252ad684721c1798fe7f446b4e4b3941a8b9a`.
- [x] Reviewed implementation HEAD is `de46ad07f2df9132fe677e4d3cd2acc9afc0243f`.
- [x] Final ChatGPT implementation review is `PHASE_E4_REVIEW_PASS`.
- [x] ChatGPT Final Acceptance is `PHASE_E4_ACCEPTED`.
- [x] Required implementation and regression evidence is recorded.
- [x] PostgreSQL + pgvector CI evidence is recorded.
- [x] Migration 0004 scope is recorded; it was not changed during preparation.
- [x] Frozen E1/E2/E3/C4 boundaries and E5/E6 exclusions are recorded.
- [x] No implementation file was changed during preparation.
- [x] PR #11 is merged after explicit acceptance.
- [x] Post-merge main CI run `34022670076` is green (`verify` and `postgres-schema`).
- [ ] `phase-e4-accepted` is created after merge closeout.

## 23. Proposed Final Status

`PHASE_E4_ACCEPTED / POST-MERGE CLOSEOUT / TAG PENDING`

Final Acceptance: `PHASE_E4_ACCEPTED`. Post-merge governance closeout is
completed. The final accepted tag remains pending until this correction and its
main CI are verified; `PHASE_E4_ACCEPTED_CLOSED` is not yet established. No tag
SHA is recorded or invented.
