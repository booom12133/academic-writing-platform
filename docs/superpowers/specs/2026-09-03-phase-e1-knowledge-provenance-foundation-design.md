# Phase E1 — Knowledge Provenance Foundation Design

Status: Proposed Design Spec — implementation is not authorized.

Date: 2026-09-03

Baseline: accepted D4 `main` at
`156eb45e00bb727c69bb891f056f384bb600d415`, also the peeled target of the
remote annotated tag `phase-d4-accepted`.

Formal review status: `PHASE_E1_DESIGN_REVIEW_PASS` — design restored for
continued governance; implementation remains unauthorized until the separately
approved standard PostgreSQL infrastructure gates are complete.

## 1. Goal

Phase E1 establishes the durable identity, versioning, provenance, tenancy, and
lifecycle boundary for knowledge that may later be embedded, retrieved, and
cited.

E1 is a persistence and provenance foundation. It does not perform semantic
search, embedding, retrieval, citation generation, or grounded generation.

The central relationship is:

```text
SourceRecord (optional for a document, may exist alone)
  ↕ zero or more related document artifacts
KnowledgeDocument (always has its own durable identity)
  → one or more immutable document versions
  → ordered, provenance-bearing chunks
```

The cardinality rules are explicit:

- a `SourceRecord` may exist without any `KnowledgeDocument`;
- one `SourceRecord` may relate to multiple `KnowledgeDocument` artifacts;
- a `KnowledgeDocument` may exist without a `SourceRecord`;
- every `KnowledgeDocument` has its own durable identity;
- versions and chunks remain traceable through the document even when
  bibliographic identity is absent.

A bibliographic/source record may exist without full text. A single
bibliographic work may be associated with multiple document artifacts or
versions. A `KnowledgeDocument` is therefore not synonymous with a Zotero item,
an academic search result, or a bibliographic work.

## 2. Accepted Context and Dependencies

The design starts from the accepted D4 baseline and preserves the following
frozen foundations:

- C1 `ParsedDocument` from `server/modules/document-parsing/**`;
- C2 structural context semantics from `server/modules/context-builder/**`;
- C3 deterministic chunking semantics from `server/modules/chunking/**`;
- C4 `DocumentInputRef` and durable document storage from
  `server/modules/document-input/**`;
- D1 deterministic rendering and execution boundaries from
  `server/modules/ai-tools/execution/**`;
- D4 `LlmService` and `TextGenerationProvider` from
  `server/modules/ai-tools/llm/**`.

Current C1–C4 evidence already contains source block IDs, source order, block
indexes, sections, heading paths, optional page numbers, and C3 fragment spans.
Those semantics are sufficient inputs for an additive E1 mapping layer, but
their request-local IDs are not suitable as durable database identities.

The accepted C2/C3 public input boundary is not currently generic: C2
`ContextTaskType` is exactly `'polish' | 'paper-revision'`, and C3 accepts a
`TaskContext` containing that task. E1 must therefore not manufacture either
tool task type for knowledge ingestion. A neutral structural ingestion seam is
specified in Section 12 as an approved additive change, subject to normal
implementation authorization and review.

Current `DocumentInputRef.sha256` identifies the stored input artifact, but the
hash is not part of the C1 `DocumentSource` or C2 source contract. E1 must carry
the artifact identity beside the mapped C1–C3 result rather than changing those
frozen contracts.

## 3. Domain Model

### 3.1 SourceRecord

`SourceRecord` is the canonical logical identity of a source or bibliographic
work. It may contain incomplete metadata and may exist without an imported
document.

Conceptual fields:

```text
SourceRecord
  id
  userId
  kind: user-declared | scholarly-work | reference-library-item
  canonicalMetadata
  metadataAssertions[]
  externalProvenance[]
  status
```

`SourceRecord` is not a full-text container. Metadata-only search results can
create or update a source record without creating a `KnowledgeDocument`.

`canonicalMetadata` is a resolved projection, not the sole record of truth.
Every populated field must point to one or more field-level metadata
assertions. A DOI, title, or author value must not appear to be locally verified
merely because a connector returned it.

`externalProvenance[]` remains useful for source/artifact-level origin, but it is
not sufficient to prove which provider supplied a particular metadata field.
The required field-level model is defined in Section 3.6.

### 3.2 KnowledgeDocument

`KnowledgeDocument` represents a concrete document artifact or logical user
document that can have content versions. It is separate from `SourceRecord`.

Conceptual fields:

```text
KnowledgeDocument
  id
  userId
  sourceRecordId?
  originKind: user-upload | generated-artifact | external-attachment
  displayName
  sourceType
  activeVersionId?
  lifecycleStatus
```

`sourceRecordId` is optional. A user-uploaded draft may not have a known
bibliographic identity. Conversely, a `SourceRecord` may have no document, and
one source record may be related to multiple document artifacts.

### 3.3 KnowledgeDocumentVersion

`KnowledgeDocumentVersion` is an immutable, reproducible snapshot of one
document derivation.

Conceptual fields:

```text
KnowledgeDocumentVersion
  id
  documentId
  versionNumber
  originalContentHash
  normalizedContentHash?
  normalizationProfile?
  parserProfile
  chunkingProfile
  sourceArtifactRef?
  supersedesVersionId?
  createdAt
  lifecycleStatus
  indexInputFingerprint
```

The version records the exact derivation inputs needed by a later indexer. It
does not contain an embedding or vector index state owned by E2.

### 3.4 KnowledgeChunk

`KnowledgeChunk` is an immutable, ordered, provenance-bearing portion of a
document version.

Conceptual fields:

```text
KnowledgeChunk
  id
  documentVersionId
  ordinal
  text
  textHash
  section
  sourceOrder
  provenance
  citationLocator
```

The chunk stores the text needed by later E2/E3 consumers and the mapping back
to C1/C2/C3. Its `ordinal` is deterministic within a document version. Its
durable `id` is not derived from the request-local C3 chunk ID.

### 3.5 ExternalProvenance

`ExternalProvenance` describes where a source identity or document artifact was
obtained:

```text
ExternalProvenance
  connectorKind
  provider
  externalRecordId
  externalVersion?
  canonicalUrl?
  retrievedAt?
  licenseOrAccessNote?
  verificationStatus
```

The model is intentionally connector-neutral. Zotero and academic search are
future producers of this record; neither is implemented or coupled to E1.

### 3.6 Field-level metadata provenance

Canonical bibliographic metadata is represented separately from the assertions
that support it:

```text
CanonicalSourceMetadata
  title?: CanonicalField<string>
  authors?: CanonicalField<Author[]>
  year?: CanonicalField<number>
  venue?: CanonicalField<string>
  abstract?: CanonicalField<string>
  doi?: CanonicalField<string>
  citationKey?: CanonicalField<string>

CanonicalField<T>
  value: T
  assertionIds[]
  resolutionStatus: resolved | conflicting | unverified

MetadataAssertion<T>
  id
  sourceRecordId
  field
  value: T
  providerKind
  provider
  externalRecordId
  observedAt?
  verificationStatus
  assertionHash
```

`MetadataAssertion` is append-only evidence. Conflicting assertions remain
addressable instead of silently overwriting one another. A later canonical
resolution may select a value, but must retain the assertion IDs and resolution
status that explain the choice. This is a generic persistence capability only;
E1 does not implement any Zotero, OpenAlex, or other connector policy.

### 3.7 Seven-table persistence model

The approved physical model contains exactly these seven E1 tables:

```text
knowledge_source_records
knowledge_metadata_assertions
knowledge_source_external_links
knowledge_documents
knowledge_document_versions
knowledge_chunks
knowledge_imports
```

The physical contract is user-scoped with durable UUID identities and
composite ownership constraints. `knowledge_source_records` stores canonical
metadata and status, but does not store a duplicate `external_provenance`
JSONB field. `knowledge_source_external_links` is the sole persistent source
of external provenance and external identity uniqueness; the domain
`SourceRecord.externalProvenance[]` is hydrated from those rows.

`knowledge_metadata_assertions` is append-only evidence with field, value,
provider, external record identity, observation time, verification status, and
assertion hash. `knowledge_documents.source_record_id` is nullable, and there
is no reverse mandatory source-to-document foreign key. A source may exist
alone, one source may relate to multiple documents, and a document may exist
without a source. Versions and chunks remain traceable through their durable
document/version identities in every case.

The remaining tables preserve immutable version/chunk identity, ordered chunk
uniqueness, per-user import idempotency, composite user ownership, and the
approved hash/profile/readiness fields. The exact columns, indexes, and
constraints are fixed by the approved E1 plan and are not redefined by this
design restoration.

## 4. Identity Model

### 4.1 Durable IDs

The following IDs are opaque durable identifiers, generated once and never
reused:

```text
sourceRecordId
knowledgeDocumentId
knowledgeDocumentVersionId
knowledgeChunkId
```

They must not reuse:

- C2 `document-1`;
- C3 `document-1:c000001`;
- C3 unit IDs;
- C3 fragment IDs;
- file paths or bucket paths;
- external provider IDs as local primary keys.

External IDs remain provenance attributes and uniqueness inputs, not local
identity substitutes.

### 4.2 Deterministic uniqueness rules

Opaque IDs provide stable references. Deterministic uniqueness is provided by
scoped natural keys:

1. External source identity is unique within a user scope and connector
   namespace by `(userId, connectorKind, provider, externalRecordId)`.
2. A document artifact associated with an external source is matched by its
   source record plus an artifact fingerprint. Different attachments remain
   different documents even when they belong to the same work.
3. A document version is unique by its parent document and a complete derivation
   fingerprint containing the original hash, normalized hash when available,
   parser profile, normalization profile, and chunking profile.
4. A chunk is unique within a document version by durable ID and has a unique
   deterministic `(documentVersionId, ordinal)` pair.
5. Content hashes are duplicate-detection and idempotency inputs. They do not
   silently merge two user documents that lack a stable logical identity.

### 4.3 Import idempotency

An explicit import idempotency key is required for retry-safe import requests.
For the same user scope and import namespace:

- the same idempotency key and same content returns the existing import result;
- the same key with different content fails with a conflict and makes no
  mutation;
- an import without a reusable logical identity is not silently merged solely
  because its bytes match another user document.

For an external connector with a stable external identity, the connector key
and artifact fingerprint provide the natural idempotency boundary.

## 5. Versioning Model

### 5.1 Original-content hash

`originalContentHash` is the SHA-256 of the exact source artifact bytes when a
byte artifact exists. For text-only input, E1 must define a canonical UTF-8
input representation before hashing. The original hash must never be replaced
by a normalized text hash.

For C4-backed documents, the existing `DocumentInputRef.sha256` is the starting
artifact hash and must be checked against the bytes used for the C1–C3 mapping.

### 5.2 Normalized-content hash

`normalizedContentHash` is optional and is computed from a versioned, explicit
canonical textual projection of the C1 result. It is useful for detecting
format-only changes, but it is not a substitute for the original hash.

The normalization profile must be stored with the hash. E1 must not create an
implicit serializer whose whitespace or Unicode behavior is undocumented.

### 5.3 Parser and chunking profiles

Every version records:

```text
parserProfile = { name, version }
normalizationProfile = { name, version }?
chunkingProfile = { name, version, parameters }
```

The current C3 policy already records version `1`, Unicode code-point sizing,
maximum size, and zero overlap. E1 stores that applied policy as part of the
version fingerprint; it does not alter C3.

C1 currently does not expose a parser-version field. The E1 adapter must use an
explicit adapter/profile value approved during implementation and must not
pretend that a git commit hash is a parser version.

### 5.4 Version creation rules

A new immutable version is created when any of the following changes:

- source artifact bytes;
- canonical normalized content;
- parser profile;
- normalization profile;
- chunking profile or parameters.

Existing versions and chunks are never mutated. The document may advance its
active-version pointer after the new version is fully persisted.

Embedding model changes alone do not create an E1 document version; they are an
E2 index-profile concern. E1 may expose an immutable `indexInputFingerprint` as
the content input identity for E2, but E1 does not own E2's indexed, stale, or
failed operational states.

## 6. Provenance Model

### 6.1 Required persistent provenance

Each chunk must preserve enough information to answer:

```text
which user scope?
which source record, if one exists?
which document?
which immutable version?
which original artifact?
which C1 block?
which C2 unit?
which C3 fragment?
where in source order?
```

The persistent mapping includes:

```text
sourceBlockId
sourceBlockIndex
section: content | references
headingPath[]
pageStart?
pageEnd?
fragmentSpan: { start, endExclusive }?
sourceUnitId?
sourceChunkOrdinal
itemOrdinal
```

`fragmentSpan` uses the same Unicode code-point semantics as C3. It is not a
JavaScript UTF-16 offset.

### 6.2 Source ordering

Ordering is explicit and deterministic:

```text
document block index
→ C3 chunk order
→ chunk item order
→ fragment span order
```

E1 must retain this order even when a later retrieval system returns chunks by
score. Retrieval order is not source order.

### 6.3 Warnings and partial parser evidence

C1 warnings remain provenance evidence, not silently discarded metadata. An E1
version stores the warning code/message and any associated block/page locator.
Warnings do not become executable instructions.

The current C1 reference-section detection is heuristic/explicit-heading based
and does not produce structured bibliography records. E1 stores the reference
section provenance but does not claim that a reference block identifies a real
external work.

## 7. Citation Locator Foundation

E1 does not generate or render citations. It defines a stable locator that a
future citation layer can use:

```text
CitationLocator
  documentVersionId
  sourceRecordId?
  externalSourceId?
  section?
  headingPath[]?
  pageStart?
  pageEnd?
  sourceBlockId?
  sourceBlockIndex?
  fragmentSpan?
  chunkId
```

Rules:

1. A locator must point to an immutable document version and chunk.
2. Page information is optional because TXT/Markdown sources do not have pages.
3. A C1 single `pageNumber` maps to `pageStart = pageEnd`.
4. Page ranges are allowed in the model but must not be inferred when C1 only
   provides a single page number.
5. Heading paths are stored as snapshots with source heading IDs and titles.
6. External IDs are supplementary provenance; they never replace local version
   and chunk identity.
7. A locator without a valid source/chunk relationship is rejected.

This foundation supports later claim-to-evidence mapping without granting the
LLM authority to invent a source or locator.

## 8. Trust Model

E1 keeps two independent dimensions separate.

### 8.1 Evidentiary provenance

This describes how the record was obtained or derived:

```text
user-declared
parser-derived
connector-verified-metadata
connector-unverified-metadata
metadata-only
```

The value is evidence about provenance, not a guarantee that the source claim
is true.

### 8.2 Prompt execution trust

All imported, parsed, indexed, and retrieved document text is always:

```text
untrusted DATA
```

It must never be promoted to system instructions, developer instructions, tool
commands, or executable workflow merely because it came from a user file,
Zotero, or a supposedly verified academic provider.

E1 does not add a trust level that can authorize prompt execution. Future prompt
assembly must preserve this invariant.

## 9. Persistence Boundaries and Schema Ownership

### 9.1 Repository evidence

The accepted repository contains:

- `server/database/schema.ts`, explicitly marked `auto generated, do not edit`;
- `npm run gen:db-schema`, which invokes
  `@lark-apaas/db-schema-sync@latest`;
- Drizzle ORM consumers and a `DRIZZLE_DATABASE` token;
- `server/database/local-development.database.ts`, which creates a separate
  `pg-mem` schema from inline test SQL.

No `.spark_project` file was found in the accepted repository. The repository
does contain the `gen:db-schema` package-script reference described above.

The repository does not contain:

- a `drizzle-kit` configuration;
- a checked-in migration directory;
- SQL migration files;
- a migration/deploy script;
- a documented production schema promotion or rollback procedure;
- evidence that the generated schema file is the authoritative migration
  source.

### 9.2 Standard PostgreSQL schema ownership transition

The one-time `SCHEMA OWNERSHIP TRANSITION` is now explicit:

```text
CURRENT: Miaoda schema → db-schema-sync → generated server/database/schema.ts
TARGET:  application-owned canonical Drizzle schema
         → versioned Drizzle migrations
         → standard PostgreSQL
```

The existing import path `server/database/schema.ts` is preserved. After the
separately authorized transition, that path ceases to be a Miaoda-generated
production artifact and becomes the application-owned canonical Drizzle schema
definition. `npm run gen:db-schema` and the Miaoda workflow are not
authoritative for standard PostgreSQL after the transition.

The conceptual migration contract is `0001 baseline` for exactly
`app_users`, `tasks`, `point_records`, and `recharge_orders`, followed only
after separate E1 database authorization by `0002 E1 knowledge provenance` for
the seven E1 tables. The exact baseline physical contract must resolve
`user_profile`, `file_attachment`, `current_setting('app.user_id', true)`,
platform/system fields, defaults, nullability, timestamps, indexes, and
constraints. The current pg-mem mirror is not proof of standard PostgreSQL
parity. No migration files, transition, schema mutation, or production
implementation is authorized by this design document.

The target provider boundary is an application-owned
`StandardPostgresDatabaseModule` using `drizzle-orm/node-postgres` and a
direct `pg` Pool from `DATABASE_URL`, exporting the existing
`DRIZZLE_DATABASE` Nest token. `@lark-apaas/nestjs-datapaas` and
`DataPaasModule` are not the target production abstraction. `pg` currently
exists only in devDependencies; moving it to runtime dependencies is expected
during separately authorized implementation, and package.json remains
unchanged here.

### 9.3 C2/C3 ingestion boundary blocker

The accepted repository does not currently expose a generic C2/C3 ingestion
entrypoint. `ContextTaskType` is limited to `'polish' | 'paper-revision'`, and
C3 requires a `TaskContext` containing that task. E1 cannot legitimately use
either tool task type as a knowledge-ingestion sentinel.

The approved direction is the smallest additive seam described in Section 12:
a neutral structural C2 context plus a neutral C3 chunking entrypoint backed by
the existing deterministic chunking core. Durable E1 ingestion remains gated by
normal implementation authorization, TDD, and regression review. No E1-local
parser or chunker may be introduced as a workaround.

## 10. User Scope and Security Model

Every durable root entity is user-scoped for E1 v1. At minimum, queries and mutations
must enforce:

```text
userId scope
→ source record
→ knowledge document
→ document version
→ knowledge chunk
```

Security rules:

1. Durable IDs are opaque and non-guessable, but opacity is not authorization.
2. Every read, update, delete, and import-idempotency lookup includes the
   authenticated userId scope.
3. A client-supplied knowledge ID is untrusted input.
4. Cross-user references fail closed using the same ownership
   philosophy as C4.
5. The system should avoid revealing whether another user's ID exists.
6. `DocumentInputRef.bucketId` and `filePath` remain C4 storage handles; they do
   not become E1 identity or authorization substitutes.
7. External provider IDs are namespaced by connector/provider and are not
   globally trusted identifiers.

## 11. Import and Lifecycle Semantics

### 11.1 First import

1. Validate userId ownership and source input.
2. Validate or obtain the source artifact through the existing C4 boundary.
3. Run the existing C1 parser, then use the neutral structural C2/C3 seam
   specified in Section 12; never supply `taskType='polish'` or
   `taskType='paper-revision'` for E1.
4. Compute the original and, where configured, normalized content hashes.
5. Create the source/document/version/chunk graph atomically.
6. Mark the version as ready for a later indexer, without invoking E2.

### 11.2 Duplicate import

- A retry with the same idempotency boundary returns the existing result.
- A stable external identity plus matching artifact fingerprint reuses the
  existing document/version.
- A matching content hash without a stable logical identity is reported as a
  duplicate candidate; it is not silently merged.
- Ambiguous identity or conflicting idempotency data causes a typed conflict
  with no partial persistence.

### 11.3 New version

Changed content or changed parsing/chunking derivation creates a new immutable
version linked by `supersedesVersionId`. Existing versions remain addressable
for provenance and historical result interpretation.

### 11.4 Delete

Deletion is a user-scoped logical tombstone at the knowledge-document level.
Tombstoned documents and versions are hidden from future consumers. Historical
provenance remains readable only through authorized audit/history paths.

Physical artifact deletion is owned by the existing C4 storage boundary and
must not be conflated with deleting metadata or source identity. A shared
`SourceRecord` is unlinked from a document unless the caller has explicit
authority to delete the source record itself.

### 11.5 Re-import

Re-import never overwrites an immutable version. It either returns an idempotent
existing result or creates a new version under the existing logical document,
according to the identity rules above.

### 11.6 Later re-index boundary

E1 exposes content readiness and, if retained, an immutable
`indexInputFingerprint`:

```text
content-ready-for-indexing
```

E1 only persists the version and its content-readiness boundary. E2 owns
indexing, indexed, stale, failed, retry, and re-index states. E1 does not create
queues, workers, embeddings, or vectors.

## 12. C1/C2/C3/C4 Integration

The existing tool path remains unchanged:

```text
C4 artifact or text input
  → C1 ParsedDocument
  → C2 ContextBuilder.build(taskType = polish | paper-revision)
  → C3 ChunkingService.chunk(TaskContext)
  → D1 tool execution
```

E1 knowledge ingestion cannot use that tool-specific path. The approved
resolution is a neutral, additive structural seam:

```text
C4 artifact or text input
  → C1 ParsedDocument
  → C2-neutral StructuralDocumentContext
  → C3-neutral StructuralChunkedDocument
  → E1 persistent mapping adapter
```

The approved seam consists conceptually of:

```text
StructuralDocumentContext
  - source metadata
  - ordered structural units
  - heading paths
  - content/reference classification

ChunkingService.chunkStructural({ context, policy })
  → StructuralChunkedDocument
```

`chunkStructural()` must reuse the same deterministic, lossless, Unicode
code-point, zero-overlap chunking core as the current `chunk()` method. The
existing `build()` and `chunk()` entrypoints remain behaviorally unchanged for
Polish and Paper Revision. They may delegate to the shared internal core only if
the resulting output, warnings, validation, ordering, and error behavior remain
identical under regression tests.

This is the smallest safe solution because:

1. E1 needs C2's existing structural semantics, including heading paths and
   reference classification;
2. E1 needs C3's existing deterministic/lossless chunking semantics;
3. inventing either accepted tool task type would falsify the domain model;
4. rebuilding the logic in E1 would create a second parser/chunker and allow
   provenance drift;
5. one neutral additive entrypoint and one shared chunking core preserve the
   existing D2/D3 path while giving E1 a legitimate input boundary.

This seam is already part of the approved E1 design and is a proven
implementation dependency. It requires normal implementation authorization,
TDD, and regression review. E1 must not use `taskType='polish'`,
`taskType='paper-revision'`, or a copied E1 parser/chunker as a workaround.

The adapter maps:

| Existing evidence                             | E1 persistent evidence                       |
| --------------------------------------------- | -------------------------------------------- |
| C1 `DocumentBlock.id`                         | `sourceBlockId`                              |
| neutral C2 structural unit `sourceBlockIndex` | `sourceBlockIndex`                           |
| neutral C2 structural unit `section`          | `section`                                    |
| neutral C2 structural unit `headingPath`      | immutable heading-path snapshot              |
| C1 `pageNumber` / C3 page metadata            | page locator                                 |
| C3 `span`                                     | Unicode code-point fragment span             |
| C3 chunk/item order                           | deterministic source order and ordinal       |
| C4 `DocumentInputRef.sha256`                  | original artifact hash / artifact provenance |
| C3 applied policy                             | chunking profile/version                     |

E1 does not introduce a second parser, context builder, chunker, or provenance
system. It creates a persistent projection of the accepted contracts through
the approved neutral C2/C3 seam. Until normal implementation authorization
and regression review are complete, no durable E1 implementation may claim a
valid C1→C2→C3 ingestion path.

The current `references` section is stored with provenance but remains subject
to a later indexing policy. E1 does not decide whether references are embedded,
retrieved, or used as bibliography records.

E1 also does not modify D1 `AcademicToolExecutionService`, existing Polish or
Paper Revision aggregators, `TasksService`, or D4 text-generation contracts.

## 13. Failure Semantics

The future E1 implementation must fail closed:

- invalid or missing authenticated userId scope: reject before persistence;
- invalid source/document identity: reject before persistence;
- artifact hash mismatch: reject and do not create a version;
- invalid C1/C2/C3 provenance: reject the complete import;
- unavailable or invalid neutral C2/C3 structural seam: reject before durable
  persistence rather than using a Polish or Paper Revision task type;
- conflicting idempotency key: reject with no mutation;
- duplicate or stale version conflict: deterministic typed conflict;
- partial chunk persistence: transaction rollback or equivalent all-or-none
  compensation;
- cross-user ID access: behave as not found/unauthorized without leaking
  existence;
- parser warnings: persist as warnings when the parser successfully returns a
  valid document; never reinterpret them as instructions.

No external connector, embedding provider, vector store, or LLM call is allowed
inside the E1 persistence transaction.

## 14. Tests Required for Future Implementation

The E1 implementation plan must include tests for:

1. durable IDs never equal request-local C1/C2/C3 IDs;
2. deterministic natural-key and idempotency behavior;
3. same content with and without a logical identity;
4. original-hash and normalized-hash separation;
5. parser/chunking profile changes creating new versions;
6. immutable versions and chunks;
7. source order and Unicode code-point spans;
8. heading, section, page, block, and fragment provenance round-tripping;
9. citation locator validation;
10. metadata-only source records without documents;
11. one source record linked to multiple documents/artifacts;
12. user-document imports without bibliographic identity;
13. user isolation and tampered/foreign IDs;
14. duplicate import, re-import, delete, and stale-version behavior;
15. atomic failure on invalid provenance or hash mismatch;
16. neutral C2/C3 structural ingestion never uses `polish` or
    `paper-revision` as a sentinel;
17. existing Polish/Paper Revision C2/C3 behavior remains unchanged;
18. no calls to embedding, retrieval, Zotero, search, RAG, or LLM services;
19. pg-mem fast tests plus disposable real-PostgreSQL Linux-CI tests for the
    provider, migrations, real constraints, and transaction integration;
20. database constraints and migrations after the schema ownership transition
    is separately authorized.

The ordinary repository regression suite, lint, type-check, and builds remain
required for a future implementation candidate. No tests are run or changed by
this design-only task.

## 15. In Scope

- durable knowledge/source/document/version/chunk conceptual model;
- field-level canonical metadata assertions and provenance;
- identity and uniqueness rules;
- content and derivation versioning;
- persistent provenance mapping;
- citation locator foundation only;
- provenance trust versus prompt execution trust;
- user-scope and ownership rules;
- deterministic import/delete/re-import lifecycle;
- E2 readiness boundary;
- additive mapping from C1/C2/C3/C4 outputs;
- the approved neutral additive C2/C3 structural-ingestion seam, subject to
  normal implementation authorization, TDD, and regression review;
- the explicit standard PostgreSQL provider and schema-ownership transition
  contract, without implementing it.

## 16. Out of Scope

- `EmbeddingProvider`;
- embedding model selection or embedding calls;
- vector database selection or installation;
- `RetrievalIndex` implementation;
- retrieval runtime or evidence ranking;
- reranking;
- Zotero integration;
- Academic Search integration;
- RAG or grounded generation;
- citation generation or citation rendering;
- bibliography extraction from reference blocks;
- billing changes;
- queues, workers, Redis, or BullMQ;
- changes to C1, C2, C3, C4, D1, or D4 observable behavior;
- use of `taskType='polish'` or `taskType='paper-revision'` for E1 ingestion;
- an E1-local second parser or chunker;
- inherited CI repair;
- modification of historical D4 acceptance reports.

## 17. Frozen Dependencies and Boundaries

The following remain frozen unless a future review identifies and proves a
Blocking dependency:

- `server/modules/document-parsing/**`;
- `server/modules/context-builder/**`;
- `server/modules/chunking/**`;
- `server/modules/document-input/**`;
- `server/modules/ai-tools/execution/**`;
- `server/modules/ai-tools/llm/**`;
- `server/modules/tasks/**`;
- `server/database/schema.ts` until the separately authorized schema-ownership
  transition is implemented;
- `shared/api.interface.ts`;
- existing D2/D3 tool behavior;
- inherited `test/unit/platform-command.spec.ts` behavior and classification.

Testing and deployment boundaries are also frozen: pg-mem is for fast
unit/service/local tests; disposable real PostgreSQL in Linux CI is for the
provider, versioned migrations, real constraints, and transaction integration;
the ECS PostgreSQL runtime is for production runtime only. GitHub/Linux CI
must install, test, lint/type-check, build, package the runtime artifact, and
produce its manifest/checksum/signature before ECS verifies, downloads, and
runs it. Artifact publishing/signing is a separate deployment-infrastructure
gate. ECS must not run npm ci, tests, builds, TypeScript/Vite compilation, or
migration generation.

## 18. Open Questions

### Blocking

1. `PRODUCTION_DEPLOYMENT_BLOCKER`: standard PostgreSQL does not solve the
   current `NeedLogin` / `request.context.currentUser` production
   authentication boundary. A separate self-hosted auth architecture must be
   approved before production readiness can be declared; auth is not
   implemented by E1.
2. The approved additive `StructuralDocumentContext` and `chunkStructural()`
   seam requires normal implementation authorization, TDD, and regression
   review while preserving the existing tool path at the observable contract
   level; it does not require another architecture/design approval.

### Important

1. What canonical profile should E1 use for text-only `originalContentHash` and
   `normalizedContentHash`?
2. What explicit parser profile/version should represent the accepted C1 parser?
3. Should user text without a file artifact be retained as a durable artifact,
   or only as a hashed parsed input?
4. What retention/deletion policy applies to stored external document content?

### Deferred to later phases

1. Embedding provider and dimensions — E2.
2. Vector/index backend — E2.
3. Academic search provider and pagination — E5.
4. Zotero authorization and attachment import — E4.
5. Retrieval and evidence assembly — E3.
6. Grounded generation and citation rendering — E6.

## 19. Acceptance Criteria for E1 Design

This design is ready for review only if the reviewer agrees that:

1. source identity, document artifact, document version, and chunk are separate
   concepts;
2. metadata-only source records are supported;
3. `SourceRecord` remains optional for `KnowledgeDocument`, and source records
   can relate to multiple documents;
4. canonical metadata fields retain field-level assertions and provenance,
   including conflicting assertions;
5. durable IDs do not reuse request-local C1/C2/C3 IDs;
6. hashes, parser profile, normalization profile, and chunking profile define
   reproducible version identity;
7. E1 uses a neutral additive C2/C3 structural seam and never falsifies a
   Polish/Paper Revision task type;
8. C1/C2/C3 deterministic semantics are reused through one shared chunking core,
   not a second E1 parser/chunker;
9. provenance includes source order and citation-capable locators;
10. evidentiary provenance is separate from prompt execution trust;
11. lifecycle behavior is deterministic and exposes only an E1 content-readiness
    boundary;
12. tenancy and tamper resistance fail closed;
13. the standard PostgreSQL provider and one-time schema ownership transition
    are explicit, including conceptual 0001/0002 migration boundaries, while
    no migration workflow or database mutation is invented here;
14. all E1 out-of-scope capabilities remain excluded.

This document authorizes no implementation. The next governance transition is:

```text
Phase E1 Design Review
→ PHASE_E1_DESIGN_REVIEW_PASS or PHASE_E1_DESIGN_FIX_REQUIRED
→ standard PostgreSQL infrastructure/auth gates
→ separately authorized implementation
```
