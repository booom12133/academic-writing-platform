import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { KnowledgeRepository } from '../../server/modules/knowledge/knowledge.repository';
import { finalizeKnowledgeChunkDraft } from '../../server/modules/knowledge/knowledge.provenance';
import {
  computeChunkTextHash,
  hashTextInputExact,
} from '../../server/modules/knowledge/knowledge.hash';
import { KnowledgeIndexRepository } from '../../server/modules/knowledge/indexing/knowledge-index.repository';
import { KnowledgeIndexingService } from '../../server/modules/knowledge/indexing/knowledge-indexing.service';
import { DeterministicEmbeddingProvider } from '../../server/modules/knowledge/indexing/embedding.fake';
import { createEmbeddingConfig } from '../../server/modules/knowledge/indexing/embedding.config';

const databaseUrl = process.env.DATABASE_URL;
const describeIfDatabase = databaseUrl ? describe : describe.skip;

describeIfDatabase('E2 PostgreSQL and pgvector embedding persistence', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await migrate(drizzle(pool), { migrationsFolder: 'drizzle/migrations' });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('binds materializations to immutable versions and persists vectors through the index repository', async () => {
    const db = drizzle(pool);
    const knowledge = new KnowledgeRepository(db);
    const repository = new KnowledgeIndexRepository(db);
    const userId = `e2-${randomUUID()}`;
    const document = await knowledge.createDocument({
      userId,
      originKind: 'user-upload',
      displayName: 'E2',
      sourceType: 'txt',
    });
    const version = await knowledge.createVersion({
      userId,
      documentId: document.id,
      versionNumber: 1,
      originalContentHash: hashTextInputExact('one'),
      parserProfile: { name: 'c1-document-parser-v1', version: '1' },
      chunkingProfile: {
        name: 'c3-deterministic-v1',
        version: '1',
        parameters: { maxSize: 100 },
      },
      sourceText: 'one',
      lifecycleStatus: 'active',
      readinessStatus: 'content-ready-for-indexing',
      indexInputFingerprint: hashTextInputExact('e1-one'),
    });
    const chunk = finalizeKnowledgeChunkDraft({
      draft: {
        userId,
        documentVersionId: version.id,
        ordinal: 0,
        text: 'one',
        textHash: computeChunkTextHash('one'),
        provenance: {
          documentId: document.id,
          documentVersionId: version.id,
          sourceBlockId: 'b1',
          sourceBlockIndex: 0,
          section: 'content',
          headingPath: [],
          sourceUnitId: 'u1',
          sourceChunkOrdinal: 0,
          itemOrdinal: 0,
        },
        citationLocator: {
          documentVersionId: version.id,
          section: 'content',
          sourceBlockId: 'b1',
          sourceBlockIndex: 0,
        },
      },
      chunkId: randomUUID(),
    });
    await knowledge.createChunks([chunk]);

    const provider = new DeterministicEmbeddingProvider({
      provider: 'deterministic-fake',
      model: 'fake-embedding-v1',
      modelRevision: 'fake-revision-1',
      dimensions: 8,
    });
    const service = new KnowledgeIndexingService(
      knowledge,
      repository,
      provider,
      createEmbeddingConfig({}),
    );
    const indexed = await service.indexVersion({
      userId,
      documentVersionId: version.id,
    });
    expect(indexed.status).toBe('indexed');

    const same = await service.indexVersion({
      userId,
      documentVersionId: version.id,
    });
    expect(same.id).toBe(indexed.id);
    expect(same.status).toBe('indexed');

    const storedVector = await pool.query<{
      status: string;
      dimensions: number;
      embedding: string;
    }>(
      'SELECT status, dimensions, embedding::text AS embedding FROM knowledge_chunk_embeddings WHERE user_id = $1 AND knowledge_embedding_index_id = $2',
      [userId, indexed.id],
    );
    expect(storedVector.rows).toHaveLength(1);
    expect(storedVector.rows[0]).toMatchObject({
      status: 'indexed',
      dimensions: 8,
    });
    expect(storedVector.rows[0].embedding).toMatch(/^\[/);

    const replacement = await repository.createOrGetIndex({
      userId,
      documentVersionId: version.id,
      e1IndexInputFingerprint: version.indexInputFingerprint,
      embeddingProfileFingerprint: 'f'.repeat(64),
      indexFingerprint: 'i'.repeat(64),
      embeddingModelIdentity: await provider.getIdentity(),
      totalChunks: 1,
    });
    expect(replacement.created).toBe(true);
    expect(replacement.index.documentVersionId).toBe(version.id);
    expect(replacement.index.id).not.toBe(indexed.id);

    const documentTwo = await knowledge.createDocument({
      userId,
      originKind: 'user-upload',
      displayName: 'E2 second document',
      sourceType: 'txt',
    });
    const versionTwo = await knowledge.createVersion({
      userId,
      documentId: documentTwo.id,
      versionNumber: 2,
      originalContentHash: hashTextInputExact('two'),
      parserProfile: { name: 'c1-document-parser-v1', version: '1' },
      chunkingProfile: {
        name: 'c3-deterministic-v1',
        version: '1',
        parameters: { maxSize: 100 },
      },
      sourceText: 'two',
      lifecycleStatus: 'active',
      readinessStatus: 'content-ready-for-indexing',
      indexInputFingerprint: version.indexInputFingerprint,
    });
    const sameFingerprintDifferentVersion = await repository.createOrGetIndex({
      userId,
      documentVersionId: versionTwo.id,
      e1IndexInputFingerprint: version.indexInputFingerprint,
      embeddingProfileFingerprint: 'f'.repeat(64),
      indexFingerprint: 'i'.repeat(64),
      embeddingModelIdentity: await provider.getIdentity(),
      totalChunks: 0,
    });
    expect(sameFingerprintDifferentVersion.created).toBe(true);
    expect(sameFingerprintDifferentVersion.index.documentVersionId).toBe(
      versionTwo.id,
    );
  });
});
