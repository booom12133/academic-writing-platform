import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import type { AppDatabase } from '../../server/database/database.types';
import { KnowledgeRepository } from '../../server/modules/knowledge/knowledge.repository';
import { finalizeKnowledgeChunkDraft } from '../../server/modules/knowledge/knowledge.provenance';
import { computeChunkTextHash, hashTextInputExact } from '../../server/modules/knowledge/knowledge.hash';
import { KnowledgeIndexRepository } from '../../server/modules/knowledge/indexing/knowledge-index.repository';
import { KnowledgeIndexingService } from '../../server/modules/knowledge/indexing/knowledge-indexing.service';
import { computeEmbeddingProfileFingerprint } from '../../server/modules/knowledge/indexing/embedding.fingerprint';
import { createEmbeddingConfig } from '../../server/modules/knowledge/indexing/embedding.config';
import type {
  EmbeddingHealth,
  EmbeddingModelIdentity,
  EmbeddingRequest,
  EmbeddingResult,
} from '../../server/modules/knowledge/indexing/embedding.types';
import type { EmbeddingProvider } from '../../server/modules/knowledge/indexing/embedding.provider';
import { EvidenceAssemblyService } from '../../server/modules/knowledge/retrieval/evidence-assembly';
import { KnowledgeEvidenceService } from '../../server/modules/knowledge/retrieval/knowledge-evidence.service';
import { KnowledgeRetrievalRepository } from '../../server/modules/knowledge/retrieval/knowledge-retrieval.repository';
import { KnowledgeRetrievalService } from '../../server/modules/knowledge/retrieval/knowledge-retrieval.service';
import { createRetrievalConfig } from '../../server/modules/knowledge/retrieval/retrieval.config';

const databaseUrl = process.env.DATABASE_URL;
const describeIfDatabase = databaseUrl ? describe : describe.skip;

class FixedEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly identity: EmbeddingModelIdentity,
    private readonly vectors: ReadonlyMap<string, number[]>,
  ) {}

  async getIdentity(): Promise<EmbeddingModelIdentity> {
    return { ...this.identity };
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    return {
      identity: await this.getIdentity(),
      items: request.items.map((item) => ({
        inputFingerprint: item.inputFingerprint,
        vector: [...(this.vectors.get(item.text) ?? [1, 0])],
      })),
    };
  }

  async checkHealth(): Promise<EmbeddingHealth> {
    return {
      configured: true,
      provider: this.identity.provider,
      reachable: true,
      model: this.identity.model,
      dimensions: this.identity.dimensions,
    };
  }
}

describeIfDatabase('E3 PostgreSQL and pgvector retrieval', () => {
  let pool: Pool;
  const embeddingConfig = createEmbeddingConfig({ EMBEDDING_MAX_INPUT_CODE_POINTS: '10000' });
  const identity: EmbeddingModelIdentity = {
    provider: 'e3-fixed',
    model: 'e3-fixed-v1',
    modelRevision: 'revision-1',
    dimensions: 2,
  };
  const provider = new FixedEmbeddingProvider(
    identity,
    new Map([
      ['query', [1, 0]],
      ['match', [1, 0]],
      ['tie-a', [1, 0]],
      ['tie-b', [1, 0]],
      ['far', [0, 1]],
      ['historical', [1, 0]],
    ]),
  );

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await migrate(drizzle(pool), { migrationsFolder: 'drizzle/migrations' });
  });

  afterAll(async () => {
    await pool.end();
  });

  async function seedVersion(input: {
    knowledge: KnowledgeRepository;
    indexing: KnowledgeIndexingService;
    userId: string;
    text: string;
    versionNumber?: number;
    sourceRecordId?: string;
    activate?: boolean;
    index?: boolean;
    lifecycleStatus?: 'active' | 'tombstoned';
  }) {
    const document = await input.knowledge.createDocument({
      userId: input.userId,
      ...(input.sourceRecordId === undefined ? {} : { sourceRecordId: input.sourceRecordId }),
      originKind: 'user-upload',
      displayName: input.text,
      sourceType: 'txt',
    });
    const version = await input.knowledge.createVersion({
      userId: input.userId,
      documentId: document.id,
      versionNumber: input.versionNumber ?? 1,
      originalContentHash: hashTextInputExact(input.text),
      parserProfile: { name: 'c1-document-parser-v1', version: '1' },
      chunkingProfile: {
        name: 'c3-deterministic-v1',
        version: '1',
        parameters: { maxSize: 100 },
      },
      sourceText: input.text,
      lifecycleStatus: input.lifecycleStatus ?? 'active',
      readinessStatus: 'content-ready-for-indexing',
      indexInputFingerprint: hashTextInputExact(`e1-${input.text}-${randomUUID()}`),
    });
    const chunk = finalizeKnowledgeChunkDraft({
      draft: {
        userId: input.userId,
        documentVersionId: version.id,
        ordinal: 0,
        text: input.text,
        textHash: computeChunkTextHash(input.text),
        provenance: {
          ...(input.sourceRecordId === undefined ? {} : { sourceRecordId: input.sourceRecordId }),
          documentId: document.id,
          documentVersionId: version.id,
          sourceBlockId: `block-${input.text}`,
          sourceBlockIndex: 0,
          section: 'content',
          headingPath: [],
          sourceUnitId: `unit-${input.text}`,
          sourceChunkOrdinal: 0,
          itemOrdinal: 0,
        },
        citationLocator: {
          ...(input.sourceRecordId === undefined ? {} : { sourceRecordId: input.sourceRecordId }),
          documentVersionId: version.id,
          section: 'content',
          sourceBlockId: `block-${input.text}`,
          sourceBlockIndex: 0,
        },
      },
      chunkId: randomUUID(),
    });
    await input.knowledge.createChunks([chunk]);
    if (input.activate !== false && input.lifecycleStatus !== 'tombstoned') {
      await input.knowledge.activateVersion(input.userId, document.id, version.id);
    }
    const index =
      input.index === false || input.lifecycleStatus === 'tombstoned'
        ? null
        : await input.indexing.indexVersion({ userId: input.userId, documentVersionId: version.id });
    return { document, version, chunk, index };
  }

  function services(db: AppDatabase, metric: 'cosine' | 'inner-product' | 'l2' = 'cosine') {
    const knowledge = new KnowledgeRepository(db);
    const indexRepository = new KnowledgeIndexRepository(db);
    const indexing = new KnowledgeIndexingService(knowledge, indexRepository, provider, embeddingConfig);
    const retrievalRepository = new KnowledgeRetrievalRepository(db);
    const retrieval = new KnowledgeRetrievalService(
      retrievalRepository,
      provider,
      embeddingConfig,
      createRetrievalConfig({ RETRIEVAL_DISTANCE_METRIC: metric, RETRIEVAL_DEFAULT_TOP_K: '8', RETRIEVAL_DEFAULT_CANDIDATE_LIMIT: '32' }),
    );
    const evidence = new KnowledgeEvidenceService(retrieval, knowledge, new EvidenceAssemblyService());
    return { knowledge, indexing, retrieval, evidence };
  }

  it('performs exact metric searches with deterministic ordering and policy controls', async () => {
    const db = drizzle(pool) as AppDatabase;
    const { knowledge, indexing } = services(db);
    const userId = `e3-ranking-${randomUUID()}`;
    const source = await knowledge.createSourceRecord({ userId, kind: 'scholarly-work' });
    const document = await knowledge.createDocument({ userId, sourceRecordId: source.id, originKind: 'user-upload', displayName: 'ranking', sourceType: 'txt' });
    const version = await knowledge.createVersion({
      userId,
      documentId: document.id,
      versionNumber: 1,
      originalContentHash: hashTextInputExact('ranking'),
      parserProfile: { name: 'c1-document-parser-v1', version: '1' },
      chunkingProfile: { name: 'c3-deterministic-v1', version: '1', parameters: { maxSize: 100 } },
      sourceText: 'ranking',
      lifecycleStatus: 'active',
      readinessStatus: 'content-ready-for-indexing',
      indexInputFingerprint: hashTextInputExact(`ranking-${randomUUID()}`),
    });
    const chunks = ['tie-a', 'tie-b', 'far'].map((text, ordinal) => finalizeKnowledgeChunkDraft({
      draft: {
        userId,
        documentVersionId: version.id,
        ordinal,
        text,
        textHash: computeChunkTextHash(text),
        provenance: { sourceRecordId: source.id, documentId: document.id, documentVersionId: version.id, sourceBlockId: `b${ordinal}`, sourceBlockIndex: ordinal, section: 'content', headingPath: [], sourceUnitId: `u${ordinal}`, sourceChunkOrdinal: 0, itemOrdinal: ordinal },
        citationLocator: { sourceRecordId: source.id, documentVersionId: version.id, section: 'content', sourceBlockId: `b${ordinal}`, sourceBlockIndex: ordinal },
      },
      chunkId: randomUUID(),
    }));
    await knowledge.createChunks(chunks);
    await knowledge.activateVersion(userId, document.id, version.id);
    await indexing.indexVersion({ userId, documentVersionId: version.id });

    for (const metric of ['cosine', 'inner-product', 'l2'] as const) {
      const { retrieval } = services(db, metric);
      const result = await retrieval.retrieve({ userId, queryText: 'query', policy: { topK: 2, candidateLimit: 3 } });
      expect(result.items).toHaveLength(2);
      expect(result.items.map((item) => item.chunk.text)).toEqual(['tie-a', 'tie-b']);
      expect(result.items[0].retrievalScore).toBeGreaterThanOrEqual(result.items[1].retrievalScore);
    }

    const { retrieval } = services(db, 'cosine');
    const threshold = await retrieval.retrieve({ userId, queryText: 'query', policy: { topK: 8, candidateLimit: 8, minRetrievalScore: 0.5 } });
    expect(threshold.items.map((item) => item.chunk.text)).toEqual(['tie-a', 'tie-b']);
    expect(threshold.status).toBe('partial');
    expect(threshold.diagnostics).toContainEqual({ code: 'threshold-excluded' });
    expect(threshold.profile.embeddingProfileFingerprint).toBe(
      computeEmbeddingProfileFingerprint(identity, embeddingConfig.profile),
    );
  });

  it('enforces owner/version/profile scope and restores E1 provenance into evidence', async () => {
    const db = drizzle(pool) as AppDatabase;
    const { knowledge, indexing, retrieval, evidence } = services(db);
    const userId = `e3-scope-${randomUUID()}`;
    const otherUserId = `e3-other-${randomUUID()}`;
    const source = await knowledge.createSourceRecord({ userId, kind: 'scholarly-work' });
    const active = await seedVersion({ knowledge, indexing, userId, text: 'match', sourceRecordId: source.id });
    const historical = await seedVersion({ knowledge, indexing, userId, text: 'historical', sourceRecordId: source.id, activate: false, versionNumber: 2 });
    await knowledge.activateVersion(userId, active.document.id, active.version.id);
    await seedVersion({ knowledge, indexing, userId: otherUserId, text: 'match' });

    const activeResult = await retrieval.retrieve({ userId, queryText: 'query', filters: { sourceRecordIds: [source.id] } });
    expect(activeResult.items.map((item) => item.chunk.text)).toEqual(['match']);
    expect(activeResult.selectedVersionIds).toEqual([active.version.id]);

    const historicalResult = await retrieval.retrieve({ userId, queryText: 'query', selection: { mode: 'explicit', documentVersionIds: [historical.version.id] } });
    expect(historicalResult.items.map((item) => item.chunk.text)).toEqual(['historical']);

    const assembled = await evidence.retrieve({ userId, queryText: 'query', selection: { mode: 'explicit', documentVersionIds: [historical.version.id] } });
    expect(assembled.items[0]).toMatchObject({
      knowledgeChunkId: historical.chunk.id,
      text: 'historical',
      provenance: historical.chunk.provenance,
      citationLocator: historical.chunk.citationLocator,
      sourceIdentity: source,
    });
    expect(assembled.items[0]).not.toHaveProperty('evidenceScore');
  });

  it('reports incompatible indexed profiles without mixing vectors and returns empty for non-indexed materialization', async () => {
    const db = drizzle(pool) as AppDatabase;
    const { knowledge, indexing, retrieval } = services(db);
    const userId = `e3-profile-${randomUUID()}`;
    const source = await knowledge.createSourceRecord({ userId, kind: 'scholarly-work' });
    const mismatchProvider = new FixedEmbeddingProvider(
      { ...identity, provider: 'other-provider' },
      new Map([
        ['query', [1, 0]],
        ['historical', [1, 0]],
        ['far', [0, 1]],
      ]),
    );
    const mismatchIndexing = new KnowledgeIndexingService(knowledge, new KnowledgeIndexRepository(db), mismatchProvider, embeddingConfig);
    const historical = await seedVersion({ knowledge, indexing: mismatchIndexing, userId, text: 'historical', sourceRecordId: source.id });
    const mismatch = historical.index;
    expect(mismatch?.status).toBe('indexed');

    const profileUnavailable = await retrieval.retrieve({ userId, queryText: 'query', selection: { mode: 'explicit', documentVersionIds: [historical.version.id] } });
    expect(profileUnavailable.items).toEqual([]);
    expect(profileUnavailable.status).toBe('empty');
    expect(profileUnavailable.diagnostics).toContainEqual({ code: 'profile-unavailable', documentVersionId: historical.version.id });

    const nonIndexed = await seedVersion({ knowledge, indexing, userId, text: 'far', sourceRecordId: source.id, activate: false, index: false, versionNumber: 2 });
    const failedIndex = await new KnowledgeIndexRepository(db).createOrGetIndex({
      userId,
      documentVersionId: nonIndexed.version.id,
      e1IndexInputFingerprint: nonIndexed.version.indexInputFingerprint,
      embeddingProfileFingerprint: computeEmbeddingProfileFingerprint(identity, embeddingConfig.profile),
      indexFingerprint: 'f'.repeat(64),
      embeddingModelIdentity: identity,
      totalChunks: 1,
    });
    expect(failedIndex.index.status).toBe('indexing');
    const empty = await retrieval.retrieve({ userId, queryText: 'query', selection: { mode: 'explicit', documentVersionIds: [nonIndexed.version.id] } });
    expect(empty.status).toBe('empty');
    expect(empty.items).toEqual([]);
    expect(empty.diagnostics).toContainEqual({
      code: 'materialization-unavailable',
      documentVersionId: nonIndexed.version.id,
    });
  });
});
