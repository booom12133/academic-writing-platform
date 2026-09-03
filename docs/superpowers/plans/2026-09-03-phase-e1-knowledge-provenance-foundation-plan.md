# Phase E1 Knowledge Provenance Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add the E1 knowledge provenance foundation—neutral structural ingestion, user-scoped source/document/version/chunk persistence, field-level metadata provenance, and a content-readiness boundary—without changing accepted tool behavior or entering E2.

**Architecture:** Preserve the existing C1 parser and Polish/Paper Revision C2/C3 path at the observable contract level. Add a neutral C2 StructuralDocumentContext projection and a C3 chunkStructural() entrypoint that both use the existing validation and deterministic/lossless Unicode code-point chunking core. Map that result through an E1 service into seven new user-scoped relational tables; SourceRecord is optional for a KnowledgeDocument, while metadata assertions and external-source links remain append-only. E1 owns lifecycle/readiness only; E2 owns all index operational state.

**Tech Stack:** NestJS, TypeScript, Drizzle runtime types, PostgreSQL through Miaoda DataPaas, generated server/database/schema.ts, pg-mem local development database, Jest, existing C1/C2/C3/C4 modules, and the existing platform file-storage adapter.

**Spec:** docs/superpowers/specs/2026-09-03-phase-e1-knowledge-provenance-foundation-design.md

## Global Constraints

- Start from accepted D4 main 156eb45e00bb727c69bb891f056f384bb600d415 and accepted tag phase-d4-accepted; create the E1 implementation branch only after this plan is approved.
- server/database/schema.ts is generated application mapping; it is never hand-edited and is regenerated only after the Miaoda database change is complete.
- E1 v1 creates only the seven new E1 tables listed in this plan; do not alter app_users, tasks, point_records, or recharge_orders.
- Before any database change, run the existing @lark-apaas/db-schema-sync command against the current database with a temporary output path; if read-only/introspective behavior cannot be proven in the real project environment, stop for review.
- The approved schema-change surface is Miaoda integrated database / connected PostgreSQL management, not a repository-invented Drizzle migration system.
- Every E1 table has mandatory user_id ownership and every read, write, delete, and idempotency lookup is scoped by authenticated userId. Do not assume RLS exists automatically; application predicates plus composite user_id ownership foreign keys/constraints are authoritative for E1 v1.
- Text-only originalContentHash is SHA-256(Buffer.from(originalText, 'utf8')) under profile text-input-utf8-exact-v1; do not trim or normalize it.
- normalizedContentHash is optional in E1 v1; do not invent a normalization serializer.
- Persist parser profile c1-document-parser-v1; do not use a Git SHA as a parser version.
- E1 never supplies taskType: polish or taskType: paper-revision for knowledge ingestion.
- No second parser, context builder, chunker, embedding provider, vector database, retrieval runtime, Zotero connector, Academic Search connector, RAG flow, queue, Redis/BullMQ, billing redesign, or D4 TextGenerationProvider change is permitted.
- chunkStructural() reuses the accepted deterministic, lossless, Unicode-code-point, zero-overlap chunking core; existing build() and chunk() behavior must remain unchanged.
- Initial E1 rollback is only for a pre-traffic verification failure: disable E1, remove only the seven newly-created E1 tables in the reverse dependency order defined in Section 4, regenerate the mapping, and verify the four accepted tables are unchanged. Initial backfill is not applicable.
- No implementation, branch creation, database mutation, destructive SQL, E2 work, commit, push, or PR is authorized by this document.

## 1. File map and ownership

### Files to create

- server/modules/knowledge/knowledge.types.ts — domain contracts, import inputs, provenance, lifecycle, and readiness types.
- server/modules/knowledge/knowledge.errors.ts — typed fail-closed E1 errors and stable error codes.
- server/modules/knowledge/knowledge.hash.ts — exact text-only hash and derivation-fingerprint helpers.
- server/modules/knowledge/knowledge.provenance.ts — C1/C2/C3-to-E1 mapping and citation-locator validation.
- server/modules/knowledge/knowledge.repository.ts — user-scoped relational reads/writes and transaction primitives.
- server/modules/knowledge/knowledge.service.ts — source-record creation, import, re-import, readiness, and tombstone orchestration.
- server/modules/knowledge/knowledge.module.ts — Nest wiring for E1 services and repositories.
- server/modules/knowledge/knowledge.hash.spec.ts — hash/profile RED-GREEN tests.
- server/modules/knowledge/knowledge.provenance.spec.ts — provenance mapping, locator, and malformed-input tests.
- server/modules/knowledge/knowledge.repository.spec.ts — relational constraint, ownership, and atomic persistence tests.
- server/modules/knowledge/knowledge.service.spec.ts — lifecycle, idempotency, artifact, and readiness tests.
- server/modules/knowledge/knowledge.module.spec.ts — module dependency/wiring test.
- scripts/e1-database-preflight.js — a read-only wrapper that writes schema-sync output only to a temporary path and refuses the accepted schema path.
- test/unit/e1-database-preflight.spec.ts — wrapper argument/path/zero-mutation tests.

### Files to modify

- server/modules/context-builder/context-builder.types.ts — add neutral structural source/context/unit types while preserving existing aliases and task contracts.
- server/modules/context-builder/context-builder.service.ts — add the neutral structural projection and preserve existing build output and validation.
- server/modules/context-builder/context-builder.service.spec.ts — test neutral projection and exact Polish/Paper Revision compatibility.
- server/modules/chunking/chunking.types.ts — add neutral structural chunk input/output types without removing task types.
- server/modules/chunking/chunking.service.ts — expose chunkStructural() over the shared existing core; preserve chunk().
- server/modules/chunking/chunking.service.spec.ts — compare neutral and task outputs and cover rejection of tool-task sentinels.
- server/modules/document-input/document-input.service.ts — add an additive readVerified() C4 seam that reuses existing ownership, download, size, and SHA-256 verification.
- server/modules/document-input/document-input.service.spec.ts — cover readVerified() and existing preparation regressions.
- server/database/schema.ts — generated-only diff after Miaoda creates the seven new tables; never hand-edit.
- server/database/local-development.database.ts — mirror the approved seven-table schema in LOCAL_SCHEMA_SQL after generated schema review; leave accepted table definitions unchanged.
- server/database/local-development.database.spec.ts — verify E1 tables exist locally and accepted tables remain available.
- server/app.module.ts — import KnowledgeModule after dependencies are wired; do not change existing module order semantics.

### Files explicitly not modified

- server/modules/document-parsing/\*\* — C1 remains frozen.
- server/modules/ai-tools/**, server/modules/tasks/**, and shared/api.interface.ts — no tool/task/API migration.
- server/database/schema.ts before the platform-generated artifact is available.
- package.json, .spark_project, and CODEX_WORKFLOW.md — no invented migration script or platform workflow.

### Binding execution order

The section order below groups related work for review, but the executor must
run the tasks in this order. This is the approved database sequence and is
binding:

1. Task 1: branch isolation after plan approval.
2. Task 2: finalize the seven-table physical contract, verify the Miaoda
   environment and current table set, and pass the read-only schema-generation
   preflight; then STOP and wait for explicit E1_DATABASE_PREFLIGHT_PASS.
3. Task 7: only after E1_DATABASE_PREFLIGHT_PASS, create the seven new tables through Miaoda, verify metadata/ER/
   constraints, regenerate the mapping, update local pg-mem, and pass parity
   tests.
4. Task 3: add the neutral C2 projection.
5. Task 4: add the neutral C3 shared-core seam.
6. Task 5: add the additive C4 verified-artifact seam.
7. Task 6: add pure E1 contracts, hashes, and provenance mapping.
8. Task 8: add user-scoped repository persistence.
9. Task 9: add atomic import orchestration and content readiness.
10. Task 10: add metadata resolution, immutable versioning, and tombstones.
11. Task 11: wire the Nest module.
12. Task 12: run frozen-path regressions, full verification, and scope audit.

Task 2 ends after the read-only evidence report is returned for ChatGPT review.
No database mutation, Task 7 activity, or E1 repository/domain/service
implementation begins until ChatGPT explicitly returns
E1_DATABASE_PREFLIGHT_PASS. If the preflight cannot be completed or Task 7
cannot be completed through the approved Miaoda surface, stop and return the
issue for review.

## 2. Final E1 domain and physical model

### 2.1 Domain contracts

Implement the following exact conceptual types in server/modules/knowledge/knowledge.types.ts:

    export type KnowledgeSourceKind =
      | 'user-declared'
      | 'scholarly-work'
      | 'reference-library-item';

    export type KnowledgeOriginKind =
      | 'user-upload'
      | 'generated-artifact'
      | 'external-attachment';

    export type KnowledgeLifecycleStatus = 'active' | 'tombstoned';
    export type KnowledgeVersionLifecycleStatus = 'active' | 'tombstoned';
    export type KnowledgeContentReadiness = 'content-ready-for-indexing';
    export type MetadataResolutionStatus = 'resolved' | 'conflicting' | 'unverified';
    export type MetadataVerificationStatus = 'unverified' | 'observed' | 'verified' | 'rejected';
    export type MetadataField =
      | 'title'
      | 'authors'
      | 'year'
      | 'venue'
      | 'abstract'
      | 'doi'
      | 'citationKey';

    export interface Author {
      name: string;
      given?: string;
      family?: string;
      orcid?: string;
    }

    export interface CanonicalField<T> {
      value: T;
      assertionIds: string[];
      resolutionStatus: MetadataResolutionStatus;
    }

    export interface CanonicalFieldInput<T> {
      value: T;
      assertionKeys: string[];
      resolutionStatus: MetadataResolutionStatus;
    }

    export interface CanonicalSourceMetadata {
      title?: CanonicalField<string>;
      authors?: CanonicalField<Author[]>;
      year?: CanonicalField<number>;
      venue?: CanonicalField<string>;
      abstract?: CanonicalField<string>;
      doi?: CanonicalField<string>;
      citationKey?: CanonicalField<string>;
    }

    export interface CanonicalSourceMetadataInput {
      title?: CanonicalFieldInput<string>;
      authors?: CanonicalFieldInput<Author[]>;
      year?: CanonicalFieldInput<number>;
      venue?: CanonicalFieldInput<string>;
      abstract?: CanonicalFieldInput<string>;
      doi?: CanonicalFieldInput<string>;
      citationKey?: CanonicalFieldInput<string>;
    }

    export interface MetadataAssertionInput {
      localKey: string;
      field: MetadataField;
      value: string | number | Author[];
      providerKind: string;
      provider: string;
      externalRecordId: string;
      observedAt?: string;
      verificationStatus: MetadataVerificationStatus;
    }

    export interface MetadataAssertion {
      id: string;
      sourceRecordId: string;
      field: MetadataField;
      value: string | number | Author[];
      providerKind: string;
      provider: string;
      externalRecordId: string;
      observedAt?: string;
      verificationStatus: MetadataVerificationStatus;
      assertionHash: string;
    }

    export interface ExternalProvenance {
      connectorKind: string;
      provider: string;
      externalRecordId: string;
      externalVersion?: string;
      canonicalUrl?: string;
      retrievedAt?: string;
      licenseOrAccessNote?: string;
      verificationStatus: MetadataVerificationStatus;
    }

    export interface SourceRecord {
      id: string;
      userId: string;
      kind: KnowledgeSourceKind;
      canonicalMetadata: CanonicalSourceMetadata;
      externalProvenance: ExternalProvenance[];
      status: KnowledgeLifecycleStatus;
      createdAt: string;
      updatedAt: string;
    }

    export interface KnowledgeDocument {
      id: string;
      userId: string;
      sourceRecordId?: string;
      originKind: KnowledgeOriginKind;
      displayName: string;
      sourceType: 'docx' | 'pdf' | 'txt' | 'markdown';
      activeVersionId?: string;
      lifecycleStatus: KnowledgeLifecycleStatus;
    }

    export interface KnowledgeDocumentVersion {
      id: string;
      userId: string;
      documentId: string;
      versionNumber: number;
      originalContentHash: string;
      normalizedContentHash?: string;
      normalizationProfile?: { name: string; version: string };
      parserProfile: { name: 'c1-document-parser-v1'; version: '1' };
      chunkingProfile: { name: string; version: string; parameters: { maxSize: number } };
      sourceText?: string;
      sourceArtifactRef?: {
        version: 1;
        provider: string;
        bucketId: string;
        filePath: string;
        fileName: string;
        sha256: string;
        sizeBytes: number;
      };
      supersedesVersionId?: string;
      lifecycleStatus: KnowledgeVersionLifecycleStatus;
      readinessStatus: KnowledgeContentReadiness;
      indexInputFingerprint: string;
      createdAt: string;
    }

    export interface KnowledgeChunkProvenance {
      sourceRecordId?: string;
      documentId: string;
      documentVersionId: string;
      sourceBlockId: string;
      sourceBlockIndex: number;
      section: 'content' | 'references';
      headingPath: Array<{ sourceBlockId: string; title: string; level: number }>;
      pageStart?: number;
      pageEnd?: number;
      sourceUnitId: string;
      sourceChunkOrdinal: number;
      itemOrdinal: number;
      fragmentSpan?: { start: number; endExclusive: number };
    }

    export interface CitationLocator {
      documentVersionId: string;
      sourceRecordId?: string;
      externalSourceId?: string;
      section?: 'content' | 'references';
      headingPath?: Array<{ sourceBlockId: string; title: string; level: number }>;
      pageStart?: number;
      pageEnd?: number;
      sourceBlockId?: string;
      sourceBlockIndex?: number;
      fragmentSpan?: { start: number; endExclusive: number };
      chunkId: string;
    }

    export interface KnowledgeChunkDraft {
      userId: string;
      documentVersionId: string;
      ordinal: number;
      text: string;
      textHash: string;
      provenance: KnowledgeChunkProvenance;
      citationLocator: Omit<CitationLocator, 'chunkId'>;
    }

    export interface KnowledgeChunk extends KnowledgeChunkDraft {
      id: string;
      citationLocator: CitationLocator;
    }

Define import inputs with these exact boundaries:

    export type KnowledgeDocumentInput =
      | { kind: 'stored-file'; documentRef: DocumentInputRef }
      | { kind: 'text'; text: string; fileName: string };

    export interface CreateSourceRecordInput {
      userId: string;
      kind: KnowledgeSourceKind;
      canonicalMetadata?: CanonicalSourceMetadataInput;
      metadataAssertions?: MetadataAssertionInput[];
      externalProvenance?: ExternalProvenance[];
    }

    export interface ImportKnowledgeDocumentInput {
      userId: string;
      idempotencyKey: string;
      displayName: string;
      originKind: KnowledgeOriginKind;
      input: KnowledgeDocumentInput;
      sourceRecordId?: string;
      newSourceRecord?: Omit<CreateSourceRecordInput, 'userId'>;
      chunkingPolicy: ChunkingPolicy;
    }

    export interface KnowledgeImportResult {
      document: KnowledgeDocument;
      version: KnowledgeDocumentVersion;
      chunks: KnowledgeChunk[];
      idempotent: boolean;
      readiness: KnowledgeContentReadiness;
    }

newSourceRecord and sourceRecordId are mutually exclusive. newSourceRecord uses Omit<CreateSourceRecordInput, 'userId'> and inherits the outer authenticated ImportKnowledgeDocumentInput.userId; it has no independently supplied userId. A document may have neither. createSourceRecord() is independently callable and accepts its own authenticated userId, so a metadata-only SourceRecord and one source record linked to multiple documents are first-class cases.

### 2.2 Physical relational schema

Create only these seven new tables through Miaoda integrated database management. The table names and constraints below are the physical contract; the platform must expose the resulting generated mappings before repository code is written.

| Table                           | Required columns and constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| knowledge_source_records        | id uuid primary key; user_id varchar(64) not null; kind varchar(32) not null; canonical_metadata jsonb not null default '{}'; status varchar(24) not null; \_created_at and \_updated_at timestamptz not null; unique (id,user_id); index (user_id,status).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| knowledge_metadata_assertions   | id uuid primary key; user_id varchar(64) not null; source_record_id uuid not null; field varchar(32) not null; value jsonb not null; provider_kind varchar(64) not null; provider varchar(128) not null; external_record_id varchar(255) not null; observed_at timestamptz; verification_status varchar(24) not null; assertion_hash varchar(64) not null; \_created_at timestamptz not null; unique (id,user_id); unique (source_record_id,user_id,assertion_hash); composite FK (source_record_id,user_id) to knowledge_source_records(id,user_id); index (user_id,source_record_id,field).                                                                                                                                                                                                                                                                                                  |
| knowledge_source_external_links | id uuid primary key; user_id varchar(64) not null; source_record_id uuid not null; connector_kind varchar(64) not null; provider varchar(128) not null; external_record_id varchar(255) not null; external_version varchar(255) null; canonical_url text null; retrieved_at timestamptz null; license_or_access_note text null; verification_status varchar(24) not null; \_created_at timestamptz not null; unique (id,user_id); unique (user_id,connector_kind,provider,external_record_id); composite FK (source_record_id,user_id) to knowledge_source_records(id,user_id); index (user_id,source_record_id).                                                                                                                                                                                                                                                                              |
| knowledge_documents             | id uuid primary key; user_id varchar(64) not null; source_record_id uuid null; origin_kind varchar(32) not null; display_name varchar(255) not null; source_type varchar(16) not null; active_version_id uuid null; lifecycle_status varchar(24) not null; \_created_at and \_updated_at timestamptz not null; unique (id,user_id); nullable composite FK (source_record_id,user_id) to knowledge_source_records(id,user_id); indexes (user_id,lifecycle_status) and (user_id,source_record_id).                                                                                                                                                                                                                                                                                                                                                                                               |
| knowledge_document_versions     | id uuid primary key; user_id varchar(64) not null; document_id uuid not null; version_number integer not null; original_content_hash varchar(64) not null; normalized_content_hash varchar(64) null; normalization_profile jsonb null; parser_profile jsonb not null; chunking_profile jsonb not null; source_text text null; source_artifact_ref jsonb null; supersedes_version_id uuid null; lifecycle_status varchar(24) not null; readiness_status varchar(32) not null; index_input_fingerprint varchar(64) not null; created_at timestamptz not null; unique (id,user_id); unique (document_id,user_id,version_number); unique (document_id,user_id,index_input_fingerprint); composite FK (document_id,user_id) to knowledge_documents(id,user_id); nullable self-reference for supersedes_version_id scoped by user_id; index (user_id,document_id,lifecycle_status,readiness_status). |
| knowledge_chunks                | id uuid primary key; user_id varchar(64) not null; document_version_id uuid not null; ordinal integer not null; text text not null; text_hash varchar(64) not null; provenance jsonb not null; citation_locator jsonb not null; \_created_at timestamptz not null; unique (id,user_id); unique (document_version_id,user_id,ordinal); composite FK (document_version_id,user_id) to knowledge_document_versions(id,user_id); index (user_id,document_version_id,ordinal).                                                                                                                                                                                                                                                                                                                                                                                                                      |
| knowledge_imports               | id uuid primary key; user_id varchar(64) not null; idempotency_key varchar(255) not null; request_fingerprint varchar(64) not null; document_id uuid null; document_version_id uuid null; status varchar(24) not null; \_created_at and \_updated_at timestamptz not null; unique (id,user_id); unique (user_id,idempotency_key); nullable composite FKs to document and version parent keys; index (user_id,status).                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

There is deliberately no reverse mandatory FK from source records to documents. A SourceRecord may exist without a KnowledgeDocument; one SourceRecord may relate to multiple KnowledgeDocuments; and a KnowledgeDocument may exist without a SourceRecord. Every KnowledgeDocument still has its own durable id, and its versions/chunks remain independently traceable through document_id and document_version_id even when bibliographic identity is absent. source_record_id on a document is nullable. active_version_id is validated in the transaction against the same user/document; it does not introduce a circular initial schema dependency.

canonical_metadata stores the resolved projection, including persisted assertion IDs and resolution status. knowledge_metadata_assertions and knowledge_source_external_links are append-only from the application perspective. A new assertion input first receives a request-local localKey; persistence returns a real assertion ID; canonical field assertionKeys are resolved to those IDs in the same transaction. Conflicting provider/value assertions and external identity links are retained; canonical resolution never deletes or silently overwrites them. knowledge_source_external_links is the sole persistent source of truth for external provenance and identity uniqueness; SourceRecord.externalProvenance[] is hydrated from those rows and is not duplicated in knowledge_source_records. For any chunk, provenance must identify the SourceRecord when one exists, the KnowledgeDocument, the immutable version, and the artifact/structural location; the document/version/chunk identifiers remain sufficient when no SourceRecord exists.

E1 v1 text-only policy: retain the exact original text in knowledge_document_versions.source_text, persist the exact input hash on the version, persist C1/C2/C3-derived chunks and provenance, and leave source_artifact_ref null. This permits automatic re-parsing from the retained source when parser/profile changes create a new version. C4-backed files retain their storage reference and verified SHA-256 and do not duplicate raw bytes in source_text. Any future raw-text retention or physical artifact deletion policy is a separately approved change.

## 3. TDD implementation tasks

### Task 1: Create the isolated E1 implementation branch only after plan approval

**Files:**

- No repository file changes in this task.

**Interfaces:**

- Consumes: accepted D4 main at 156eb45e00bb727c69bb891f056f384bb600d415.
- Produces: one E1 implementation branch based on that commit.

- [ ] Step 1: Verify the plan approval and accepted baseline.

Run:

    git status --short --branch
    git rev-parse main
    git ls-remote --heads --tags origin

Expected: no implementation branch exists yet; main resolves to the accepted commit and the remote contains phase-d4-accepted pointing to that commit.

- [ ] Step 2: Create the E1 branch after approval.

Use the project’s one-Phase/one-branch convention and create exactly one E1 implementation branch from accepted main. Do not develop E1 on main.

- [ ] Step 3: Verify branch isolation.

Run:

    git status --short --branch
    git diff --name-only main...HEAD

Expected: the new branch is checked out and has no implementation diff.

### Task 2: Add a read-only database preflight gate

**Files:**

- Create: scripts/e1-database-preflight.js
- Test: test/unit/e1-database-preflight.spec.ts

**Interfaces:**

- Consumes: one canonical Miaoda target (`appId`, `dbBranch`, API/domain environment, routing context, and local authentication context) and the exact inspected `@lark-apaas/db-schema-sync@0.1.18` invocation.
- Produces: before/after Miaoda schema metadata snapshots, a temporary generated schema artifact, and a pass/fail decision before any E1 table creation.

- [ ] Step 0: Finalize the physical schema contract before connecting to the database.

Use Section 2.2 as the exact seven-table contract, including nullable
source_record_id, mandatory user_id ownership, composite ownership foreign keys,
field-level assertion storage, immutable version/chunk keys, and the unique
per-user idempotency key. Resolve the canonical Miaoda application, branch,
API/domain environment, routing context, and authentication context before the
read-only preflight begins. Do not use PostgreSQL information_schema for Task 2.

- [ ] Step 1: Write the failing wrapper tests.

Test these exact behaviors:

    rejects an output path equal to server/database/schema.ts
    uses a temporary directory outside the repository schema path
    invokes exactly @lark-apaas/db-schema-sync@0.1.18 with --export-custom-types
    passes canonical appId and dbBranch into the child environment
    cannot be redirected by conflicting inherited target-routing variables
    keeps before/generator/after target fingerprints identical
    keeps before/after normalized schema SHA-256 identical
    performs metadata inventory through GET only, without platform mutation
    never includes authentication secrets in target/report output
    returns failure when the generator exits non-zero

The test must assert the child-process argument vector and protected output path, not merely that a mock was called.

- [ ] Step 2: Run the wrapper tests and confirm RED.

Run:

    npx jest test/unit/e1-database-preflight.spec.ts --runInBand

Expected: failure because the wrapper does not yet exist.

- [ ] Step 3: Implement the minimum read-only wrapper.

The script must:

1. create a temporary directory using Node filesystem APIs;
2. invoke exactly npx -y @lark-apaas/db-schema-sync@0.1.18 --output <temp>/schema.ts --export-custom-types;
3. refuse any configured output that resolves to the accepted schema path;
4. resolve one canonical target and use it for the Miaoda GET schema metadata snapshot before the generator, the child environment, and the snapshot after the generator;
5. normalize both metadata responses deterministically and compute SHA-256 snapshots;
6. fail if target fingerprints differ or the before/after normalized schema hashes differ;
7. print only redacted target identity, package version, temporary output path/hash, object summaries, and schema comparison without overwriting repository files;
8. remove only its own temporary directory after the result is recorded.

The script must use GET-only Miaoda metadata access, must not issue platform mutation requests, and must not claim success when the exact package behavior, canonical target, authentication context, or read-only introspection evidence cannot be established.

- [ ] Step 4: Run the wrapper tests and confirm GREEN.

Run the same Jest command. Expected: all wrapper tests pass.

- [ ] Step 5: Run the real project preflight before database changes.

Record, without changing the database:

    exact canonical Miaoda appId, dbBranch, API/domain environment, routing context, and redacted target fingerprint
    current schema metadata object/table inventory
    absence of all seven E1 table names
    exact executed package version (`0.1.18`)
    temporary schema-sync output path/hash and comparison with current generated schema
    unchanged normalized schema metadata hash after schema generation
    current database/object quota and remaining capacity for seven tables
    permission result for creating seven tables, indexes, and constraints
    whether an account plan upgrade or payment is required

If the real generator mutates metadata/data, cannot connect to the intended database, cannot be proven read-only, lacks permission, lacks quota, or requires payment/plan upgrade, stop and return the issue to the user/reviewer. Codex must not purchase, upgrade, or authorize payment. Return the complete preflight report to ChatGPT and stop; do not self-accept it. The report must contain target Miaoda environment identity, current table inventory, E1 table absence, temporary schema-generation result, existing-schema comparison, before/after table inventory, quota/permission result, and explicit confirmation of zero database mutation. No later task may create E1 tables until ChatGPT explicitly returns E1_DATABASE_PREFLIGHT_PASS.

- [ ] Step 6: Commit the preflight tooling.

Commit the wrapper, its tests, and the Task-2 evidence report with:

    test(e1): add read-only database schema preflight

### Task 3: Add the neutral C2 structural projection

**Files:**

- Modify: server/modules/context-builder/context-builder.types.ts
- Modify: server/modules/context-builder/context-builder.service.ts
- Test: server/modules/context-builder/context-builder.service.spec.ts

**Interfaces:**

- Consumes: C1 ParsedDocument.
- Produces: ContextBuilderService.buildStructural(document) returning StructuralDocumentContext with no task type.

Define these neutral types:

    export interface StructuralDocumentContext {
      version: 1;
      source: StructuralDocumentSource;
      units: StructuralContextUnit[];
    }

    export type StructuralDocumentSource = ContextDocumentSource;
    export type StructuralContextUnit = ContextUnit;

    export interface TaskContext {
      version: 1;
      task: { type: ContextTaskType; userInstructions?: string };
      source: StructuralDocumentSource;
      units: StructuralContextUnit[];
    }

Keep the existing exported ContextDocumentSource and ContextUnit names as compatible aliases so existing consumers do not change shape.

- [ ] Step 1: Write the failing neutral-projection tests.

Add tests named:

    buildStructural returns source, ordered units, section, headingPath, and warnings without a task field
    buildStructural produces the same source and units as build for polish
    buildStructural produces the same source and units as build for paper-revision
    buildStructural rejects the same malformed ParsedDocument cases as build

Assert that the result has no task property and that nested blocks and heading paths are copied rather than shared.

- [ ] Step 2: Run C2 tests and confirm RED.

Run:

    npx jest server/modules/context-builder/context-builder.service.spec.ts --runInBand

Expected: the new neutral API tests fail because it is not defined.

- [ ] Step 3: Implement the minimal additive projection.

Extract the existing source/unit construction into a private structural builder or additive buildStructural(document) method. Preserve the existing heading-stack algorithm, reference-section detection, validation order, error codes, IDs, copying, and warning snapshots. Implement build(input) as the existing task wrapper around that structural result, preserving its exact task field and observable output.

- [ ] Step 4: Run C2 tests and confirm GREEN.

Run the focused suite again. Expected: all existing and neutral-projection tests pass.

- [ ] Step 5: Commit the C2 seam.

Commit:

    feat(e1): add neutral structural context projection

### Task 4: Add the neutral C3 shared-core seam

**Files:**

- Modify: server/modules/chunking/chunking.types.ts
- Modify: server/modules/chunking/chunking.service.ts
- Test: server/modules/chunking/chunking.service.spec.ts

**Interfaces:**

    export interface ChunkStructuralDocumentInput {
      context: StructuralDocumentContext;
      policy: ChunkingPolicy;
    }

    export interface StructuralChunkedDocument {
      version: 1;
      source: StructuralDocumentContext['source'];
      policy: AppliedChunkingPolicy;
      chunks: Chunk[];
      warnings: ChunkingWarning[];
    }

    chunkStructural(input: ChunkStructuralDocumentInput): StructuralChunkedDocument;

- [ ] Step 1: Write the failing shared-semantics tests.

Add tests named:

    chunkStructural returns structural chunks without a task field
    chunkStructural matches chunk chunk arrays, warnings, policy, ordering, and Unicode spans
    chunkStructural preserves atomic units, hard splits, sections, and heading paths
    chunkStructural rejects malformed structural contexts
    chunk never accepts or manufactures a structural context through a tool task sentinel

The comparison test must feed the same structural source through a test-only Polish TaskContext wrapper and compare only the neutral result; it must assert that E1’s API itself never accepts a task field.

- [ ] Step 2: Run C3 tests and confirm RED.

Run:

    npx jest server/modules/chunking/chunking.service.spec.ts --runInBand

Expected: new neutral API tests fail because it is not defined.

- [ ] Step 3: Extract only the shared chunking core.

Move the existing chunk accumulation, fragment splitting, warning creation, policy application, copying, and validation helpers into a neutral internal core. chunkStructural() validates only the neutral structural context and returns StructuralChunkedDocument. chunk() retains its current task validation and wraps the same core result with the existing task object.

Do not change chunk IDs, warning messages/codes, order, size metric, overlap, Unicode code-point spans, or error codes/messages. If refactoring changes any observable result, revert the refactor and use a smaller extraction.

- [ ] Step 4: Run focused C3 tests and all existing C1-C3 tests.

Run:

    npx jest server/modules/chunking/chunking.service.spec.ts server/modules/context-builder/context-builder.service.spec.ts server/modules/document-parsing --runInBand

Expected: all pass with the neutral seam and no Polish/Paper Revision regression.

- [ ] Step 5: Commit the C3 seam.

Commit:

    feat(e1): add neutral structural chunking seam

### Task 5: Add the additive C4 verified-artifact seam

**Files:**

- Modify: server/modules/document-input/document-input.service.ts
- Test: server/modules/document-input/document-input.service.spec.ts

**Interfaces:**

    export interface VerifiedDocumentInput {
      document: DocumentInputRef;
      buffer: Buffer;
    }

    readVerified(userId: string, ref: DocumentInputRef): Promise<VerifiedDocumentInput>;

- [ ] Step 1: Write failing tests for C4 verification.

Test that readVerified():

    rejects a foreign user path before storage download
    rejects a foreign bucket before storage download
    rejects a descriptor hash mismatch
    rejects a descriptor size mismatch
    returns the trusted descriptor and exact downloaded Buffer
    does not invoke C2/C3 or require a taskType

Add regression assertions that existing prepare() behavior and error codes remain unchanged for Polish/Paper Revision callers.

- [ ] Step 2: Run the focused C4 tests and confirm RED.

Run:

    npx jest server/modules/document-input/document-input.service.spec.ts --runInBand

Expected: new method tests fail because the additive seam is absent.

- [ ] Step 3: Implement readVerified() by reusing existing validation.

Move or call the existing validateRef(), download logic, size check, and SHA-256 check without changing their conditions or messages. Return a copy of the trusted descriptor and the verified buffer. Refactor prepare() only if existing tests prove identical behavior; do not make prepare() accept a neutral task type and do not alter storage ownership rules.

- [ ] Step 4: Run C4 tests and confirm GREEN.

Run the same focused suite. Expected: all existing and new tests pass.

- [ ] Step 5: Commit the C4 seam.

Commit:

    feat(e1): expose verified document input boundary

### Task 6: Add pure E1 contracts, hashing, and provenance mapping

**Files:**

- Create: server/modules/knowledge/knowledge.types.ts
- Create: server/modules/knowledge/knowledge.errors.ts
- Create: server/modules/knowledge/knowledge.hash.ts
- Create: server/modules/knowledge/knowledge.provenance.ts
- Test: server/modules/knowledge/knowledge.hash.spec.ts
- Test: server/modules/knowledge/knowledge.provenance.spec.ts

**Interfaces:**

    export function hashTextInputExact(text: string): string;
    export function computeChunkTextHash(text: string): string;
    export function computeDerivationFingerprint(input: {
      originalContentHash: string;
      normalizedContentHash?: string;
      parserProfile: { name: string; version: string };
      normalizationProfile?: { name: string; version: string };
      chunkingProfile: { name: string; version: string; parameters: { maxSize: number } };
    }): string;

    export function mapStructuralChunksToKnowledgeChunkDrafts(input: {
      userId: string;
      sourceRecordId?: string;
      documentId: string;
      documentVersionId: string;
      chunks: Chunk[];
    }): KnowledgeChunkDraft[];

    export function finalizeKnowledgeChunkDraft(input: {
      draft: KnowledgeChunkDraft;
      chunkId: string;
    }): KnowledgeChunk;

    export function validateCitationLocator(locator: CitationLocator): void;

- [ ] Step 1: Write failing hash tests.

Test exact UTF-8 behavior with ASCII, Chinese text, emoji, empty text, CRLF, trailing spaces, and composed/decomposed Unicode. Assert that only Buffer.from(text, utf8) changes the digest; no trim, line-ending, whitespace, or Unicode normalization is applied. Assert in the service/version contract, rather than in the hash-only helper, that the persisted profile name is text-input-utf8-exact-v1.

- [ ] Step 2: Run hash tests and confirm RED.

Run:

    npx jest server/modules/knowledge/knowledge.hash.spec.ts --runInBand

Expected: failure because the helpers are not defined.

- [ ] Step 3: Implement exact hashing and fingerprint helpers.

Use Node crypto.createHash('sha256').update(Buffer.from(text, 'utf8')) for text-only input. Keep normalized hash optional and exclude absent optional profiles from the serialized fingerprint with deterministic key order. Never use a normalized hash in place of the original hash.

- [ ] Step 4: Write failing provenance tests.

Test that mapping preserves:

    sourceRecordId when present and omits it when absent
    document and immutable version IDs
    source block ID and source block index
    content/reference section
    heading path snapshot
    optional page locator
    C3 source unit and parent chunk/item order
    Unicode code-point fragment spans
    chunk text and text hash

Test that each C3 ChunkItem yields exactly one draft, whole-unit text comes from item.unit.block.text, fragment text comes from item.text, sourceChunkOrdinal and itemOrdinal are retained, and flattened ordinals are globally monotonic across all parent C3 chunks. Test invalid spans, missing document/version IDs, mismatched chunk/item order, and a locator without a document version or chunk. Test that the pure mapper allocates no UUID, returns no chunkId, and no C3 request-local ID becomes a durable E1 ID; finalization alone allocates a durable UUID and fills CitationLocator.chunkId.

- [ ] Step 5: Run provenance tests and confirm RED.

Run:

    npx jest server/modules/knowledge/knowledge.provenance.spec.ts --runInBand

Expected: failure because the mapper and validator are not defined.

- [ ] Step 6: Implement the minimum pure mapping layer.

Flatten exactly one E1 KnowledgeChunkDraft from each C3 ChunkItem. For parent C3 chunk index chunkOrdinal and item index itemOrdinal, set sourceChunkOrdinal to chunkOrdinal, itemOrdinal to itemOrdinal, and set KnowledgeChunkDraft.ordinal to one globally monotonic flattened ordinal across the complete document version: C3 chunk 0/item 0 → E1 ordinal 0, chunk 0/item 1 → 1, chunk 1/item 0 → 2. Use whole-unit item.unit.block.text for whole-unit items and item.text for fragment items. The pure mapper returns drafts only and never calls randomUUID(). It carries no durable E1 chunk ID and leaves CitationLocator.chunkId absent. The persistence orchestration allocates the durable UUID, finalizes CitationLocator.chunkId, and then inserts the final KnowledgeChunk. Validate page ranges without inventing pages for text/Markdown.

- [ ] Step 7: Run focused pure E1 tests and confirm GREEN.

Run both E1 pure suites. Expected: all tests pass with the exact hash/profile and provenance rules.

- [ ] Step 8: Commit pure E1 contracts.

Commit:

    feat(e1): add knowledge provenance contracts and mapping

### Task 7: Complete the approved database change sequence

**Files:**

- Generated modify: server/database/schema.ts
- Modify: server/database/local-development.database.ts
- Test: server/database/local-development.database.spec.ts

**Interfaces:**

- Consumes: accepted E1 physical schema in Section 2.2 and accepted real database preflight evidence from Task 2.
- Produces: generated Drizzle mappings for exactly seven new tables and matching local pg-mem definitions.

- [ ] Step 1: Finalize the physical table contract.

Review the exact seven table names, columns, nullable source relationship, composite user-scoped foreign keys, external identity uniqueness, unique idempotency key, and indexes with the accepted E1 design. Confirm the platform supports UUID, jsonb, text, varchar, integer, and timestamptz before creating anything.

- [ ] Step 2: Verify the correct Miaoda database/environment.

Record the project/app/environment identity and authenticated operator context. Do not use a local or unrelated database. Repeat the read-only inventory and confirm the seven E1 table names are absent and the four accepted table names are present.

- [ ] Step 3: Create only the seven new tables through Miaoda.

Use the approved integrated database management surface. Do not use server/database/schema.ts as DDL. Do not run repository SQL, drizzle-kit, or ad-hoc CREATE TABLE commands. Configure only the constraints/indexes in Section 2.2 and leave all accepted tables untouched.

- [ ] Step 4: Verify the database change before application mapping.

Use table metadata, the platform ER representation, and controlled read-only queries to verify all seven tables, columns, nullability, foreign keys, unique constraints, and indexes. Record that no existing table changed.

- [ ] Step 5: Run the read-only schema-generation preflight against the changed database.

Use the temporary-output wrapper again. The output must include the seven new tables and must not overwrite server/database/schema.ts.

- [ ] Step 6: Regenerate the application mapping from the changed database.

Run the project’s generator only after the platform database change is verified:

    npm run gen:db-schema

Review the generated diff. Confirm it contains only the new E1 mappings and does not alter accepted table definitions unexpectedly. If the generated mapping is inconsistent with platform table metadata, stop before code implementation.

- [ ] Step 7: Update local pg-mem after generated mapping review.

Add the seven E1 CREATE TABLE definitions to LOCAL_SCHEMA_SQL using the approved database shape. Keep the four accepted definitions unchanged. Add only local test data needed for E1 tests; do not add production seed behavior.

- [ ] Step 8: Write and run local parity tests.

Test that local initialization exposes the seven generated E1 tables, accepted tables still support current services, composite ownership constraints reject cross-user parent references, nullable source_record_id works, the external identity unique constraint exists, and the idempotency unique constraint exists. Assert that knowledge_source_records has no external_provenance column and that repository hydration reads SourceRecord.externalProvenance[] only from knowledge_source_external_links.

Run:

    npx jest server/database/local-development.database.spec.ts --runInBand

Expected: PASS before proceeding to repository code.

- [ ] Step 9: Record initial rollback readiness.

Before enabling any E1 traffic, record the exact seven table names and platform operation that removes only those tables. This is a verification-failure rollback artifact, not a generalized migration policy. Initial backfill is recorded as NOT APPLICABLE.

- [ ] Step 10: Commit the generated database mapping and local parity.

Commit only the generated mapping and local mirror/tests:

    feat(e1): add generated knowledge database mappings

### Task 8: Implement source metadata and provenance persistence

**Files:**

- Create/modify: server/modules/knowledge/knowledge.repository.ts
- Test: server/modules/knowledge/knowledge.repository.spec.ts

**Interfaces:**

    export interface KnowledgeRepository {
      createSourceRecord(input: CreateSourceRecordInput): Promise<SourceRecord>;
      createExternalLinks(input: {
        userId: string;
        sourceRecordId: string;
        links: ExternalProvenance[];
      }): Promise<void>;
      getSourceRecord(userId: string, sourceRecordId: string): Promise<SourceRecord | null>;
      createDocument(input: {
        userId: string;
        sourceRecordId?: string;
        originKind: KnowledgeOriginKind;
        displayName: string;
        sourceType: KnowledgeDocument['sourceType'];
      }): Promise<KnowledgeDocument>;
      createVersion(input: Omit<KnowledgeDocumentVersion, 'id' | 'createdAt'>): Promise<KnowledgeDocumentVersion>;
      createChunks(input: KnowledgeChunk[]): Promise<KnowledgeChunk[]>;
      findImport(userId: string, idempotencyKey: string): Promise<{
        requestFingerprint: string;
        documentId?: string;
        documentVersionId?: string;
        status: string;
      } | null>;
      createImportMarker(input: {
        userId: string;
        idempotencyKey: string;
        requestFingerprint: string;
      }): Promise<string>;
      completeImport(userId: string, importId: string, documentId: string, documentVersionId: string): Promise<void>;
      tombstoneDocument(userId: string, documentId: string): Promise<void>;
    }

- [ ] Step 1: Write failing repository tests against local pg-mem.

Test:

    creates a metadata-only SourceRecord with no document
    creates two documents linked to one SourceRecord
    creates a document without a SourceRecord
    hydrates SourceRecord.externalProvenance[] only from knowledge_source_external_links
    rejects duplicate external identity for the same user/connector/provider/record
    persists field-level assertions without overwriting conflicting values
    rejects a source/document/version/chunk cross-user relationship
    enforces unique import idempotency per user
    persists immutable versions and ordered chunks

Use the real local Drizzle database where possible. Use a narrow transaction adapter only where the platform transaction object cannot be constructed in a unit test.

- [ ] Step 2: Run repository tests and confirm RED.

Run:

    npx jest server/modules/knowledge/knowledge.repository.spec.ts --runInBand

Expected: failure because repository methods are not defined.

- [ ] Step 3: Implement user-scoped repository methods.

Every query predicate must include user_id = userId. Use composite foreign keys and application checks together. Never return another user’s existence; foreign or missing IDs map to the same not-found behavior. Insert metadata assertions before resolving canonical metadata IDs and preserve assertion rows as append-only evidence. Convert CreateSourceRecordInput.externalProvenance into knowledge_source_external_links rows in the same transaction; never write a duplicate external_provenance JSONB column on knowledge_source_records. Hydrate the domain SourceRecord.externalProvenance[] by querying those link rows.

Do not update an existing version or chunk. A new derivation creates a new version number and supersedes_version_id; the document active pointer is updated only after all chunks are persisted.

- [ ] Step 4: Run repository tests and confirm GREEN.

Run the focused suite. Expected: all source/document/version/chunk, provenance, conflict, and ownership tests pass.

- [ ] Step 5: Commit repository persistence primitives.

Commit:

    feat(e1): add user-scoped knowledge repository

### Task 9: Implement E1 import orchestration and atomic readiness

**Files:**

- Create: server/modules/knowledge/knowledge.service.ts
- Test: server/modules/knowledge/knowledge.service.spec.ts

**Interfaces:**

    export class KnowledgeService {
      createSourceRecord(input: CreateSourceRecordInput): Promise<SourceRecord>;
      importDocument(input: ImportKnowledgeDocumentInput): Promise<KnowledgeImportResult>;
      tombstoneDocument(userId: string, documentId: string): Promise<void>;
    }

- [ ] Step 1: Write failing service tests for text-only import.

Test that a text import:

    hashes exact original UTF-8 text under text-input-utf8-exact-v1
    uses c1-document-parser-v1
    calls buildStructural(), never build({ taskType: ... })
    calls chunkStructural(), never chunk({ context: TaskContext, ... }) for E1
    persists document, immutable version, ordered chunks, and content-ready-for-indexing
    retains the exact source_text and leaves source_artifact_ref null
    does not call an LLM, embedding, retrieval, connector, or E2 service

Test text with emoji and CRLF to prove the stored original hash is exact.

- [ ] Step 2: Run service tests and confirm RED.

Run:

    npx jest server/modules/knowledge/knowledge.service.spec.ts --runInBand

Expected: failure because the service is not defined.

- [ ] Step 3: Write failing service tests for C4-backed files.

Test that a stored-file import:

    calls DocumentInputService.readVerified(userId, documentRef)
    uses the returned exact buffer and descriptor SHA-256
    rejects before persistence when verification fails
    stores the verified artifact reference on the version
    does not trust a client-supplied hash without re-reading the artifact

- [ ] Step 3a: Write the concurrent idempotency regression before implementation.

Start two real import calls concurrently with the same userId and
idempotencyKey. Assert that the unique marker permits exactly one durable
import, both same-fingerprint callers receive the same document/version result,
and no raw PostgreSQL unique-violation error escapes. Repeat with a different
request fingerprint and assert that the loser receives the typed idempotency
conflict and creates no second document/version.

- [ ] Step 4: Implement input preparation without falsifying task type.

For text input, call DocumentParserService.parse() with a UTF-8 Buffer and a safe .txt file name, then ContextBuilderService.buildStructural(parsed) and ChunkingService.chunkStructural({ context, policy }). For stored files, use readVerified(), parse the returned buffer, and use the same neutral C2/C3 path. Never call C2 build() or C3 chunk() from E1.

- [ ] Step 5: Implement atomic import orchestration.

Within one database transaction:

1. validate non-empty userId, safe display name, idempotency key, source relationship, and chunking policy;
2. compute the request fingerprint from user scope, input identity, exact original hash, parser profile, and chunking profile;
3. return the prior result when the same user/key/fingerprint exists;
4. use an atomic insert-on-conflict-do-nothing marker for (user_id,idempotency_key), then re-read the winner by userId; return the existing result for the same fingerprint, and throw a typed idempotency conflict for a different fingerprint without exposing a raw PostgreSQL unique violation;
5. create a source record only when newSourceRecord is supplied, using the outer authenticated userId rather than accepting a nested userId;
6. verify an existing sourceRecordId belongs to the same user;
7. create the document with nullable source relation;
8. create the immutable version with original hash, optional normalized hash, parser/chunking profiles, exact source_text for text input or verified source artifact reference for C4 files, lifecycle status, separate content readiness, and fingerprint;
9. flatten every C3 ChunkItem into a draft, allocate one durable UUID per draft in the orchestration layer, fill CitationLocator.chunkId, and insert all final chunks in globally monotonic ordinal order;
10. update the document active-version pointer only after chunk insertion;
11. mark the import complete and return content-ready-for-indexing.

Any parser, provenance, hash, ownership, constraint, or chunk persistence error must abort the complete transaction. E1 must never create an E2 indexed/stale/failed/retry state.

- [ ] Step 6: Run service tests and confirm GREEN.

Run the service suite. Expected: text-only, C4 file, idempotency, conflict, atomic-failure, readiness, and no-sentinel tests pass.

- [ ] Step 7: Commit import orchestration.

Commit:

    feat(e1): persist atomic knowledge imports

### Task 10: Add metadata resolution, versioning, delete, and tombstone rules

**Files:**

- Modify: server/modules/knowledge/knowledge.service.ts
- Modify: server/modules/knowledge/knowledge.repository.ts
- Test: server/modules/knowledge/knowledge.service.spec.ts
- Test: server/modules/knowledge/knowledge.repository.spec.ts

**Interfaces:**

    resolveCanonicalMetadata(input: {
      sourceRecordId: string;
      canonicalMetadata: CanonicalSourceMetadata;
      assertionIds: string[];
    }): Promise<SourceRecord>;

    createNextVersion(input: ImportKnowledgeDocumentInput & {
      documentId: string;
    }): Promise<KnowledgeImportResult>;

- [ ] Step 1: Write failing lifecycle tests.

Test that:

    conflicting metadata assertions remain stored and canonical status is conflicting
    re-import never mutates an existing version or chunk
    changed content creates versionNumber + 1 and supersedesVersionId
    changed parser/chunking profile creates a new version
    unchanged idempotent content returns the existing version
    activeVersionId cannot reference another document’s version, even for the same user
    rejects title referencing a DOI assertion
    rejects a canonical value unsupported by its assertions
    requires all supporting assertions to agree for resolved canonical fields
    retains conflicting same-field assertions
    requires a conflicting canonical value to match at least one real assertion
    tombstoning hides the document from future imports/reads but preserves authorized history
    physical C4 artifact deletion is not performed by E1 metadata tombstoning

- [ ] Step 2: Run lifecycle tests and confirm RED.

Run the two focused E1 suites. Expected: new lifecycle cases fail.

- [ ] Step 3: Implement append-only resolution and immutable lifecycle.

For createSourceRecord(), validate every input assertion localKey is unique, persist each MetadataAssertionInput first, and build a localKey → persisted assertion ID map from the returned rows. For every CanonicalFieldInput, resolve each assertionKey through that map and reject an unknown key rather than matching on value. Require every resolved assertion.field to equal the canonical metadata field; require at least one referenced assertion value to equal the selected canonical value; for resolutionStatus = resolved require all referenced supporting assertion values to agree with the canonical value; for resolutionStatus = conflicting allow multiple differing same-field assertions but require the selected canonical value to equal at least one real assertion. Store selected values plus persisted assertion IDs and resolution status. Persist externalProvenance through knowledge_source_external_links and hydrate the domain array only from those rows. Keep lifecycleStatus (active/tombstoned) separate from readinessStatus (content-ready-for-indexing). Validate activeVersionId against both userId and documentId before updating it. On re-import, compare the derivation fingerprint and either return the existing result or create a new immutable version. Tombstone only user-scoped E1 records and leave C4 storage deletion to a separately authorized retention operation. Use the same atomic insert-on-conflict-do-nothing plus user-scoped re-read strategy for concurrent imports; never expose the database unique violation.

- [ ] Step 4: Run lifecycle tests and confirm GREEN.

Expected: all metadata, version, re-import, and tombstone tests pass.

- [ ] Step 5: Commit lifecycle behavior.

Commit:

    feat(e1): add immutable knowledge lifecycle and metadata resolution

### Task 11: Wire the E1 Nest module without adding an API or E2 behavior

**Files:**

- Create: server/modules/knowledge/knowledge.module.ts
- Modify: server/app.module.ts
- Test: server/modules/knowledge/knowledge.module.spec.ts

**Interfaces:**

- Consumes: DocumentParsingModule, ContextBuilderModule, ChunkingModule, DocumentInputModule, and the platform DRIZZLE_DATABASE token.
- Produces: injectable KnowledgeService and KnowledgeRepository only; no controller and no shared API contract.

- [ ] Step 1: Write the failing module test.

Assert that a Nest testing module can resolve KnowledgeService, its parser, neutral context builder, neutral chunker, verified document input service, and database provider. Assert no controller route or E2 provider is registered.

- [ ] Step 2: Run the module test and confirm RED.

Run:

    npx jest server/modules/knowledge/knowledge.module.spec.ts --runInBand

Expected: failure because the module is not defined.

- [ ] Step 3: Implement the minimal module and app import.

Import the dependency modules, provide the repository and service, export only the service if a future internal consumer needs it, and add KnowledgeModule to AppModule. Do not add a public E1 HTTP controller in v1.

- [ ] Step 4: Run the module test and application bootstrap test.

Run:

    npx jest server/modules/knowledge/knowledge.module.spec.ts --runInBand
    npm run test:app-bootstrap

Expected: both pass with existing application bootstrap behavior unchanged.

- [ ] Step 5: Commit module wiring.

Commit:

    feat(e1): wire knowledge provenance module

### Task 12: Add frozen-path regression tests and complete verification

**Files:**

- Modify: server/modules/context-builder/context-builder.service.spec.ts
- Modify: server/modules/chunking/chunking.service.spec.ts
- Modify: server/modules/document-input/document-input.service.spec.ts
- Test additions: server/modules/knowledge/\*.spec.ts
- No production changes in this task unless a failing E1 test identifies a defect introduced by the immediately preceding E1 work.

- [ ] Step 1: Run the complete C1-C4 and E1 focused suites.

Run:

    npx jest server/modules/document-parsing server/modules/context-builder server/modules/chunking server/modules/document-input server/modules/knowledge server/database --runInBand

Expected: all focused suites pass, including exact existing Polish/Paper Revision C2/C3 output snapshots and neutral E1 no-sentinel tests.

- [ ] Step 2: Run task/tool regression suites.

Run:

    npx jest server/modules/ai-tools server/modules/tasks test/unit/polish-migration-client.spec.ts test/unit/paper-revision-migration-client.spec.ts --runInBand

Expected: accepted D2/D3/D4 behavior remains green. Do not repair the inherited test/unit/platform-command.spec.ts issue in E1.

- [ ] Step 3: Run repository quality gates.

Run:

    npm test -- --runInBand
    npm run lint
    npm run type:check
    npm run build
    npm run test:app-bootstrap

Expected: record each exit code and test count. Any failure is fixed with a new failing test first or returned for review if it is outside E1 scope.

- [ ] Step 4: Run the explicit scope audit.

Verify:

    git diff --name-only main...HEAD
    git diff -- server/modules/ai-tools server/modules/tasks shared/api.interface.ts
    git diff --stat

Confirm that only the planned E1/C2/C3/C4 additive files, generated mapping, local mirror, tests, and preflight tooling changed; no existing database table, D4 provider, vector/search/connector/queue code, or inherited platform-command behavior changed.

- [ ] Step 5: Commit verification-only test adjustments if required.

If preceding steps required only test additions, commit:

    test(e1): cover provenance boundaries and frozen-path regressions

Otherwise keep earlier implementation commits intact and record the exact fixing commit in the PR description.

## 4. Database preflight, apply, verify, and rollback protocol

The future executor must follow this exact order and record evidence in the PR:

    finalize seven-table physical schema
    → verify Miaoda database/environment
    → record accepted table set and E1 absence
    → run db-schema-sync to temporary output
    → prove no metadata/data mutation
    → create only seven E1 tables through Miaoda
    → verify metadata/ER/controlled reads
    → regenerate server/database/schema.ts
    → review generated diff
    → update local pg-mem mirror
    → run parity/constraint tests
    → implement repository/domain/service code
    → run full verification

Initial rollback is allowed only before E1 traffic/data is enabled and only when verification fails. Execute the reverse dependency order exactly:

    verification failure
    → disable E1
    → remove only knowledge_chunks
    → remove only knowledge_imports
    → remove only knowledge_document_versions
    → remove only knowledge_metadata_assertions
    → remove only knowledge_source_external_links
    → remove only knowledge_documents
    → remove only knowledge_source_records
      through the approved Miaoda surface
    → regenerate schema mapping
    → verify app_users/tasks/point_records/recharge_orders unchanged

No historical E1 data exists for this greenfield phase, so initial backfill is NOT APPLICABLE. Any future destructive ALTER, historical-data migration, or production backfill requires a separate approved database policy.

## 5. Commit sequence and PR scope

Planned commits, in order:

1. test(e1): add read-only database schema preflight
2. feat(e1): add generated knowledge database mappings
3. feat(e1): add neutral structural context projection
4. feat(e1): add neutral structural chunking seam
5. feat(e1): expose verified document input boundary
6. feat(e1): add knowledge provenance contracts and mapping
7. feat(e1): add user-scoped knowledge repository
8. feat(e1): persist atomic knowledge imports
9. feat(e1): add immutable knowledge lifecycle and metadata resolution
10. feat(e1): wire knowledge provenance module
11. test(e1): cover provenance boundaries and frozen-path regressions

The PR must contain only the plan’s E1 changes and explicitly approved additive C2/C3/C4 seams. It must include targeted test results, database preflight evidence, platform-created table evidence, generated schema diff, local parity results, rollback record, full test/lint/type-check/build/bootstrap results, and a scope audit. The PR must state that E1 ends at content-ready-for-indexing and E2 owns indexed/stale/failed/retry state.

## 6. Explicit out-of-scope audit

The implementation must not include:

- EmbeddingProvider, embedding calls, embedding model selection, or vector dimensions.
- Vector database, pgvector, Qdrant, Milvus, Chroma, or any other index backend.
- RetrievalIndex, retrieval runtime, ranking, reranking, or evidence search.
- Zotero, Academic Search, OpenAlex, connector authorization, pagination, or connector-specific logic.
- RAG, grounded generation, citation generation, or citation rendering.
- Queues, workers, Redis, BullMQ, retries owned by E2, or background indexing.
- Billing redesign or changes to accepted task/points behavior.
- Changes to app_users, tasks, point_records, or recharge_orders.
- Changes to D4 TextGenerationProvider, DeepSeek provider, or AI execution contracts.
- Repair of inherited test/unit/platform-command.spec.ts behavior.
- Hand-edited server/database/schema.ts, Drizzle migration files, or invented migration/apply/rollback tooling.
- Destructive SQL outside the approved Miaoda greenfield table-removal rollback operation.
- A second parser, context builder, chunker, or provenance system.
- A public E1 API/controller unless separately approved.

This plan authorizes planning only. Implementation starts only after ChatGPT approves this plan and explicitly authorizes the next transition.
