import type { DocumentInputRef } from './document-input.interface';

export interface ImportWorkspaceDocumentRequest {
  idempotencyKey: string;
  displayName: string;
  documentRef: DocumentInputRef;
  sourceRecordId?: string;
  chunkingPolicy?: { maxSize: number };
}

export interface KnowledgeWorkspaceDocument {
  document: {
    id: string;
    userId: string;
    sourceRecordId?: string;
    originKind: 'user-upload' | 'generated-artifact' | 'external-attachment';
    displayName: string;
    sourceType: 'docx' | 'pdf' | 'txt' | 'markdown';
    activeVersionId?: string;
    lifecycleStatus: 'active' | 'tombstoned';
    createdAt?: string;
    updatedAt?: string;
  };
  activeVersion?: {
    id: string;
    documentId: string;
    versionNumber: number;
    readinessStatus: 'content-ready-for-indexing';
    createdAt: string;
  };
  documentRef?: DocumentInputRef;
  index?: {
    id: string;
    status: 'indexing' | 'indexed' | 'failed' | 'stale';
    totalChunks: number;
    indexedChunks: number;
    failedChunks: number;
    lastErrorCode?: string;
    lastErrorMessage?: string;
  };
}

export interface WorkspaceDocumentSelection {
  documentRef: DocumentInputRef;
  documentId: string;
  documentVersionId: string;
  displayName: string;
}

export interface KnowledgeWorkspaceSource {
  id: string;
  kind: 'scholarly-work' | 'user-declared' | 'reference-library-item';
  title?: string;
  authors?: Array<{ name: string; given?: string; family?: string; orcid?: string }>;
  year?: number;
  venue?: string;
  abstract?: string;
  doi?: string;
  url?: string;
  contentStatus: 'metadata-only' | 'full-text-linked';
  isGroundedEvidence: false;
}

export type AcademicSearchImportResult =
  | {
      kind: 'full-text';
      source: KnowledgeWorkspaceSource;
      document: KnowledgeWorkspaceDocument;
      indexStatus: 'not-indexed';
      uploadRequired: false;
    }
  | {
      kind: 'metadata-only';
      source: KnowledgeWorkspaceSource;
      fullTextReason: 'not-advertised' | 'unavailable' | 'invalid-pdf' | 'processing-failed';
      uploadRequired: true;
    };
