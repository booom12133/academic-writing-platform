# Phase E1 Knowledge Provenance Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add the E1 knowledge provenance foundation—neutral structural ingestion, user-scoped source/document/version/chunk persistence, field-level metadata provenance, and a content-readiness boundary—without changing accepted tool behavior or entering E2.

**Architecture:** Preserve the existing C1 parser and Polish/Paper Revision C2/C3 path at the observable contract level. Add a neutral C2 StructuralDocumentContext projection and a C3 chunkStructural() entrypoint that both use the existing validation and deterministic/lossless Unicode code-point chunking core. Map that result through an E1 service into seven new user-scoped relational tables; SourceRecord is optional for a KnowledgeDocument, while metadata assertions and external-source links remain append-only. E1 owns lifecycle/readiness only; E2 owns all index operational state. Database runtime ownership transitions separately to an application-owned StandardPostgresDatabaseModule exporting the existing DRIZZLE_DATABASE token.

**Tech Stack:** NestJS, TypeScript, Drizzle runtime types, standard PostgreSQL through an application-owned `StandardPostgresDatabaseModule` using `drizzle-orm/node-postgres` and a direct `pg` Pool, the preserved `server/database/schema.ts` import path, pg-mem local development database, Jest, existing C1/C2/C3/C4 modules, and the existing platform file-storage adapter.

**Spec:** docs/superpowers/specs/2026-09-03-phase-e1-knowledge-provenance-foundation-design.md

## Global Constraints

- The current E1 Phase branch is `codex/phase-e1-task2-database-preflight`; it already descends from accepted D4 main `156eb45e00bb727c69bb891f056f384bb600d415` and `phase-d4-accepted`. Verify that ancestry after approval and never create a second E1 branch.
- The one-time `SCHEMA OWNERSHIP TRANSITION` is explicit: current Miaoda schema → db-schema-sync → generated `server/database/schema.ts`; target application-owned canonical Drizzle schema → versioned Drizzle migrations → standard PostgreSQL. Preserve the `server/database/schema.ts` import path. After separately authorized transition work, it ceases to be a Miaoda-generated production artifact and becomes the app-owned canonical Drizzle schema definition. No transition or migration is created in this plan.
- `pg` currently exists only in `devDependencies`; when the provider task is
  separately authorized, it must become a runtime dependency. Do not change
  package.json during this documentation repair.
- E1 v1 creates only the seven new E1 tables listed in this plan; do not alter app_users, tasks, point_records, or recharge_orders.
- Standard PostgreSQL schema changes are owned by versioned Drizzle migrations after the one-time transition. No migration files, migration runner, or database mutation are created by this plan.
- The historical Miaoda preflight wrapper and db-schema-sync evidence may remain for audit history, but are not a prerequisite for standard PostgreSQL E1 implementation and do not authorize Task 7.
- Every E1 table has mandatory user_id ownership and every read, write, delete, and idempotency lookup is scoped by authenticated userId. Do not assume RLS exists automatically; application predicates plus composite user_id ownership foreign keys/constraints are authoritative for E1 v1.
- Text-only originalContentHash is SHA-256(Buffer.from(originalText, 'utf8')) under profile text-input-utf8-exact-v1; do not trim or normalize it.
- normalizedContentHash is optional in E1 v1; do not invent a normalization serializer.
- Persist parser profile c1-document-parser-v1; do not use a Git SHA as a parser version.
- E1 never supplies taskType: polish or taskType: paper-revision for knowledge ingestion.
- No second parser, context builder, chunker, embedding provider, vector database, retrieval runtime, Zotero connector, Academic Search connector, RAG flow, queue, Redis/BullMQ, billing redesign, or D4 TextGenerationProvider change is permitted.
- chunkStructural() reuses the accepted deterministic, lossless, Unicode-code-point, zero-overlap chunking core; existing build() and chunk() behavior must remain unchanged.
- Initial E1 rollback is only for a pre-traffic verification failure: disable E1 and use the separately approved migration rollback or forward-fix policy. Verify the four accepted tables are unchanged. Initial backfill is not applicable.
- No implementation, new branch creation, database mutation, destructive SQL,
  E2 work, commit, push, or PR is authorized by this document.

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
- Existing historical Task-2 preflight files are not E1 production implementation files and are not prerequisites for the standard PostgreSQL path.

### Files to modify

- server/modules/context-builder/context-builder.types.ts — add neutral structural source/context/unit types while preserving existing aliases and task contracts.
- server/modules/context-builder/context-builder.service.ts — add the neutral structural projection and preserve existing build output and validation.
- server/modules/context-builder/context-builder.service.spec.ts — test neutral projection and exact Polish/Paper Revision compatibility.
- server/modules/chunking/chunking.types.ts — add neutral structural chunk input/output types without removing task types.
- server/modules/chunking/chunking.service.ts — expose chunkStructural() over the shared existing core; preserve chunk().
- server/modules/chunking/chunking.service.spec.ts — compare neutral and task outputs and cover rejection of tool-task sentinels.
- server/modules/document-input/document-input.service.ts — add an additive readVerified() C4 seam that reuses existing ownership, download, size, and SHA-256 verification.
- server/modules/document-input/document-input.service.spec.ts — cover readVerified() and existing preparation regressions.
- server/database/schema.ts — preserve the import path; after the separately authorized schema ownership transition it becomes the app-owned canonical Drizzle schema definition; no change in this planning repair.
- server/database/local-development.database.ts — mirror the approved seven-table schema in LOCAL_SCHEMA_SQL after canonical schema/migration review; leave accepted table definitions unchanged.
- server/database/local-development.database.spec.ts — verify E1 tables exist locally and accepted tables remain available.
- server/app.module.ts — import KnowledgeModule after dependencies are wired; do not change existing module order semantics.

### Files explicitly not modified

- server/modules/document-parsing/\*\* — C1 remains frozen.
- server/modules/ai-tools/**, server/modules/tasks/**, and shared/api.interface.ts — no tool/task/API migration.
- server/database/schema.ts before the separately authorized app-owned schema
  transition is approved.
- .spark_project and CODEX_WORKFLOW.md — no invented migration script or
  platform workflow.
- package.json and package-lock.json are permitted only for the narrowly scoped
  runtime `pg` dependency transition in the separately authorized provider
  task; they are not changed by this documentation repair.

### Binding execution order

The section order below groups related work for review, but the executor must
run the tasks in this order. This is the approved database sequence and is
binding:

1. Task 1: verify and retain the current E1 phase branch after plan approval.
2. Task 2: finalize the standard PostgreSQL provider/schema ownership
   transition contract and the exact four-table baseline contract; then STOP
   for the separately authorized database-infrastructure gate.
3. Task 7: after separate database-infrastructure authorization, create the
   canonical schema and versioned `0001 baseline`/`0002 E1 knowledge provenance`
   migrations for CI validation only.
4. Task 2A: implement the app-owned StandardPostgresDatabaseModule.
5. Task 2B: apply both migrations to disposable PostgreSQL in Linux CI and run
   provider/constraint/transaction integration tests.
6. Task 3: add the approved neutral C2 projection.
7. Task 4: add the approved neutral C3 shared-core seam.
8. Task 5: add the additive C4 verified-artifact seam.
9. Task 6: add pure E1 contracts, hashes, and provenance mapping.
10. Task 8: add user-scoped repository persistence.
11. Task 9: add atomic import orchestration and content readiness.
12. Task 10: add metadata resolution, immutable versioning, and tombstones.
13. Task 11: wire the Nest module.
14. Task 12: run frozen-path regressions, full verification, and scope audit.

Task 2 ends after the provider, schema-authority, exact migration-tooling,
baseline-contract, and deployment-boundary decisions are recorded for ChatGPT
review. The historical Miaoda preflight status
`E1_DATABASE_PREFLIGHT_PASS` is not a prerequisite for the standard
PostgreSQL path and never authorizes Task 7. No production database apply,
database mutation, migration creation, or E1 repository/domain/service
implementation begins until the separate database-infrastructure
authorization is explicit.

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

Create only these seven new tables through the separately authorized standard
PostgreSQL migration lifecycle. The table names and constraints below are the
E1 physical contract; the canonical Drizzle schema and migration review must
be complete before repository code is written.

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

### Task 1: Verify and retain the existing E1 phase branch after plan approval

**Files:**

- No repository file changes in this task.

**Interfaces:**

- Consumes: accepted D4 main at 156eb45e00bb727c69bb891f056f384bb600d415.
- Produces: verification that the existing E1 phase branch remains the single
  Phase E1 branch based on that commit.

- [ ] Step 1: Verify the plan approval and accepted baseline.

Run:

    git status --short --branch
    git rev-parse main
    git ls-remote --heads --tags origin

Expected: the current branch is
`codex/phase-e1-task2-database-preflight`; `main` resolves to the accepted
commit; the accepted D4 commit is an ancestor/merge-base of the current branch;
and the remote contains `phase-d4-accepted` pointing to that commit.

- [ ] Step 2: Retain the existing E1 branch after approval.

Do not create a second branch from bare accepted D4 main. Continue all E1
implementation and review fixes on
`codex/phase-e1-task2-database-preflight`, preserving the reviewed E1 design,
plan, audit, and historical Task-2 evidence.

- [ ] Step 3: Verify branch isolation.

Run:

    git status --short --branch
    git diff --name-only main...HEAD

Expected: the existing E1 branch is checked out, its merge-base/accepted
ancestor is `156eb45e00bb727c69bb891f056f384bb600d415`, and no E1 work is
committed on `main`.

### Task 2: Freeze the standard PostgreSQL infrastructure gate

**Files:**

- No production files, migrations, database files, CI files, or ECS files are
  created by this task.
- The historical `scripts/e1-database-preflight.js` and
  `test/unit/e1-database-preflight.spec.ts` remain audit evidence only.

**Interfaces:**

- Consumes: the accepted D4 repository topology and standard PostgreSQL
  deployment constraints.
- Produces: a reviewed contract for the app-owned provider, schema-authority
  transition, baseline migration boundary, and CI/ECS responsibilities.

- [ ] Step 0: Record the actual filesystem production topology.

For `DOCUMENT_STORAGE_DRIVER=filesystem` outside local development,
`createPlatformModuleImports(filesystem)` returns `[]`: neither
`LocalDevelopmentDatabaseModule`, `PlatformModule`, nor `DataPaasModule` is
loaded, and therefore no production `DRIZZLE_DATABASE` provider exists. Do not
describe this path as a Miaoda DataPaas database runtime.

- [ ] Step 1: Freeze the provider seam.

The separately authorized implementation target is:

    application-owned StandardPostgresDatabaseModule
      -> drizzle-orm/node-postgres
      -> direct pg Pool
      -> DATABASE_URL
      -> standard PostgreSQL

The module exports the existing `DRIZZLE_DATABASE` token so Users, Tasks,
Points, Orders, and C1-D4 behavior can remain at the same service boundary.
`@lark-apaas/nestjs-datapaas` and `DataPaasModule` are not the target
production abstraction. `pg` currently exists only in devDependencies;
moving it to runtime dependencies is expected during separately authorized
implementation; do not change package.json now.

- [ ] Step 2: Freeze schema authority and migration contract.

Record the one-time `SCHEMA OWNERSHIP TRANSITION`:

    current: Miaoda schema -> db-schema-sync -> generated server/database/schema.ts
    target:  app-owned canonical Drizzle schema -> versioned Drizzle migrations -> standard PostgreSQL

Preserve `server/database/schema.ts` as the import path. After the separately
authorized transition it becomes the app-owned canonical Drizzle schema
definition; `npm run gen:db-schema` and Miaoda are no longer authoritative for
standard PostgreSQL. Conceptually, `0001 baseline` creates only
`app_users`, `tasks`, `point_records`, and `recharge_orders`; separately
authorized `0002 E1 knowledge provenance` adds the seven E1 tables. No
migration files are created here.

The exact physical baseline contract must resolve `user_profile`,
`file_attachment`, `current_setting('app.user_id', true)`, platform/system
fields, defaults, nullability, timestamps, indexes, and constraints. The
current pg-mem mirror is not proof of standard PostgreSQL parity.

Before implementation begins, freeze the exact migration-tooling contract:

- canonical Drizzle schema path: preserved `server/database/schema.ts`;
- migration directory: exact repository path to be selected and recorded;
- migration generation mechanism: exact approved command/package;
- migration apply mechanism: exact approved command/package used by CI and the
  later release gate;
- migration journal/version table name and behavior;
- exact pinned development/runtime dependencies required by generation and
  apply;
- package scripts used by Linux CI and the later release gate; and
- advisory-lock/single-run behavior for production rollout.

The repository currently does not prove these exact paths, commands, package
versions, or journal behavior. They are required database-infrastructure
decisions before implementation, not assumptions to be invented or installed
in this planning repair.

- [ ] Step 3: Freeze test and deployment boundaries.

Use pg-mem for fast unit/service/local tests. Use disposable real PostgreSQL
in Linux CI for provider, migrations, real constraints, and transaction
integration. ECS PostgreSQL is runtime-only; ECS must not run npm ci, tests,
builds, TypeScript/Vite compilation, or migration generation.

The deployment principle is:

    GitHub/Linux CI -> install -> test -> lint/type-check -> build
      -> package runtime artifact -> manifest/checksum/signature
      -> ECS verify/download/run

Artifact publishing/signing and ECS verification are a separate
deployment-infrastructure gate, not full E1 implementation scope.

- [ ] Step 4: Record the authentication boundary.

Standard PostgreSQL does not solve production authentication. The current
`NeedLogin` and `request.context.currentUser` contract remains a separate
self-hosted production architecture issue. Record it exactly as
`PRODUCTION_DEPLOYMENT_BLOCKER`; do not implement auth in E1. It does not
block isolated provider/migration/E1 development or CI integration, but
production readiness cannot be declared until the auth architecture is
separately approved.

- [ ] Step 5: Stop for the separate database-infrastructure authorization.

Do not create migrations, modify `server/database/schema.ts`, create tables,
modify pg-mem, run a Miaoda preflight, or enter Task 7 from this task. The
historical Miaoda preflight tooling may remain in history, but its pass status
does not authorize standard PostgreSQL Task 7.

### Task 2A: Implement the app-owned standard PostgreSQL provider

**Files:**

- Create: `server/database/standard-postgres.module.ts`
- Create: `server/database/standard-postgres.database.ts` (or an equivalently
  minimal app-owned module/provider layout)
- Tests: provider/module focused tests and filesystem-production AppModule
  wiring/bootstrap tests
- Modify when separately authorized: `package.json`, `package-lock.json`,
  and `server/app.module.ts`

**Interfaces:**

- Consumes: approved `DATABASE_URL` plus approved non-secret pool/SSL
  configuration.
- Produces: the existing `DRIZZLE_DATABASE` injection token backed by a
  standard PostgreSQL connection.

- [ ] Step 1: Write failing provider and production-wiring tests.

Cover direct `pg` Pool creation, `drizzle-orm/node-postgres` construction,
export of the existing `DRIZZLE_DATABASE` injection token, graceful pool
shutdown, and fail-closed behavior for missing or invalid production
`DATABASE_URL`. For `DOCUMENT_STORAGE_DRIVER=filesystem` and
`NODE_ENV=production`, assert that `AppModule` loads
`StandardPostgresDatabaseModule` and no longer has a missing database
provider. Preserve platform storage behavior separately; do not silently
rewrite it.

- [ ] Step 2: Add the runtime dependency transition only within this task.

When separately authorized, move `pg` from devDependencies to runtime
dependencies in `package.json` and update `package-lock.json` through the
approved dependency workflow. Do not make that change during this planning
repair.

- [ ] Step 3: Implement the minimal provider.

Read `DATABASE_URL` and approved non-secret pool/SSL settings, create a direct
`pg` Pool, create the Drizzle `node-postgres` database, provide and export the
existing `DRIZZLE_DATABASE` injection token, and close the pool during Nest
shutdown. Do not use `DataPaasModule` or `@lark-apaas/nestjs-datapaas` as the
production abstraction.

- [ ] Step 4: Run focused provider and filesystem-production wiring tests.

Expected: the provider is resolved only for the approved filesystem production
topology, existing service injection remains compatible, and missing/invalid
production connection configuration fails closed.

### Task 2B: Validate schema and provider against disposable PostgreSQL in Linux CI

**Files:**

- Create/modify only the separately authorized Linux-CI database-test
  configuration and test support files.

**Interfaces:**

- Consumes: canonical schema, versioned `0001` and `0002` migrations, and the
  StandardPostgresDatabaseModule.
- Produces: disposable real-PostgreSQL integration evidence before repository
  and service persistence implementation.

- [ ] Step 1: Apply `0001` and `0002` to a disposable PostgreSQL database in
      Linux CI only.

Do not use a production database, the ECS, Miaoda, or a local ad-hoc database
for this verification.

- [ ] Step 2: Verify tables, indexes, foreign keys, defaults, ownership
      constraints, transactions, and provider behavior against real PostgreSQL.

- [ ] Step 3: Run the real-PostgreSQL integration tests and record the result.

Only after this CI evidence is green may Tasks 3–12 continue. Production
PostgreSQL provisioning and production migration application remain a later
rollout/deployment gate and are not part of E1 implementation verification.

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

### Task 7: Create the standard PostgreSQL schema and migrations for CI validation

**Files:**

- Modify: the app-owned canonical Drizzle schema at the preserved
  `server/database/schema.ts` import path
- Create: versioned Drizzle migrations only after separate database
  implementation authorization
- Modify: server/database/local-development.database.ts
- Test: server/database/local-development.database.spec.ts

**Interfaces:**

- Consumes: the approved standard PostgreSQL provider, exact baseline physical
  contract, and separately authorized migration workflow.
- Produces: conceptual `0001 baseline` for the four accepted tables followed by
  conceptual `0002 E1 knowledge provenance` for the seven E1 tables, with the
  canonical Drizzle schema and pg-mem mirror updated only under that approval.

- [ ] Step 1: Finalize the physical table contract.

Review the exact four-table baseline contract and then the exact seven E1 table
names, columns, nullable source relationship, composite user-scoped foreign
keys, external identity uniqueness, unique idempotency key, and indexes with
the accepted E1 design. Resolve `user_profile`, `file_attachment`,
`current_setting('app.user_id', true)`, platform/system fields, defaults,
nullability, timestamps, and indexes for ordinary PostgreSQL. The current
pg-mem mirror is not proof of parity.

- [ ] Step 2: Prepare the disposable Linux-CI PostgreSQL validation target.

Use only a disposable PostgreSQL service/container in Linux CI for E1
implementation verification. No production PostgreSQL instance or ECS host is
required or permitted for this task.

- [ ] Step 3: Create conceptual `0001 baseline` and `0002 E1 knowledge provenance`.

Use the separately approved versioned Drizzle migration workflow. `0001`
creates only `app_users`, `tasks`, `point_records`, and `recharge_orders`;
`0002` creates only the seven E1 tables. These migration artifacts are then
applied only to the disposable CI database in Task 2B. Do not use a Miaoda
management surface, db-schema-sync, or ad-hoc SQL as the standard PostgreSQL
authority. Leave accepted table semantics unchanged.

- [ ] Step 4: Review the canonical schema and migration diff.

Confirm that the canonical Drizzle schema and both migration files contain
only the approved four-table baseline and seven E1 tables, with no unrelated
accepted-table behavior changed. Real PostgreSQL metadata, constraints,
defaults, and transaction behavior are verified in Task 2B.

- [ ] Step 5: Update the canonical schema and local pg-mem after migration review.

Update the app-owned canonical Drizzle schema at the preserved import path and
add the seven E1 definitions to LOCAL_SCHEMA_SQL using the approved physical
shape. Keep the four accepted definitions unchanged. Add only local test data
needed for E1 tests; do not add production seed behavior.

- [ ] Step 6: Write and run local parity tests.

Test that local initialization exposes the seven E1 tables, accepted tables still support current services, composite ownership constraints reject cross-user parent references, nullable source_record_id works, the external identity unique constraint exists, and the idempotency unique constraint exists. Assert that knowledge_source_records has no external_provenance column and that repository hydration reads SourceRecord.externalProvenance[] only from knowledge_source_external_links.

Run:

    npx jest server/database/local-development.database.spec.ts --runInBand

Expected: PASS before proceeding to repository code. This is disposable
PostgreSQL CI evidence, not production database evidence.

- [ ] Step 7: Record initial rollback readiness.

Before enabling any E1 traffic, record the exact migration version and the
approved pre-traffic rollback procedure. This is a verification-failure
rollback artifact, not a generalized destructive migration policy. Initial
backfill is recorded as NOT APPLICABLE.

- [ ] Step 8: Commit the canonical schema, migrations, and local parity.

Commit only the canonical schema, migration artifacts, and local mirror/tests:

    feat(e1): add standard postgres schema and migrations

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

- Consumes: DocumentParsingModule, ContextBuilderModule, ChunkingModule, DocumentInputModule, and the existing DRIZZLE_DATABASE injection token.
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

Confirm that only the planned E1/C2/C3/C4 additive files, canonical schema,
migrations, local mirror, and tests changed; no existing database table, D4
provider, vector/search/connector/queue code, or inherited platform-command
behavior changed.

- [ ] Step 5: Commit verification-only test adjustments if required.

If preceding steps required only test additions, commit:

    test(e1): cover provenance boundaries and frozen-path regressions

Otherwise keep earlier implementation commits intact and record the exact fixing commit in the PR description.

## 4. Database preflight, apply, verify, and rollback protocol

The future executor must follow this exact order and record evidence in the PR:

    finalize exact four-table baseline physical contract
    → freeze exact Drizzle schema/migration tooling contract
    → approve StandardPostgresDatabaseModule and DATABASE_URL boundary
    → approve the SCHEMA OWNERSHIP TRANSITION
    → create versioned 0001 baseline and 0002 E1 migrations
    → apply 0001 and 0002 to disposable PostgreSQL in Linux CI
    → verify tables/indexes/FKs/defaults/transactions
    → run real-PostgreSQL CI integration tests
    → implement repository/domain/service code
    → run full verification

The historical Miaoda preflight is not in this execution path. E1
implementation and CI verification must not require or mutate a production
PostgreSQL database. Production rollout is a later deployment gate:

    production PostgreSQL provision
    → backup
    → migration lock
    → controlled migration apply
    → post-migration verification
    → artifact deployment
    → traffic enablement

Initial rollback is allowed only before E1 traffic/data is enabled and only
when verification fails. Use the approved migration rollback or forward-fix
policy; do not invent destructive production SQL. Verify the four accepted
tables are unchanged after any pre-traffic rollback. Initial backfill is NOT
APPLICABLE.

No historical E1 data exists for this greenfield phase, so initial backfill is NOT APPLICABLE. Any future destructive ALTER, historical-data migration, or production backfill requires a separate approved database policy.

## 5. Commit sequence and PR scope

Planned commits, in order:

1. feat(e1): add standard postgres schema and migrations
2. feat(e1): add standard postgres provider
3. test(e1): validate standard postgres migrations and provider in CI
4. feat(e1): add neutral structural context projection
5. feat(e1): add neutral structural chunking seam
6. feat(e1): expose verified document input boundary
7. feat(e1): add knowledge provenance contracts and mapping
8. feat(e1): add user-scoped knowledge repository
9. feat(e1): persist atomic knowledge imports
10. feat(e1): add immutable knowledge lifecycle and metadata resolution
11. feat(e1): wire knowledge provenance module
12. test(e1): cover provenance boundaries and frozen-path regressions

The PR must contain only the plan’s E1 changes and explicitly approved additive
C2/C3/C4 seams. It must include targeted test results, disposable PostgreSQL
migration/integration evidence, canonical Drizzle schema and migration diff,
local parity results, rollback record, full test/lint/type-check/build/bootstrap
results, and a scope audit. Production provisioning/apply evidence belongs to
the later deployment gate. The PR must state that E1 ends at
content-ready-for-indexing and E2 owns indexed/stale/failed/retry state.

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
- Hand-edited server/database/schema.ts before the separately authorized
  schema-ownership transition, or invented migration/apply/rollback tooling.
- Database mutations, migration creation, or destructive SQL before the
  separate standard PostgreSQL database-infrastructure authorization.
- Miaoda/DataPaas as the target standard PostgreSQL production abstraction.
- A second parser, context builder, chunker, or provenance system.
- A public E1 API/controller unless separately approved.

This plan authorizes planning only. Implementation starts only after ChatGPT approves this plan and explicitly authorizes the next transition.
