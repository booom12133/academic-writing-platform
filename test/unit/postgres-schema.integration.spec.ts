import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { knowledgeDocuments } from '../../server/database/schema';
import { KnowledgeRepository, type KnowledgeRepositoryPort } from '../../server/modules/knowledge/knowledge.repository';
import { KnowledgeService } from '../../server/modules/knowledge/knowledge.service';
import { hashTextInputExact } from '../../server/modules/knowledge/knowledge.hash';
import { finalizeKnowledgeChunkDraft } from '../../server/modules/knowledge/knowledge.provenance';
import type { ParsedDocument } from '../../server/modules/document-parsing/document-parser.types';
import type { StructuralDocumentContext } from '../../server/modules/context-builder/context-builder.types';
import type { StructuralChunkedDocument } from '../../server/modules/chunking/chunking.types';

const databaseUrl = process.env.DATABASE_URL;
const describeIfDatabase = databaseUrl ? describe : describe.skip;

const parsed: ParsedDocument = {
  source: { type: 'txt', fileName: 'input.txt', extension: '.txt', sizeBytes: 12 },
  blocks: [{ id: 'b1', type: 'paragraph', text: 'changed text' }],
  outline: [], plainText: 'changed text', metadata: {}, warnings: [],
};
const structural: StructuralDocumentContext = {
  version: 1,
  source: { id: 'document-1', kind: 'parsed-document', fileName: 'input.txt', sourceType: 'txt', extension: '.txt', sizeBytes: 12, metadata: {}, warnings: [] },
  units: [{ id: 'document-1:b000001', sourceId: 'document-1', sourceBlockId: 'b1', sourceBlockIndex: 0, section: 'content', headingPath: [], block: parsed.blocks[0] }],
};
const chunked: StructuralChunkedDocument = {
  version: 1, source: structural.source,
  policy: { version: 1, maxSize: 100, sizeMetric: 'unicode-code-points', overlap: 0 },
  chunks: [{ id: 'document-1:c000001', sourceId: 'document-1', section: 'content', size: 12, items: [{ kind: 'whole-unit', unit: structural.units[0], size: 12 }] }],
  warnings: [],
};

describeIfDatabase('standard PostgreSQL migrations', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await migrate(drizzle(pool), { migrationsFolder: 'drizzle/migrations' });
    await migrate(drizzle(pool), { migrationsFolder: 'drizzle/migrations' });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('applies the accepted baseline and E1 schema exactly once', async () => {
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
    );
    expect(result.rows.map((row) => row.table_name)).toEqual([
      'app_users', 'knowledge_chunk_embeddings', 'knowledge_chunks', 'knowledge_document_versions', 'knowledge_documents',
      'knowledge_embedding_indexes', 'knowledge_imports', 'knowledge_metadata_assertions', 'knowledge_source_external_links',
      'knowledge_source_records', 'point_records', 'recharge_orders', 'tasks',
    ]);
  });

  it('has the composite referenced unique keys required by the ownership foreign keys', async () => {
    const result = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN (
        'knowledge_source_records_id_user_id_key',
        'knowledge_documents_id_user_id_key',
        'knowledge_document_versions_id_user_id_key'
      ) ORDER BY indexname`,
    );
    expect(result.rows.map((row) => row.indexname)).toEqual([
      'knowledge_document_versions_id_user_id_key',
      'knowledge_documents_id_user_id_key',
      'knowledge_source_records_id_user_id_key',
    ]);
  });

  it('preserves the nullable source relation and sole external provenance storage', async () => {
    const columns = await pool.query<{ column_name: string; is_nullable: string }>(
      `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'knowledge_documents' AND column_name = 'source_record_id'`,
    );
    expect(columns.rows).toEqual([{ column_name: 'source_record_id', is_nullable: 'YES' }]);

    const sourceColumns = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'knowledge_source_records' AND column_name = 'external_provenance'`,
    );
    expect(sourceColumns.rows).toEqual([]);
  });

  it('rolls back a failed transaction on real PostgreSQL', async () => {
    const db = drizzle(pool, { schema: { knowledgeDocuments } });
    await expect(db.transaction(async (tx) => {
      await tx.insert(knowledgeDocuments).values({ userId: 'rollback-test', originKind: 'user-upload', displayName: 'rollback', sourceType: 'txt', lifecycleStatus: 'active' });
      throw new Error('forced rollback');
    })).rejects.toThrow('forced rollback');
    await expect(db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.userId, 'rollback-test'))).resolves.toEqual([]);
  });

  async function seedVersion(repository: KnowledgeRepository, userId: string) {
    const document = await repository.createDocument({ userId, originKind: 'user-upload', displayName: 'Versioned', sourceType: 'txt' });
    const previous = await repository.createVersion({
      userId, documentId: document.id, versionNumber: 1, originalContentHash: hashTextInputExact('previous'),
      parserProfile: { name: 'c1-document-parser-v1', version: '1' },
      chunkingProfile: { name: 'c3-deterministic-v1', version: '1', parameters: { maxSize: 100 } },
      sourceText: 'previous', lifecycleStatus: 'active', readinessStatus: 'content-ready-for-indexing', indexInputFingerprint: hashTextInputExact('previous-derivation'),
    });
    const previousChunk = finalizeKnowledgeChunkDraft({
      draft: {
        userId, documentVersionId: previous.id, ordinal: 0, text: 'previous', textHash: hashTextInputExact('previous'),
        provenance: { documentId: document.id, documentVersionId: previous.id, sourceBlockId: 'old-block', sourceBlockIndex: 0, section: 'content', headingPath: [], sourceUnitId: 'old-unit', sourceChunkOrdinal: 0, itemOrdinal: 0 },
        citationLocator: { documentVersionId: previous.id, section: 'content', sourceBlockId: 'old-block', sourceBlockIndex: 0 },
      },
      chunkId: randomUUID(),
    });
    await repository.createChunks([previousChunk]);
    await repository.activateVersion(userId, document.id, previous.id);
    return { document, previous, previousChunk };
  }

  function createService(repository: KnowledgeRepositoryPort) {
    return new KnowledgeService(
      repository,
      { parse: jest.fn().mockResolvedValue(parsed) },
      { buildStructural: jest.fn().mockReturnValue(structural) },
      { chunkStructural: jest.fn().mockReturnValue(chunked) },
      { readVerified: jest.fn() },
    );
  }

  function repositoryWithFailure(repository: KnowledgeRepository, failure: 'chunks' | 'activate'): KnowledgeRepositoryPort {
    const root = Object.create(repository) as KnowledgeRepositoryPort;
    root.withTransaction = (work) => repository.withTransaction(async (transaction) => {
      const scoped = Object.create(transaction) as KnowledgeRepositoryPort;
      if (failure === 'chunks') scoped.createChunks = jest.fn().mockRejectedValue(new Error('forced chunk persistence failure'));
      if (failure === 'activate') scoped.activateVersion = jest.fn().mockRejectedValue(new Error('forced active-version failure'));
      return work(scoped);
    });
    return root;
  }

  async function createNextVersion(service: KnowledgeService, userId: string, documentId: string) {
    return service.createNextVersion({
      userId, documentId, idempotencyKey: randomUUID(), displayName: 'Versioned', originKind: 'user-upload',
      input: { kind: 'text', text: 'changed text', fileName: 'input.txt' }, chunkingPolicy: { maxSize: 100 },
    });
  }

  it('rolls back the created version when real PostgreSQL chunk persistence fails', async () => {
    const repository = new KnowledgeRepository(drizzle(pool));
    const userId = `chunk-failure-${randomUUID()}`;
    const seeded = await seedVersion(repository, userId);
    await expect(createNextVersion(createService(repositoryWithFailure(repository, 'chunks')), userId, seeded.document.id)).rejects.toThrow('forced chunk persistence failure');
    await expect(repository.getLatestVersion(userId, seeded.document.id)).resolves.toMatchObject({ id: seeded.previous.id });
    await expect(repository.getChunks(userId, seeded.previous.id)).resolves.toEqual([seeded.previousChunk]);
  });

  it('rolls back version and chunks when real PostgreSQL activation fails', async () => {
    const repository = new KnowledgeRepository(drizzle(pool));
    const userId = `activate-failure-${randomUUID()}`;
    const seeded = await seedVersion(repository, userId);
    await expect(createNextVersion(createService(repositoryWithFailure(repository, 'activate')), userId, seeded.document.id)).rejects.toThrow('forced active-version failure');
    await expect(repository.getLatestVersion(userId, seeded.document.id)).resolves.toMatchObject({ id: seeded.previous.id });
    await expect(repository.getChunks(userId, seeded.previous.id)).resolves.toEqual([seeded.previousChunk]);
  });

  it('activates the actual new version and leaves the previous version immutable', async () => {
    const repository = new KnowledgeRepository(drizzle(pool));
    const userId = `success-version-${randomUUID()}`;
    const seeded = await seedVersion(repository, userId);
    const result = await createNextVersion(createService(repository), userId, seeded.document.id);
    expect(result.version.id).not.toBe(seeded.previous.id);
    expect(result.version.versionNumber).toBe(2);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].documentVersionId).toBe(result.version.id);
    await expect(repository.getDocument(userId, seeded.document.id)).resolves.toMatchObject({ activeVersionId: result.version.id });
    await expect(repository.getVersion(userId, seeded.previous.id)).resolves.toMatchObject({ id: seeded.previous.id, versionNumber: 1, sourceText: 'previous' });
    await expect(repository.getChunks(userId, seeded.previous.id)).resolves.toEqual([seeded.previousChunk]);
  });
});
