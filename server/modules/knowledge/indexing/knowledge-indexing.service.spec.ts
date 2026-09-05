import { randomUUID } from 'node:crypto';
import { KnowledgeIndexingService } from './knowledge-indexing.service';
import {
  EmbeddingProviderError,
  type EmbeddingConfig,
  type EmbeddingModelIdentity,
  type EmbeddingResult,
} from './embedding.types';
import type { EmbeddingProvider } from './embedding.provider';
import { computeChunkTextHash } from '../knowledge.hash';
import type { KnowledgeEmbeddingIndexStatus } from './knowledge-indexing.types';

const userId = 'user-1';
const identity: EmbeddingModelIdentity = {
  provider: 'fake-provider',
  model: 'fake-model',
  modelRevision: 'fake-rev-1',
  dimensions: 3,
};
const config: EmbeddingConfig = {
  profile: {
    name: 'e2-embedding-v1',
    version: '1',
    inputEncoding: 'utf8',
    normalization: { name: 'exact', version: '1' },
    truncation: { name: 'reject', version: '1', maxInputCodePoints: 1000 },
    adapterVersion: '1',
  },
  execution: {
    batchSize: 1,
    maxAttempts: 2,
    backoffBaseMs: 0,
    backoffMaxMs: 0,
    leaseDurationMs: 60_000,
  },
};

function version(
  documentId: string,
  id = randomUUID(),
  lifecycleStatus: 'active' | 'tombstoned' = 'active',
) {
  return {
    id,
    userId,
    documentId,
    versionNumber: 1,
    originalContentHash: 'a'.repeat(64),
    parserProfile: {
      name: 'c1-document-parser-v1' as const,
      version: '1' as const,
    },
    chunkingProfile: {
      name: 'c3-deterministic-v1',
      version: '1',
      parameters: { maxSize: 100 },
    },
    lifecycleStatus,
    readinessStatus: 'content-ready-for-indexing' as const,
    indexInputFingerprint: 'b'.repeat(64),
    createdAt: new Date().toISOString(),
  };
}

function chunk(
  documentId: string,
  versionId: string,
  ordinal: number,
  text: string,
) {
  return {
    id: randomUUID(),
    userId,
    documentVersionId: versionId,
    ordinal,
    text,
    textHash: computeChunkTextHash(text),
    provenance: {
      documentId,
      documentVersionId: versionId,
      sourceBlockId: `b${ordinal}`,
      sourceBlockIndex: ordinal,
      section: 'content' as const,
      headingPath: [],
      sourceUnitId: `u${ordinal}`,
      sourceChunkOrdinal: ordinal,
      itemOrdinal: 0,
    },
    citationLocator: {
      documentVersionId: versionId,
      chunkId: 'chunk',
      section: 'content' as const,
    },
  };
}

function createHarness(
  options: {
    oldIndex?: {
      documentVersionId: string;
      profileFingerprint: string;
      status: KnowledgeEmbeddingIndexStatus;
    };
    provider?: Partial<EmbeddingProvider>;
  } = {},
) {
  const documentId = randomUUID();
  const documentVersion = version(documentId);
  const chunks = [
    chunk(documentId, documentVersion.id, 0, 'first'),
    chunk(documentId, documentVersion.id, 1, 'second'),
  ];
  const events: string[] = [];
  const indexes: any[] = options.oldIndex
    ? [
        {
          id: randomUUID(),
          userId,
          documentVersionId: options.oldIndex.documentVersionId,
          embeddingProfileFingerprint: options.oldIndex.profileFingerprint,
          indexFingerprint: 'old-index',
          status: options.oldIndex.status,
          totalChunks: 2,
          indexedChunks: 2,
          failedChunks: 0,
        },
      ]
    : [];
  const rows = new Map<string, any[]>();
  const repository = {
    createOrGetIndex: jest.fn(async (input: any) => {
      const existing = indexes.find(
        (item) =>
          item.userId === input.userId &&
          item.documentVersionId === input.documentVersionId &&
          item.embeddingProfileFingerprint ===
            input.embeddingProfileFingerprint,
      );
      if (existing)
        return { index: existing, created: false, replacement: false };
      const created = {
        ...input,
        id: randomUUID(),
        status: 'indexing',
        totalChunks: input.totalChunks,
        indexedChunks: 0,
        failedChunks: 0,
      };
      indexes.push(created);
      return {
        index: created,
        created: true,
        replacement: indexes.some(
          (item) =>
            item.id !== created.id &&
            item.userId === input.userId &&
            item.documentVersionId === input.documentVersionId &&
            item.status === 'indexed',
        ),
      };
    }),
    createChunkManifest: jest.fn(
      async (indexId: string, _userId: string, input: any[]) => {
        rows.set(
          indexId,
          input.map((item) => ({
            ...item,
            status: 'indexing',
            attemptCount: 0,
          })),
        );
      },
    ),
    claimNextBatch: jest.fn(
      async (_user: string, indexId: string, batchSize: number) => {
        const selected = (rows.get(indexId) ?? [])
          .filter((item) => item.status === 'indexing')
          .slice(0, batchSize);
        if (!selected.length) return null;
        events.push('claim');
        return { leaseOwner: 'worker-1', items: selected };
      },
    ),
    recordBatchIndexed: jest.fn(
      async (
        _user: string,
        indexId: string,
        _leaseOwner: string,
        input: any[],
      ) => {
        events.push('record');
        for (const item of rows.get(indexId) ?? [])
          if (
            input.some(
              (success: any) =>
                success.knowledgeChunkId === item.knowledgeChunkId,
            )
          )
            item.status = 'indexed';
      },
    ),
    recordBatchFailed: jest.fn(
      async (
        _user: string,
        indexId: string,
        _leaseOwner: string,
        chunkIds: string[],
      ) => {
        for (const item of rows.get(indexId) ?? [])
          if (chunkIds.includes(item.knowledgeChunkId)) item.status = 'failed';
      },
    ),
    finalizeIndex: jest.fn(async (_user: string, indexId: string) => {
      const index = indexes.find((item) => item.id === indexId);
      const indexRows = rows.get(indexId) ?? [];
      index.indexedChunks = indexRows.filter(
        (item) => item.status === 'indexed',
      ).length;
      index.failedChunks = indexRows.filter(
        (item) => item.status === 'failed',
      ).length;
      index.status = index.failedChunks ? 'failed' : 'indexed';
      return index;
    }),
    reopenFailedIndex: jest.fn(async (_user: string, indexId: string) => {
      const index = indexes.find((item) => item.id === indexId);
      for (const item of rows.get(indexId) ?? [])
        if (item.status === 'failed') item.status = 'indexing';
      index.status = 'indexing';
      return index;
    }),
    markSameVersionReplacementStale: jest.fn(
      async (_user: string, versionId: string, replacementId: string) => {
        for (const item of indexes)
          if (
            item.documentVersionId === versionId &&
            item.id !== replacementId &&
            item.status === 'indexed'
          )
            item.status = 'stale';
      },
    ),
    getIndex: jest.fn(
      async (_user: string, indexId: string) =>
        indexes.find((item) => item.id === indexId) ?? null,
    ),
  };
  const knowledge = {
    getDocument: jest
      .fn()
      .mockResolvedValue({
        id: documentId,
        userId,
        activeVersionId: documentVersion.id,
        lifecycleStatus: 'active',
      }),
    getVersion: jest.fn().mockResolvedValue(documentVersion),
    getChunks: jest.fn().mockResolvedValue(chunks),
  };
  const provider: EmbeddingProvider = {
    getIdentity: jest.fn().mockResolvedValue(identity),
    embed: jest.fn(
      async (request): Promise<EmbeddingResult> => ({
        identity,
        items: request.items.map((item) => ({
          inputFingerprint: item.inputFingerprint,
          vector: [1, 2, 3],
        })),
      }),
    ),
    checkHealth: jest.fn(),
    ...options.provider,
  };
  const service = new KnowledgeIndexingService(
    knowledge as any,
    repository as any,
    provider,
    config,
    async () => undefined,
  );
  return {
    service,
    repository,
    provider,
    knowledge,
    indexes,
    rows,
    events,
    documentVersion,
    chunks,
  };
}

describe('KnowledgeIndexingService', () => {
  it('indexes persisted chunks in batches and calls the provider outside the repository transaction', async () => {
    const harness = createHarness();
    const result = await harness.service.indexVersion({
      userId,
      documentVersionId: harness.documentVersion.id,
    });

    expect(result.status).toBe('indexed');
    expect(harness.provider.embed).toHaveBeenCalledTimes(2);
    expect(harness.events).toEqual(['claim', 'record', 'claim', 'record']);
    expect(harness.knowledge.getChunks).toHaveBeenCalledWith(
      userId,
      harness.documentVersion.id,
    );
  });

  it('retries a transient provider failure within the bounded execution policy', async () => {
    const embed = jest
      .fn()
      .mockRejectedValueOnce(
        new EmbeddingProviderError('transient', 'temporary'),
      )
      .mockImplementation(async (request) => ({
        identity,
        items: request.items.map((item) => ({
          inputFingerprint: item.inputFingerprint,
          vector: [1, 2, 3],
        })),
      }));
    const harness = createHarness({ provider: { embed } });

    await expect(
      harness.service.indexVersion({
        userId,
        documentVersionId: harness.documentVersion.id,
      }),
    ).resolves.toMatchObject({ status: 'indexed' });
    expect(embed).toHaveBeenCalledTimes(3);
  });

  it('resumes only failed batches without re-embedding successful batches', async () => {
    const embed = jest
      .fn()
      .mockImplementationOnce(async (request) => ({
        identity,
        items: request.items.map((item) => ({
          inputFingerprint: item.inputFingerprint,
          vector: [1, 2, 3],
        })),
      }))
      .mockRejectedValueOnce(
        new EmbeddingProviderError('permanent', 'permanent'),
      )
      .mockImplementation(async (request) => ({
        identity,
        items: request.items.map((item) => ({
          inputFingerprint: item.inputFingerprint,
          vector: [1, 2, 3],
        })),
      }));
    const harness = createHarness({ provider: { embed } });

    const failed = await harness.service.indexVersion({
      userId,
      documentVersionId: harness.documentVersion.id,
    });
    expect(failed.status).toBe('failed');
    const resumed = await harness.service.retryIndex({
      userId,
      indexId: failed.id,
    });

    expect(resumed.status).toBe('indexed');
    expect(embed).toHaveBeenCalledTimes(3);
    expect(embed.mock.calls[2][0].items).toHaveLength(1);
  });

  it('keeps an old same-version indexed materialization valid when replacement fails', async () => {
    const embed = jest
      .fn()
      .mockRejectedValue(
        new EmbeddingProviderError('permanent', 'replacement failed'),
      );
    const harness = createHarness({
      oldIndex: {
        documentVersionId: 'placeholder',
        profileFingerprint: 'old-profile',
        status: 'indexed',
      },
      provider: { embed },
    });
    harness.indexes[0].documentVersionId = harness.documentVersion.id;

    const result = await harness.service.reindexVersion({
      userId,
      documentVersionId: harness.documentVersion.id,
    });

    expect(result.status).toBe('failed');
    expect(
      harness.indexes.find(
        (item) => item.embeddingProfileFingerprint === 'old-profile',
      )?.status,
    ).toBe('indexed');
    expect(
      harness.repository.markSameVersionReplacementStale,
    ).not.toHaveBeenCalled();
  });

  it('marks only the old same-version materialization stale after replacement succeeds', async () => {
    const harness = createHarness({
      oldIndex: {
        documentVersionId: 'placeholder',
        profileFingerprint: 'old-profile',
        status: 'indexed',
      },
    });
    harness.indexes[0].documentVersionId = harness.documentVersion.id;

    const result = await harness.service.reindexVersion({
      userId,
      documentVersionId: harness.documentVersion.id,
    });

    expect(result.status).toBe('indexed');
    expect(
      harness.indexes.find(
        (item) => item.embeddingProfileFingerprint === 'old-profile',
      )?.status,
    ).toBe('stale');
    expect(
      harness.repository.markSameVersionReplacementStale,
    ).toHaveBeenCalledWith(userId, harness.documentVersion.id, result.id);
  });

  it('does not stale an old version when a new version is indexed', async () => {
    const oldVersionId = randomUUID();
    const harness = createHarness({
      oldIndex: {
        documentVersionId: oldVersionId,
        profileFingerprint: 'old-profile',
        status: 'indexed',
      },
    });

    await expect(
      harness.service.indexVersion({
        userId,
        documentVersionId: harness.documentVersion.id,
      }),
    ).resolves.toMatchObject({ status: 'indexed' });
    expect(
      harness.indexes.find((item) => item.documentVersionId === oldVersionId)
        ?.status,
    ).toBe('indexed');
    expect(
      harness.repository.markSameVersionReplacementStale,
    ).not.toHaveBeenCalled();
  });

  it('rejects a tombstoned version before calling the provider', async () => {
    const harness = createHarness();
    harness.knowledge.getVersion.mockResolvedValue(
      version(
        harness.documentVersion.documentId,
        harness.documentVersion.id,
        'tombstoned',
      ),
    );

    await expect(
      harness.service.indexVersion({
        userId,
        documentVersionId: harness.documentVersion.id,
      }),
    ).rejects.toThrow('not indexable');
    expect(harness.provider.embed).not.toHaveBeenCalled();
  });
});
