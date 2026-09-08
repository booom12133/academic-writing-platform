import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';

import type { AppDatabase } from '../../server/database/database.types';
import { computeChunkTextHash, hashTextInputExact } from '../../server/modules/knowledge/knowledge.hash';
import { KnowledgeRepository } from '../../server/modules/knowledge/knowledge.repository';
import { finalizeKnowledgeChunkDraft } from '../../server/modules/knowledge/knowledge.provenance';
import { KnowledgeIndexRepository } from '../../server/modules/knowledge/indexing/knowledge-index.repository';
import { KnowledgeIndexingService } from '../../server/modules/knowledge/indexing/knowledge-indexing.service';
import { createEmbeddingConfig } from '../../server/modules/knowledge/indexing/embedding.config';
import type { EmbeddingProvider } from '../../server/modules/knowledge/indexing/embedding.provider';
import type { EmbeddingHealth, EmbeddingModelIdentity, EmbeddingRequest, EmbeddingResult } from '../../server/modules/knowledge/indexing/embedding.types';
import {
  KnowledgeProductController,
  KnowledgeProductIndexController,
} from '../../server/modules/knowledge-product/knowledge-product.controller';
import { KnowledgeProductError } from '../../server/modules/knowledge-product/knowledge-product.errors';
import { KnowledgeProductIndexingService } from '../../server/modules/knowledge-product/knowledge-product.indexing';
import { KnowledgeProductService } from '../../server/modules/knowledge-product/knowledge-product.service';

const databaseUrl = process.env.DATABASE_URL;
const describeIfDatabase = databaseUrl ? describe : describe.skip;

class FixedEmbeddingProvider implements EmbeddingProvider {
  private readonly identity: EmbeddingModelIdentity = {
    provider: 'wp7-postgres-fixed',
    model: 'wp7-postgres-fixed-v1',
    modelRevision: '1',
    dimensions: 2,
  };

  async getIdentity(): Promise<EmbeddingModelIdentity> {
    return { ...this.identity };
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    return {
      identity: await this.getIdentity(),
      items: request.items.map((item) => ({ inputFingerprint: item.inputFingerprint, vector: [1, 0] })),
    };
  }

  async checkHealth(): Promise<EmbeddingHealth> {
    return { configured: true, provider: this.identity.provider, reachable: true, model: this.identity.model, dimensions: 2 };
  }
}
const documentId = '00000000-0000-4000-8000-000000000010';
const versionId = '00000000-0000-4000-8000-000000000020';
const indexId = '00000000-0000-4000-8000-000000000030';

const document = {
  id: documentId,
  userId: 'owner-1',
  originKind: 'user-upload' as const,
  displayName: 'Paper',
  sourceType: 'txt' as const,
  activeVersionId: versionId,
  lifecycleStatus: 'active' as const,
};

const version = {
  id: versionId,
  userId: 'owner-1',
  documentId,
  versionNumber: 1,
  originalContentHash: 'a'.repeat(64),
  parserProfile: { name: 'c1-document-parser-v1' as const, version: '1' as const },
  chunkingProfile: { name: 'c3-deterministic-v1', version: '1', parameters: { maxSize: 2_000 } },
  sourceText: 'Paper content',
  lifecycleStatus: 'active' as const,
  readinessStatus: 'content-ready-for-indexing' as const,
  indexInputFingerprint: 'b'.repeat(64),
  createdAt: '2026-09-08T00:00:00.000Z',
};

const index = {
  id: indexId,
  userId: 'owner-1',
  documentVersionId: versionId,
  e1IndexInputFingerprint: 'c'.repeat(64),
  embeddingProfileFingerprint: 'd'.repeat(64),
  indexFingerprint: 'e'.repeat(64),
  embeddingModelIdentity: { provider: 'test', model: 'test-v1', modelRevision: '1', dimensions: 2 },
  status: 'indexed' as const,
  totalChunks: 1,
  indexedChunks: 1,
  failedChunks: 0,
  attemptCount: 1,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
};

describe('Knowledge product indexing HTTP boundary', () => {
  let app: INestApplication;
  let baseUrl: string;
  const repository = {
    getDocument: jest.fn(async (userId: string, id: string) => userId === 'owner-1' && id === documentId ? document : null),
    getVersion: jest.fn(async (userId: string, id: string) => userId === 'owner-1' && id === versionId ? version : null),
    listDocuments: jest.fn().mockResolvedValue([]),
    getSourceRecord: jest.fn().mockResolvedValue(null),
  };
  const knowledge = { importDocument: jest.fn(), tombstoneDocument: jest.fn() };
  const documentInput = { validateOwnedRef: jest.fn() };
  const indexing = {
    getIndexStatus: jest.fn().mockResolvedValue(null),
    indexActiveVersion: jest.fn().mockResolvedValue(index),
    retryIndex: jest.fn().mockResolvedValue(index),
  };

  beforeAll(async () => {
    const service = new KnowledgeProductService(
      repository as never,
      knowledge as never,
      documentInput as never,
      indexing as never,
    );
    const moduleRef = await Test.createTestingModule({
      controllers: [KnowledgeProductController, KnowledgeProductIndexController],
      providers: [{ provide: KnowledgeProductService, useValue: service }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use((req: { headers: Record<string, unknown>; userContext?: { userId: string } }, _res: unknown, next: () => void) => {
      const userId = req.headers['x-test-user'];
      if (typeof userId === 'string') req.userContext = { userId };
      next();
    });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    indexing.getIndexStatus.mockClear();
    indexing.indexActiveVersion.mockClear();
    indexing.retryIndex.mockClear();
  });

  it('serves authenticated index, status, and retry routes with owner context', async () => {
    const indexResponse = await fetch(`${baseUrl}/api/knowledge/documents/${documentId}/index`, {
      method: 'POST',
      headers: { 'x-test-user': 'owner-1' },
    });
    expect(indexResponse.status).toBe(201);
    expect(await indexResponse.json()).toEqual(expect.objectContaining({
      document: expect.objectContaining({ id: documentId }),
      index: expect.objectContaining({ id: indexId, status: 'indexed' }),
    }));
    expect(indexing.indexActiveVersion).toHaveBeenCalledWith('owner-1', documentId);

    const statusResponse = await fetch(`${baseUrl}/api/knowledge/documents/${documentId}/index`, {
      headers: { 'x-test-user': 'owner-1' },
    });
    expect(statusResponse.status).toBe(200);
    expect(await statusResponse.json()).not.toHaveProperty('index');

    const retryResponse = await fetch(`${baseUrl}/api/knowledge/indexes/${indexId}/retry`, {
      method: 'POST',
      headers: { 'x-test-user': 'owner-1' },
    });
    expect(retryResponse.status).toBe(201);
    expect(await retryResponse.json()).toEqual(expect.objectContaining({
      index: expect.objectContaining({ id: indexId, status: 'indexed' }),
    }));
    expect(indexing.retryIndex).toHaveBeenCalledWith('owner-1', indexId);
  });

  it('rejects anonymous and cross-owner indexing requests', async () => {
    const anonymous = await fetch(`${baseUrl}/api/knowledge/documents/${documentId}/index`, { method: 'POST' });
    expect(anonymous.status).toBe(401);

    const crossOwner = await fetch(`${baseUrl}/api/knowledge/documents/${documentId}/index`, {
      method: 'POST',
      headers: { 'x-test-user': 'owner-2' },
    });
    expect(crossOwner.status).toBe(404);
  });

  it('returns a stable sanitized error when indexing is unavailable', async () => {
    indexing.indexActiveVersion.mockRejectedValueOnce(
      new KnowledgeProductError(
        'KNOWLEDGE_PRODUCT_UNAVAILABLE',
        'Knowledge indexing is unavailable or failed.',
        503,
      ),
    );

    const response = await fetch(`${baseUrl}/api/knowledge/documents/${documentId}/index`, {
      method: 'POST',
      headers: { 'x-test-user': 'owner-1' },
    });

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: 'KNOWLEDGE_PRODUCT_UNAVAILABLE',
        message: 'Knowledge indexing is unavailable or failed.',
        timestamp: expect.any(Number),
      },
    });
    expect(JSON.stringify(body)).not.toContain('stack');
    expect(JSON.stringify(body)).not.toContain('cause');
  });
});

describeIfDatabase('WP7 PostgreSQL product indexing HTTP integration', () => {
  let pool: Pool;
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await migrate(drizzle(pool), { migrationsFolder: 'drizzle/migrations' });
    const db = drizzle(pool) as AppDatabase;
    const knowledgeRepository = new KnowledgeRepository(db);
    const indexRepository = new KnowledgeIndexRepository(db);
    const indexing = new KnowledgeIndexingService(
      knowledgeRepository,
      indexRepository,
      new FixedEmbeddingProvider(),
      createEmbeddingConfig({ EMBEDDING_MAX_INPUT_CODE_POINTS: '10000' }),
    );
    const productIndexing = new KnowledgeProductIndexingService(
      knowledgeRepository,
      indexRepository,
      indexing,
    );
    const product = new KnowledgeProductService(
      knowledgeRepository,
      { importDocument: jest.fn(), tombstoneDocument: jest.fn() } as never,
      { validateOwnedRef: jest.fn() } as never,
      productIndexing,
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [KnowledgeProductController, KnowledgeProductIndexController],
      providers: [{ provide: KnowledgeProductService, useValue: product }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use((req: { headers: Record<string, unknown>; userContext?: { userId: string } }, _res: unknown, next: () => void) => {
      const userId = req.headers['x-test-user'];
      if (typeof userId === 'string') req.userContext = { userId };
      next();
    });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (app) await app.close();
    if (pool) await pool.end();
  });

  it('projects a real PostgreSQL lifecycle through owner-scoped HTTP routes', async () => {
    const userId = `wp7-owner-${randomUUID()}`;
    const otherUserId = `wp7-other-${randomUUID()}`;
    const db = drizzle(pool) as AppDatabase;
    const knowledge = new KnowledgeRepository(db);
    const document = await knowledge.createDocument({
      userId,
      originKind: 'user-upload',
      displayName: 'WP7 PostgreSQL paper',
      sourceType: 'txt',
    });
    const version = await knowledge.createVersion({
      userId,
      documentId: document.id,
      versionNumber: 1,
      originalContentHash: hashTextInputExact('WP7 content'),
      parserProfile: { name: 'c1-document-parser-v1', version: '1' },
      chunkingProfile: { name: 'c3-deterministic-v1', version: '1', parameters: { maxSize: 100 } },
      sourceText: 'WP7 content',
      lifecycleStatus: 'active',
      readinessStatus: 'content-ready-for-indexing',
      indexInputFingerprint: hashTextInputExact(`wp7-${randomUUID()}`),
    });
    await knowledge.createChunks([finalizeKnowledgeChunkDraft({
      draft: {
        userId,
        documentVersionId: version.id,
        ordinal: 0,
        text: 'WP7 content',
        textHash: computeChunkTextHash('WP7 content'),
        provenance: {
          documentId: document.id,
          documentVersionId: version.id,
          sourceBlockId: 'wp7-block',
          sourceBlockIndex: 0,
          section: 'content',
          headingPath: [],
          sourceUnitId: 'wp7-unit',
          sourceChunkOrdinal: 0,
          itemOrdinal: 0,
        },
        citationLocator: {
          documentVersionId: version.id,
          section: 'content',
          sourceBlockId: 'wp7-block',
          sourceBlockIndex: 0,
        },
      },
      chunkId: randomUUID(),
    })]);
    await knowledge.activateVersion(userId, document.id, version.id);

    const before = await fetch(`${baseUrl}/api/knowledge/documents/${document.id}/index`, {
      headers: { 'x-test-user': userId },
    });
    expect(before.status).toBe(200);
    expect(await before.json()).not.toHaveProperty('index');

    const indexed = await fetch(`${baseUrl}/api/knowledge/documents/${document.id}/index`, {
      method: 'POST',
      headers: { 'x-test-user': userId },
    });
    expect(indexed.status).toBe(201);
    const indexedBody = await indexed.json() as { index?: { status?: string; id?: string } };
    expect(indexedBody.index).toEqual(expect.objectContaining({ status: 'indexed' }));
    const indexId = indexedBody.index?.id;
    expect(indexId).toEqual(expect.any(String));

    const after = await fetch(`${baseUrl}/api/knowledge/documents/${document.id}/index`, {
      headers: { 'x-test-user': userId },
    });
    expect(after.status).toBe(200);
    expect(await after.json()).toEqual(expect.objectContaining({
      index: expect.objectContaining({ status: 'indexed', id: indexId }),
    }));

    const crossUser = await fetch(`${baseUrl}/api/knowledge/documents/${document.id}/index`, {
      headers: { 'x-test-user': otherUserId },
    });
    expect(crossUser.status).toBe(404);
  });
});
