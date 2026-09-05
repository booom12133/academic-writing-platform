import type { ChunkingPolicy } from '../chunking/chunking.types';
import type { DocumentInputRef } from '@shared/document-input.interface';

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

export interface MetadataAssertion extends Omit<MetadataAssertionInput, 'localKey' | 'observedAt'> {
  id: string;
  sourceRecordId: string;
  observedAt?: string;
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
  createdAt?: string;
  updatedAt?: string;
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
