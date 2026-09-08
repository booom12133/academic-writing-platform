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
