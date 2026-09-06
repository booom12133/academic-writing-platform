import type {
  CanonicalSourceMetadata,
  KnowledgeChunk,
  SourceRecord,
} from '../knowledge.types';
import type { RetrievalResult } from './knowledge-retrieval.service';
import { EvidenceAssemblyService } from './evidence-assembly';

function retrievedChunk(id: string, text: string): RetrievalResult['items'][number] {
  const versionId = 'version-1';
  const chunk: KnowledgeChunk = {
    id,
    userId: 'user-1',
    documentVersionId: versionId,
    ordinal: id === 'chunk-2' ? 1 : 0,
    text,
    textHash: 'a'.repeat(64),
    provenance: {
      sourceRecordId: 'source-1',
      documentId: 'document-1',
      documentVersionId: versionId,
      sourceBlockId: `block-${id}`,
      sourceBlockIndex: 0,
      section: 'content',
      headingPath: [],
      sourceUnitId: `unit-${id}`,
      sourceChunkOrdinal: 0,
      itemOrdinal: 0,
    },
    citationLocator: {
      documentVersionId: versionId,
      sourceRecordId: 'source-1',
      chunkId: id,
      section: 'content',
      sourceBlockId: `block-${id}`,
      sourceBlockIndex: 0,
    },
  };
  return {
    chunk,
    document: {
      id: 'document-1',
      userId: 'user-1',
      sourceRecordId: 'source-1',
      originKind: 'user-upload',
      displayName: 'Document',
      sourceType: 'txt',
      activeVersionId: versionId,
      lifecycleStatus: 'active',
    },
    version: {
      id: versionId,
      userId: 'user-1',
      documentId: 'document-1',
      versionNumber: 1,
      originalContentHash: 'b'.repeat(64),
      parserProfile: { name: 'c1-document-parser-v1', version: '1' },
      chunkingProfile: {
        name: 'c3-deterministic-v1',
        version: '1',
        parameters: { maxSize: 100 },
      },
      lifecycleStatus: 'active',
      readinessStatus: 'content-ready-for-indexing',
      indexInputFingerprint: 'c'.repeat(64),
      createdAt: '2026-09-06T00:00:00.000Z',
    },
    indexId: 'index-1',
    indexFingerprint: 'd'.repeat(64),
    embeddingProfileFingerprint: 'e'.repeat(64),
    embeddingModelIdentity: {
      provider: 'provider-a',
      model: 'model-a',
      modelRevision: 'revision-a',
      dimensions: 3,
    },
    rawDistance: id === 'chunk-2' ? 0.2 : 0.1,
    rank: id === 'chunk-2' ? 2 : 1,
    retrievalScore: id === 'chunk-2' ? 0.8 : 0.9,
  };
}

describe('EvidenceAssemblyService', () => {
  const source: SourceRecord = {
    id: 'source-1',
    userId: 'user-1',
    kind: 'scholarly-work',
    canonicalMetadata: {} as CanonicalSourceMetadata,
    externalProvenance: [],
    status: 'active',
    createdAt: '2026-09-06T00:00:00.000Z',
    updatedAt: '2026-09-06T00:00:00.000Z',
  };

  it('preserves original chunk identity, text, provenance, locator, and source identity', () => {
    const retrieval: RetrievalResult = {
      status: 'complete',
      selectedVersionIds: ['version-1'],
      items: [retrievedChunk('chunk-1', 'first'), retrievedChunk('chunk-2', 'second')],
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

    const result = new EvidenceAssemblyService().assemble(retrieval, new Map([[source.id, source]]));

    expect(result.status).toBe('complete');
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      evidenceId: 'chunk:chunk-1',
      knowledgeChunkId: 'chunk-1',
      text: 'first',
      provenance: retrieval.items[0].chunk.provenance,
      citationLocator: retrieval.items[0].chunk.citationLocator,
      sourceIdentity: source,
      retrievalScore: 0.9,
    });
    expect(result.items[0]).not.toHaveProperty('evidenceScore');
  });

  it('deduplicates only by chunk ID and does not merge or rewrite text', () => {
    const duplicate = retrievedChunk('chunk-1', 'first duplicate');
    const retrieval: RetrievalResult = {
      status: 'partial',
      selectedVersionIds: ['version-1'],
      items: [retrievedChunk('chunk-1', 'first'), duplicate, retrievedChunk('chunk-2', 'first')],
      diagnostics: [{ code: 'threshold-excluded' }],
      profile: {
        provider: 'provider-a',
        model: 'model-a',
        modelRevision: 'revision-a',
        dimensions: 3,
        embeddingProfileFingerprint: 'e'.repeat(64),
        distanceMetric: 'cosine',
      },
    };

    const result = new EvidenceAssemblyService().assemble(retrieval, new Map([[source.id, source]]));

    expect(result.items.map((item) => item.knowledgeChunkId)).toEqual(['chunk-1', 'chunk-2']);
    expect(result.items.map((item) => item.text)).toEqual(['first', 'first']);
    expect(result.diagnostics).toEqual([{ code: 'threshold-excluded' }]);
  });
});
