import { createLocalDevelopmentDatabase } from '../../server/database/local-development.database';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { and, eq, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { createStandardPostgresConfig } from '../../server/database/standard-postgres.module';
import { randomUUID } from 'node:crypto';
import { knowledgeDocumentVersions, knowledgeDocuments, knowledgeImports } from '../../server/database/schema';
import { KnowledgeRepository, type KnowledgeRepositoryPort } from '../../server/modules/knowledge/knowledge.repository';
import { KnowledgeService } from '../../server/modules/knowledge/knowledge.service';
import { hashTextInputExact } from '../../server/modules/knowledge/knowledge.hash';
import type { ParsedDocument } from '../../server/modules/document-parsing/document-parser.types';
import type { StructuralDocumentContext } from '../../server/modules/context-builder/context-builder.types';
import type { StructuralChunkedDocument } from '../../server/modules/chunking/chunking.types';

describe('E4 local database compatibility', () => {
  it('keeps legacy documents nullable while enforcing user-scoped external identity uniqueness', async () => {
    const local = await createLocalDevelopmentDatabase();
    try {
      const columns = await local.db.execute(sql`
        SELECT DISTINCT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'knowledge_documents'
          AND column_name IN ('external_identity', 'external_version', 'external_checksum_algorithm', 'external_checksum')
        ORDER BY column_name
      `);
      expect(columns.rows).toHaveLength(4);
      const legacy = await local.db.insert((await import('../../server/database/schema')).knowledgeDocuments).values({
        userId: 'legacy-user', originKind: 'user-upload', displayName: 'legacy', sourceType: 'txt', lifecycleStatus: 'active',
      }).returning();
      expect(legacy[0].externalIdentity).toBeNull();

      const table = await local.db.execute(sql`
        SELECT table_name FROM information_schema.tables WHERE table_name = 'zotero_connections'
      `);
      expect(table.rows.length).toBeGreaterThan(0);
    } finally {
      await local.close();
    }
  });
});

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

describeIfDatabase('E4 real PostgreSQL concurrency arbitration', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool(createStandardPostgresConfig({
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_URL: databaseUrl,
    }));
    await migrate(drizzle(pool), { migrationsFolder: 'drizzle/migrations' });
  });

  afterAll(async () => {
    await pool.end();
  });

  function service(repository: KnowledgeRepositoryPort) {
    return new KnowledgeService(
      repository,
      { parse: jest.fn().mockResolvedValue(parsed) },
      { buildStructural: jest.fn().mockReturnValue(structural) },
      { chunkStructural: jest.fn().mockReturnValue(chunked) },
      { readVerified: jest.fn() },
    );
  }

  async function seedDocument(repository: KnowledgeRepository, userId: string) {
    const document = await repository.createDocument({
      userId, originKind: 'external-attachment', displayName: 'paper.pdf', sourceType: 'txt',
      externalIdentity: `zotero:user:42:attachment:${randomUUID()}`,
      externalVersion: '1', externalChecksumAlgorithm: 'md5', externalChecksum: '1'.repeat(32),
    });
    const version = await repository.createVersion({
      userId, documentId: document.id, versionNumber: 1, originalContentHash: hashTextInputExact('previous'),
      parserProfile: { name: 'c1-document-parser-v1', version: '1' },
      chunkingProfile: { name: 'c3-deterministic-v1', version: '1', parameters: { maxSize: 100 } },
      sourceText: 'previous', lifecycleStatus: 'active', readinessStatus: 'content-ready-for-indexing', indexInputFingerprint: hashTextInputExact(`previous-${randomUUID()}`),
    });
    await repository.activateVersion(userId, document.id, version.id);
    return document;
  }

  it('arbitrates concurrent first attachment creation through the E1 idempotency marker', async () => {
    const repository = new KnowledgeRepository(drizzle(pool));
    const userId = `e4-first-${randomUUID()}`;
    const source = await repository.createSourceRecord({ userId, kind: 'scholarly-work' });
    const input = {
      userId, sourceRecordId: source.id, idempotencyKey: `zotero:first:${randomUUID()}`, displayName: 'paper.txt', originKind: 'external-attachment' as const,
      input: { kind: 'text' as const, text: 'first attachment', fileName: 'paper.txt' }, chunkingPolicy: { maxSize: 100 },
      externalSyncState: { externalIdentity: `zotero:user:42:attachment:${randomUUID()}`, externalVersion: '1', externalChecksumAlgorithm: 'md5' as const, externalChecksum: '2'.repeat(32) },
    };

    const [left, right] = await Promise.all([service(repository).importDocument(input), service(repository).importDocument(input)]);
    const documents = await drizzle(pool).select().from(knowledgeDocuments).where(eq(knowledgeDocuments.userId, userId));
    const versions = await drizzle(pool).select().from(knowledgeDocumentVersions).where(eq(knowledgeDocumentVersions.userId, userId));
    const imports = await drizzle(pool).select().from(knowledgeImports).where(eq(knowledgeImports.userId, userId));

    expect(left.document.id).toBe(right.document.id);
    expect(documents).toHaveLength(1);
    expect(versions).toHaveLength(1);
    expect(imports).toHaveLength(1);
    expect(imports[0].status).toBe('completed');
  });

  it('converges concurrent first imports with different upstream versions through external identity arbitration', async () => {
    const repository = new KnowledgeRepository(drizzle(pool));
    const userId = `e4-first-race-${randomUUID()}`;
    const otherUserId = `e4-first-race-other-${randomUUID()}`;
    const source = await repository.createSourceRecord({ userId, kind: 'scholarly-work' });
    const otherSource = await repository.createSourceRecord({ userId: otherUserId, kind: 'scholarly-work' });
    const externalIdentity = `zotero:user:42:attachment:${randomUUID()}`;
    const buildInput = (version: string, text: string, checksum: string, owner: string, sourceRecordId: string) => ({
      userId: owner, sourceRecordId, idempotencyKey: `zotero:first-race:${version}:${randomUUID()}`, displayName: 'paper.txt', originKind: 'external-attachment' as const,
      input: { kind: 'text' as const, text, fileName: 'paper.txt' }, chunkingPolicy: { maxSize: 100 },
      externalSyncState: { externalIdentity, externalVersion: version, externalChecksumAlgorithm: 'md5' as const, externalChecksum: checksum },
    });

    const [older, newer] = await Promise.all([
      service(repository).importDocument(buildInput('2', 'older content', '2'.repeat(32), userId, source.id)),
      service(repository).importDocument(buildInput('3', 'newer content', '3'.repeat(32), userId, source.id)),
    ]);
    const documents = await drizzle(pool).select().from(knowledgeDocuments).where(and(eq(knowledgeDocuments.userId, userId), eq(knowledgeDocuments.externalIdentity, externalIdentity)));
    const versions = await drizzle(pool).select().from(knowledgeDocumentVersions).where(eq(knowledgeDocumentVersions.documentId, documents[0].id)).orderBy(knowledgeDocumentVersions.versionNumber);
    const current = await repository.findDocumentByExternalIdentity(userId, externalIdentity);
    const latest = await repository.getLatestVersion(userId, documents[0].id);

    expect(older.document.id).toBe(newer.document.id);
    expect(documents).toHaveLength(1);
    expect(current).toMatchObject({ externalVersion: '3', externalChecksum: '3'.repeat(32) });
    expect(latest).toMatchObject({ sourceText: 'newer content' });
    expect([1, 2]).toContain(versions.length);

    const other = await service(repository).importDocument(buildInput('4', 'other owner content', '4'.repeat(32), otherUserId, otherSource.id));
    await expect(repository.findDocumentByExternalIdentity(userId, externalIdentity)).resolves.toMatchObject({ externalVersion: '3', externalChecksum: '3'.repeat(32) });
    await expect(repository.findDocumentByExternalIdentity(otherUserId, externalIdentity)).resolves.toMatchObject({ id: other.document.id, externalVersion: '4' });
  });

  it('prevents a stale concurrent external state update from overwriting a newer version', async () => {
    const repository = new KnowledgeRepository(drizzle(pool));
    const userId = `e4-state-${randomUUID()}`;
    const document = await seedDocument(repository, userId);

    await Promise.all([
      repository.updateExternalSyncState(userId, document.id, { externalVersion: '3', externalChecksumAlgorithm: 'md5', externalChecksum: '3'.repeat(32) }),
      repository.updateExternalSyncState(userId, document.id, { externalVersion: '2', externalChecksumAlgorithm: 'md5', externalChecksum: '2'.repeat(32) }),
    ]);

    await expect(repository.findDocumentByExternalIdentity(userId, document.externalIdentity!)).resolves.toMatchObject({ externalVersion: '3', externalChecksum: '3'.repeat(32) });
  });

  it('accepts at most one next version for concurrent same-SHA syncs', async () => {
    const repository = new KnowledgeRepository(drizzle(pool));
    const userId = `e4-same-sha-${randomUUID()}`;
    const document = await seedDocument(repository, userId);
    const input = {
      userId, documentId: document.id, idempotencyKey: `zotero:v2:${randomUUID()}`, displayName: 'paper.txt', originKind: 'external-attachment' as const,
      input: { kind: 'text' as const, text: 'same bytes', fileName: 'paper.txt' }, chunkingPolicy: { maxSize: 100 },
      externalSyncState: { externalIdentity: document.externalIdentity!, externalVersion: '2', externalChecksumAlgorithm: 'md5' as const, externalChecksum: '4'.repeat(32) },
    };

    const results = await Promise.all([service(repository).createNextVersion(input), service(repository).createNextVersion(input)]);
    const versions = await drizzle(pool).select().from(knowledgeDocumentVersions).where(eq(knowledgeDocumentVersions.documentId, document.id));
    expect(versions).toHaveLength(2);
    expect(results.filter((result) => !result.idempotent)).toHaveLength(1);
  });

  it('keeps the newest accepted upstream version when different versions race', async () => {
    const repository = new KnowledgeRepository(drizzle(pool));
    const userId = `e4-newest-${randomUUID()}`;
    const document = await seedDocument(repository, userId);
    const buildInput = (version: string, text: string) => ({
      userId, documentId: document.id, idempotencyKey: `zotero:${version}:${randomUUID()}`, displayName: 'paper.txt', originKind: 'external-attachment' as const,
      input: { kind: 'text' as const, text, fileName: 'paper.txt' }, chunkingPolicy: { maxSize: 100 },
      externalSyncState: { externalIdentity: document.externalIdentity!, externalVersion: version, externalChecksumAlgorithm: 'md5' as const, externalChecksum: version.repeat(32) },
    });

    await Promise.all([service(repository).createNextVersion(buildInput('2', 'older upstream')), service(repository).createNextVersion(buildInput('3', 'newer upstream'))]);
    const current = await repository.findDocumentByExternalIdentity(userId, document.externalIdentity!);
    const versions = await drizzle(pool).select().from(knowledgeDocumentVersions).where(eq(knowledgeDocumentVersions.documentId, document.id));
    expect(current).toMatchObject({ externalVersion: '3', externalChecksum: '3'.repeat(32) });
    expect([2, 3]).toContain(versions.length);
  });

  it('keeps external identity owner-safe and does not allow another user to update it', async () => {
    const repository = new KnowledgeRepository(drizzle(pool));
    const owner = `e4-owner-${randomUUID()}`;
    const other = `e4-other-${randomUUID()}`;
    const document = await seedDocument(repository, owner);

    await expect(repository.findDocumentByExternalIdentity(other, document.externalIdentity!)).resolves.toBeNull();
    await expect(repository.updateExternalSyncState(other, document.id, { externalVersion: '2', externalChecksumAlgorithm: 'md5', externalChecksum: '2'.repeat(32) })).rejects.toMatchObject({ code: 'KNOWLEDGE_NOT_FOUND' });
  });

  it('rolls back a failed next-version transaction without advancing external state', async () => {
    const repository = new KnowledgeRepository(drizzle(pool));
    const userId = `e4-rollback-${randomUUID()}`;
    const document = await seedDocument(repository, userId);
    const failed = Object.create(repository) as KnowledgeRepositoryPort;
    failed.withTransaction = (work) => repository.withTransaction(async (transaction) => {
      const scoped = Object.create(transaction) as KnowledgeRepositoryPort;
      scoped.createChunks = jest.fn().mockRejectedValue(new Error('forced E4 chunk failure'));
      return work(scoped);
    });

    await expect(service(failed).createNextVersion({
      userId, documentId: document.id, idempotencyKey: `zotero:failed:${randomUUID()}`, displayName: 'paper.txt', originKind: 'external-attachment',
      input: { kind: 'text', text: 'failed upstream', fileName: 'paper.txt' }, chunkingPolicy: { maxSize: 100 },
      externalSyncState: { externalIdentity: document.externalIdentity!, externalVersion: '2', externalChecksumAlgorithm: 'md5', externalChecksum: '5'.repeat(32) },
    })).rejects.toThrow('forced E4 chunk failure');
    await expect(repository.findDocumentByExternalIdentity(userId, document.externalIdentity!)).resolves.toMatchObject({ externalVersion: '1', externalChecksum: '1'.repeat(32) });
    await expect(drizzle(pool).select().from(knowledgeDocumentVersions).where(eq(knowledgeDocumentVersions.documentId, document.id))).resolves.toHaveLength(1);
  });
});
