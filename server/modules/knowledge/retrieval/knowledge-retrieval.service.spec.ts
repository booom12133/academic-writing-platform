import type { EmbeddingProvider } from '../indexing/embedding.provider';
import { createEmbeddingConfig } from '../indexing/embedding.config';
import type {
  KnowledgeDocument,
  KnowledgeDocumentVersion,
  KnowledgeChunk,
} from '../knowledge.types';
import { createRetrievalConfig } from './retrieval.config';
import { RetrievalError } from './retrieval.errors';
import {
  KnowledgeRetrievalService,
  type KnowledgeRetrievalRepositoryPort,
} from './knowledge-retrieval.service';
import type { RetrievalVersionCandidate } from './version-selection';

function candidate(versionId: string, activeVersionId = versionId): RetrievalVersionCandidate {
  const document: KnowledgeDocument = {
    id: 'document-1',
    userId: 'user-1',
    activeVersionId,
    originKind: 'user-upload',
    displayName: 'Document',
    sourceType: 'txt',
    lifecycleStatus: 'active',
  };
  const version: KnowledgeDocumentVersion = {
    id: versionId,
    userId: 'user-1',
    documentId: document.id,
    versionNumber: versionId === 'version-2' ? 2 : 1,
    originalContentHash: 'a'.repeat(64),
    parserProfile: { name: 'c1-document-parser-v1', version: '1' },
    chunkingProfile: {
      name: 'c3-deterministic-v1',
      version: '1',
      parameters: { maxSize: 100 },
    },
    lifecycleStatus: 'active',
    readinessStatus: 'content-ready-for-indexing',
    indexInputFingerprint: 'b'.repeat(64),
    createdAt: '2026-09-06T00:00:00.000Z',
  };
  return { document, version };
}

function chunk(versionId: string): KnowledgeChunk {
  return {
    id: 'chunk-1',
    userId: 'user-1',
    documentVersionId: versionId,
    ordinal: 0,
    text: 'retrieved text',
    textHash: 'c'.repeat(64),
    provenance: {
      documentId: 'document-1',
      documentVersionId: versionId,
      sourceBlockId: 'block-1',
      sourceBlockIndex: 0,
      section: 'content',
      headingPath: [],
      sourceUnitId: 'unit-1',
      sourceChunkOrdinal: 0,
      itemOrdinal: 0,
    },
    citationLocator: {
      documentVersionId: versionId,
      chunkId: 'chunk-1',
      section: 'content',
      sourceBlockId: 'block-1',
      sourceBlockIndex: 0,
    },
  };
}

describe('KnowledgeRetrievalService', () => {
  const identity = {
    provider: 'provider-a',
    model: 'model-a',
    modelRevision: 'revision-a',
    dimensions: 3,
  };

  function createHarness() {
    const provider: EmbeddingProvider = {
      getIdentity: jest.fn(async () => identity),
      embed: jest.fn(async (request) => ({
        identity,
        items: request.items.map((item) => ({
          inputFingerprint: item.inputFingerprint,
          vector: [1, 2, 3],
        })),
      })),
      checkHealth: jest.fn(),
    };
    const repository: jest.Mocked<KnowledgeRetrievalRepositoryPort> = {
      resolveActiveCandidates: jest.fn(),
      resolveExplicitCandidates: jest.fn(),
      searchIndexedChunks: jest.fn(),
    };
    return {
      provider,
      repository,
      service: new KnowledgeRetrievalService(
        repository,
        provider,
        createEmbeddingConfig({}),
        createRetrievalConfig({}),
      ),
    };
  }

  it('resolves active versions in the service before querying indexed vectors', async () => {
    const harness = createHarness();
    harness.repository.resolveActiveCandidates.mockResolvedValue([candidate('version-1')]);
    harness.repository.searchIndexedChunks.mockResolvedValue({
      items: [
        {
          chunk: chunk('version-1'),
          document: candidate('version-1').document,
          version: candidate('version-1').version,
          indexId: 'index-1',
          indexFingerprint: 'd'.repeat(64),
          embeddingProfileFingerprint: 'e'.repeat(64),
          embeddingModelIdentity: identity,
          rawDistance: 0.1,
        },
      ],
      profileUnavailableVersionIds: [],
      unavailableVersionIds: [],
    });

    const result = await harness.service.retrieve({
      userId: 'user-1',
      queryText: 'query',
      selection: { mode: 'active' },
      policy: { topK: 1, candidateLimit: 1 },
    });

    expect(harness.repository.resolveActiveCandidates).toHaveBeenCalledWith({
      userId: 'user-1',
      filters: undefined,
    });
    expect(harness.repository.searchIndexedChunks).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        versionIds: ['version-1'],
        vector: [1, 2, 3],
        candidateLimit: 1,
        distanceMetric: 'cosine',
      }),
    );
    expect(result).toMatchObject({ status: 'complete', selectedVersionIds: ['version-1'] });
    expect(result.items[0]).toMatchObject({ rank: 1, retrievalScore: 0.9 });
  });

  it('uses explicit historical versions and reports profile-incompatible versions as empty when no rows remain', async () => {
    const harness = createHarness();
    harness.repository.resolveExplicitCandidates.mockResolvedValue([
      candidate('version-1', 'version-2'),
      candidate('version-2', 'version-2'),
    ]);
    harness.repository.searchIndexedChunks.mockResolvedValue({
      items: [],
      profileUnavailableVersionIds: ['version-1'],
      unavailableVersionIds: [],
    });

    const result = await harness.service.retrieve({
      userId: 'user-1',
      queryText: 'query',
      selection: { mode: 'explicit', documentVersionIds: ['version-1', 'version-2'] },
    });

    expect(harness.repository.resolveExplicitCandidates).toHaveBeenCalledWith({
      userId: 'user-1',
      documentVersionIds: ['version-1', 'version-2'],
      filters: undefined,
    });
    expect(result.status).toBe('empty');
    expect(result.diagnostics).toEqual([
      { code: 'profile-unavailable', documentVersionId: 'version-1' },
    ]);
  });

  it('returns empty when the selected scope has no indexed compatible rows', async () => {
    const harness = createHarness();
    harness.repository.resolveActiveCandidates.mockResolvedValue([candidate('version-1')]);
    harness.repository.searchIndexedChunks.mockResolvedValue({
      items: [],
      profileUnavailableVersionIds: [],
      unavailableVersionIds: [],
    });

    await expect(
      harness.service.retrieve({ userId: 'user-1', queryText: 'query' }),
    ).resolves.toMatchObject({ status: 'empty', items: [] });
  });

  it('does not convert query embedding failures into empty retrieval results', async () => {
    const harness = createHarness();
    harness.repository.resolveActiveCandidates.mockResolvedValue([candidate('version-1')]);
    harness.provider.embed = jest.fn().mockRejectedValue(new Error('provider unavailable'));

    await expect(
      harness.service.retrieve({ userId: 'user-1', queryText: 'query' }),
    ).rejects.toMatchObject<Partial<RetrievalError>>({
      code: 'RETRIEVAL_QUERY_EMBEDDING_FAILED',
    });
    expect(harness.repository.searchIndexedChunks).not.toHaveBeenCalled();
  });

  it('short-circuits an empty resolved scope before calling the embedding provider', async () => {
    const harness = createHarness();
    harness.repository.resolveActiveCandidates.mockResolvedValue([]);
    harness.provider.getIdentity = jest.fn().mockRejectedValue(new Error('provider must not run'));
    harness.provider.embed = jest.fn().mockRejectedValue(new Error('provider must not run'));

    await expect(
      harness.service.retrieve({ userId: 'user-1', queryText: 'query' }),
    ).resolves.toMatchObject({
      status: 'empty',
      selectedVersionIds: [],
      items: [],
    });
    expect(harness.provider.getIdentity).not.toHaveBeenCalled();
    expect(harness.provider.embed).not.toHaveBeenCalled();
    expect(harness.repository.searchIndexedChunks).not.toHaveBeenCalled();
  });

  it('returns empty when every retrieved candidate is excluded by the threshold', async () => {
    const harness = createHarness();
    harness.repository.resolveActiveCandidates.mockResolvedValue([candidate('version-1')]);
    harness.repository.searchIndexedChunks.mockResolvedValue({
      items: [
        {
          chunk: chunk('version-1'),
          document: candidate('version-1').document,
          version: candidate('version-1').version,
          indexId: 'index-1',
          indexFingerprint: 'd'.repeat(64),
          embeddingProfileFingerprint: 'e'.repeat(64),
          embeddingModelIdentity: identity,
          rawDistance: 0.9,
        },
      ],
      profileUnavailableVersionIds: [],
      unavailableVersionIds: [],
    });

    const result = await harness.service.retrieve({
      userId: 'user-1',
      queryText: 'query',
      policy: { topK: 1, candidateLimit: 1, minRetrievalScore: 0.5 },
    });

    expect(result.status).toBe('empty');
    expect(result.items).toEqual([]);
    expect(result.diagnostics).toEqual([{ code: 'threshold-excluded' }]);
  });

  it('returns partial when one selected version has no indexed materialization', async () => {
    const harness = createHarness();
    harness.repository.resolveExplicitCandidates.mockResolvedValue([
      candidate('version-1', 'version-2'),
      candidate('version-2', 'version-2'),
    ]);
    harness.repository.searchIndexedChunks.mockResolvedValue({
      items: [
        {
          chunk: chunk('version-1'),
          document: candidate('version-1').document,
          version: candidate('version-1').version,
          indexId: 'index-1',
          indexFingerprint: 'd'.repeat(64),
          embeddingProfileFingerprint: 'e'.repeat(64),
          embeddingModelIdentity: identity,
          rawDistance: 0.1,
        },
      ],
      profileUnavailableVersionIds: [],
      unavailableVersionIds: ['version-2'],
    });

    const result = await harness.service.retrieve({
      userId: 'user-1',
      queryText: 'query',
      selection: { mode: 'explicit', documentVersionIds: ['version-1', 'version-2'] },
      policy: { topK: 1, candidateLimit: 1 },
    });

    expect(result.status).toBe('partial');
    expect(result.items).toHaveLength(1);
    expect(result.diagnostics).toContainEqual({
      code: 'materialization-unavailable',
      documentVersionId: 'version-2',
    });
  });
});
