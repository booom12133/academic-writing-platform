import type { KnowledgeRepositoryPort } from '../knowledge.repository';
import type { SourceRecord } from '../knowledge.types';
import { EvidenceAssemblyService } from './evidence-assembly';
import type { KnowledgeRetrievalInput, RetrievalResult } from './knowledge-retrieval.service';
import { KnowledgeEvidenceService } from './knowledge-evidence.service';

describe('KnowledgeEvidenceService', () => {
  const source: SourceRecord = {
    id: 'source-1',
    userId: 'user-1',
    kind: 'scholarly-work',
    canonicalMetadata: {},
    externalProvenance: [],
    status: 'active',
    createdAt: '2026-09-06T00:00:00.000Z',
    updatedAt: '2026-09-06T00:00:00.000Z',
  };
  const retrieval: RetrievalResult = {
    status: 'complete',
    selectedVersionIds: ['version-1'],
    items: [
      {
        chunk: {
          id: 'chunk-1',
          userId: 'user-1',
          documentVersionId: 'version-1',
          ordinal: 0,
          text: 'evidence text',
          textHash: 'a'.repeat(64),
          provenance: {
            sourceRecordId: 'source-1',
            documentId: 'document-1',
            documentVersionId: 'version-1',
            sourceBlockId: 'block-1',
            sourceBlockIndex: 0,
            section: 'content',
            headingPath: [],
            sourceUnitId: 'unit-1',
            sourceChunkOrdinal: 0,
            itemOrdinal: 0,
          },
          citationLocator: {
            documentVersionId: 'version-1',
            sourceRecordId: 'source-1',
            chunkId: 'chunk-1',
            section: 'content',
            sourceBlockId: 'block-1',
            sourceBlockIndex: 0,
          },
        },
        document: {
          id: 'document-1',
          userId: 'user-1',
          sourceRecordId: 'source-1',
          originKind: 'user-upload',
          displayName: 'Document',
          sourceType: 'txt',
          activeVersionId: 'version-1',
          lifecycleStatus: 'active',
        },
        version: {
          id: 'version-1',
          userId: 'user-1',
          documentId: 'document-1',
          versionNumber: 1,
          originalContentHash: 'b'.repeat(64),
          parserProfile: { name: 'c1-document-parser-v1', version: '1' },
          chunkingProfile: { name: 'c3-deterministic-v1', version: '1', parameters: { maxSize: 100 } },
          lifecycleStatus: 'active',
          readinessStatus: 'content-ready-for-indexing',
          indexInputFingerprint: 'c'.repeat(64),
          createdAt: '2026-09-06T00:00:00.000Z',
        },
        indexId: 'index-1',
        indexFingerprint: 'd'.repeat(64),
        embeddingProfileFingerprint: 'e'.repeat(64),
        embeddingModelIdentity: { provider: 'provider-a', model: 'model-a', modelRevision: 'revision-a', dimensions: 3 },
        rawDistance: 0.1,
        rank: 1,
        retrievalScore: 0.9,
      },
    ],
    diagnostics: [],
    profile: {
      provider: 'provider-a',
      model: 'model-a',
      modelRevision: 'revision-a',
      dimensions: 3,
      embeddingProfileFingerprint: 'e'.repeat(64),
      distanceMetric: 'cosine',
    },
  };

  it('recovers source identity through the owner-safe E1 repository', async () => {
    const input: KnowledgeRetrievalInput = { userId: 'user-1', queryText: 'query' };
    const retrievalService = { retrieve: jest.fn().mockResolvedValue(retrieval) };
    const knowledgeRepository: Pick<KnowledgeRepositoryPort, 'getSourceRecord'> = {
      getSourceRecord: jest.fn().mockResolvedValue(source),
    };

    const result = await new KnowledgeEvidenceService(
      retrievalService,
      knowledgeRepository,
      new EvidenceAssemblyService(),
    ).retrieve(input);

    expect(result).toEqual(expect.objectContaining({ selectedVersionIds: ['version-1'] }));
    expect(retrievalService.retrieve).toHaveBeenCalledWith(input);
    expect(knowledgeRepository.getSourceRecord).toHaveBeenCalledWith('user-1', 'source-1');
    expect(result.items[0].sourceIdentity).toEqual(source);
  });

  it('preserves empty evidence when every candidate was excluded by the threshold', async () => {
    const input: KnowledgeRetrievalInput = { userId: 'user-1', queryText: 'query' };
    const retrievalService = {
      retrieve: jest.fn().mockResolvedValue({
        ...retrieval,
        status: 'empty',
        items: [],
        diagnostics: [{ code: 'threshold-excluded' }],
      } satisfies RetrievalResult),
    };
    const knowledgeRepository: Pick<KnowledgeRepositoryPort, 'getSourceRecord'> = {
      getSourceRecord: jest.fn(),
    };

    const result = await new KnowledgeEvidenceService(
      retrievalService,
      knowledgeRepository,
      new EvidenceAssemblyService(),
    ).retrieve(input);

    expect(result.status).toBe('empty');
    expect(result.diagnostics).toEqual([{ code: 'threshold-excluded' }]);
  });

  it('preserves empty evidence when the selected scope has no compatible profile', async () => {
    const input: KnowledgeRetrievalInput = { userId: 'user-1', queryText: 'query' };
    const retrievalService = {
      retrieve: jest.fn().mockResolvedValue({
        ...retrieval,
        status: 'empty',
        items: [],
        diagnostics: [{ code: 'profile-unavailable', documentVersionId: 'version-1' }],
      } satisfies RetrievalResult),
    };
    const knowledgeRepository: Pick<KnowledgeRepositoryPort, 'getSourceRecord'> = {
      getSourceRecord: jest.fn(),
    };

    const result = await new KnowledgeEvidenceService(
      retrievalService,
      knowledgeRepository,
      new EvidenceAssemblyService(),
    ).retrieve(input);

    expect(result.status).toBe('empty');
    expect(result.diagnostics).toEqual([
      { code: 'profile-unavailable', documentVersionId: 'version-1' },
    ]);
  });
});
