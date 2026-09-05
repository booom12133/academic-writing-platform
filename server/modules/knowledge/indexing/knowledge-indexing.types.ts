export type KnowledgeEmbeddingIndexStatus =
  | 'indexing'
  | 'indexed'
  | 'failed'
  | 'stale';

export type KnowledgeChunkEmbeddingStatus = KnowledgeEmbeddingIndexStatus;
