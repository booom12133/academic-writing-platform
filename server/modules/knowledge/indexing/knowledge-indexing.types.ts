import type { EmbeddingModelIdentity } from './embedding.types';

export type KnowledgeEmbeddingIndexStatus =
  | 'indexing'
  | 'indexed'
  | 'failed'
  | 'stale';

export type KnowledgeChunkEmbeddingStatus = KnowledgeEmbeddingIndexStatus;

export interface KnowledgeEmbeddingIndex {
  id: string;
  userId: string;
  documentVersionId: string;
  e1IndexInputFingerprint: string;
  embeddingProfileFingerprint: string;
  indexFingerprint: string;
  embeddingModelIdentity: EmbeddingModelIdentity;
  status: KnowledgeEmbeddingIndexStatus;
  totalChunks: number;
  indexedChunks: number;
  failedChunks: number;
  attemptCount: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
  indexedAt?: string;
}

export interface KnowledgeChunkEmbeddingManifestItem {
  knowledgeChunkId: string;
  inputFingerprint: string;
  embeddingProfileFingerprint: string;
  dimensions: number;
  ordinal: number;
}

export interface ClaimedEmbeddingBatch {
  leaseOwner: string;
  items: KnowledgeChunkEmbeddingManifestItem[];
}

export interface EmbeddingSuccessItem {
  knowledgeChunkId: string;
  inputFingerprint: string;
  vector: number[];
}
