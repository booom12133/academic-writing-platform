import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('E2 PostgreSQL migration ordering', () => {
  it('creates pgvector before the E2 tables and creates referenced keys before foreign keys', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'drizzle/migrations/0003_e2_embedding_indexes.sql'),
      'utf8',
    );
    const extension = sql.indexOf('CREATE EXTENSION IF NOT EXISTS vector');
    const firstTable = Math.min(
      sql.indexOf('CREATE TABLE "knowledge_embedding_indexes"'),
      sql.indexOf('CREATE TABLE "knowledge_chunk_embeddings"'),
    );
    const firstForeignKey = sql.indexOf('ADD CONSTRAINT "knowledge_');
    const referencedIndex = sql.indexOf('CREATE UNIQUE INDEX "knowledge_embedding_indexes_id_user_id_key"');

    expect(extension).toBeGreaterThanOrEqual(0);
    expect(firstTable).toBeGreaterThan(extension);
    expect(firstForeignKey).toBeGreaterThan(firstTable);
    expect(referencedIndex).toBeGreaterThan(firstTable);
    expect(referencedIndex).toBeLessThan(firstForeignKey);
    expect(sql).toContain('knowledge_embedding_indexes_version_fingerprint_key');
    expect(sql).not.toContain('knowledge_embedding_indexes_user_fingerprint_key');
  });
});
