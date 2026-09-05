import { getTableName } from 'drizzle-orm';
import { knowledgeChunkEmbeddings, knowledgeEmbeddingIndexes } from './schema';

describe('E2 embedding schema declarations', () => {
  it('declares the two E2 tables with version-bound index identity', () => {
    expect(knowledgeEmbeddingIndexes).toBeDefined();
    expect(knowledgeChunkEmbeddings).toBeDefined();
    expect(getTableName(knowledgeEmbeddingIndexes)).toBe('knowledge_embedding_indexes');
    expect(getTableName(knowledgeChunkEmbeddings)).toBe('knowledge_chunk_embeddings');
  });
});
