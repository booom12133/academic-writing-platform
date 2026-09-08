import type { KnowledgeDocument, KnowledgeDocumentVersion } from '../../server/modules/knowledge/knowledge.types';
import type { KnowledgeEmbeddingIndex } from '../../server/modules/knowledge/indexing/knowledge-indexing.types';
import { KnowledgeProductError } from '../../server/modules/knowledge-product/knowledge-product.errors';
import { KnowledgeProductIndexingService } from '../../server/modules/knowledge-product/knowledge-product.indexing';

const ownerId = 'owner-1';
const documentId = '00000000-0000-4000-8000-000000000010';
const versionId = '00000000-0000-4000-8000-000000000020';
const indexId = '00000000-0000-4000-8000-000000000030';

function makeDocument(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    id: documentId,
    userId: ownerId,
    originKind: 'user-upload',
    displayName: 'Paper',
    sourceType: 'pdf',
    activeVersionId: versionId,
    lifecycleStatus: 'active',
    ...overrides,
  };
}

function makeVersion(overrides: Partial<KnowledgeDocumentVersion> = {}): KnowledgeDocumentVersion {
  return {
    id: versionId,
    userId: ownerId,
    documentId,
    versionNumber: 1,
    originalContentHash: 'a'.repeat(64),
    parserProfile: { name: 'c1-document-parser-v1', version: '1' },
    chunkingProfile: { name: 'c3-deterministic-v1', version: '1', parameters: { maxSize: 2_000 } },
    sourceText: 'Paper content',
    lifecycleStatus: 'active',
    readinessStatus: 'content-ready-for-indexing',
    indexInputFingerprint: 'b'.repeat(64),
    createdAt: '2026-09-08T00:00:00.000Z',
    ...overrides,
  };
}

function makeIndex(status: KnowledgeEmbeddingIndex['status']): KnowledgeEmbeddingIndex {
  return {
    id: indexId,
    userId: ownerId,
    documentVersionId: versionId,
    e1IndexInputFingerprint: 'c'.repeat(64),
    embeddingProfileFingerprint: 'd'.repeat(64),
    indexFingerprint: 'e'.repeat(64),
    embeddingModelIdentity: {
      provider: 'test',
      model: 'test-v1',
      modelRevision: '1',
      dimensions: 2,
    },
    status,
    totalChunks: 2,
    indexedChunks: status === 'indexed' ? 2 : 0,
    failedChunks: status === 'failed' ? 1 : 0,
    attemptCount: 1,
    ...(status === 'failed' ? { lastErrorCode: 'provider' } : {}),
    createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: '2026-09-08T00:00:00.000Z',
  };
}

function fixture() {
  const document = makeDocument();
  const version = makeVersion();
  const repository = {
    getDocument: jest.fn().mockResolvedValue(document),
    getVersion: jest.fn().mockResolvedValue(version),
  };
  const indexRepository = {
    getLatestIndexForVersion: jest.fn().mockResolvedValue(null),
    getIndex: jest.fn().mockResolvedValue(null),
  };
  const indexing = {
    indexVersion: jest.fn().mockResolvedValue(makeIndex('indexed')),
    retryIndex: jest.fn().mockResolvedValue(makeIndex('indexed')),
  };
  const service = new KnowledgeProductIndexingService(
    repository as never,
    indexRepository as never,
    indexing as never,
  );
  return { service, repository, indexRepository, indexing, document, version };
}

describe('KnowledgeProductIndexingService', () => {
  it('indexes exactly once for an owned active version with no existing index', async () => {
    const { service, indexing } = fixture();

    await expect(service.indexActiveVersion(ownerId, documentId)).resolves.toMatchObject({
      id: indexId,
      status: 'indexed',
    });
    expect(indexing.indexVersion).toHaveBeenCalledTimes(1);
    expect(indexing.indexVersion).toHaveBeenCalledWith({
      userId: ownerId,
      documentVersionId: versionId,
    });
  });

  it.each([
    ['missing document', null, makeVersion(), 'KNOWLEDGE_PRODUCT_NOT_FOUND'],
    ['cross-user document', makeDocument({ userId: 'owner-2' }), makeVersion(), 'KNOWLEDGE_PRODUCT_NOT_FOUND'],
    ['missing active version', makeDocument({ activeVersionId: undefined }), null, 'KNOWLEDGE_PRODUCT_NO_ACTIVE_VERSION'],
  ] as const)('rejects %s before calling E2', async (_case, document, version, code) => {
    const { service, repository, indexing } = fixture();
    repository.getDocument.mockResolvedValueOnce(document);
    repository.getVersion.mockResolvedValueOnce(version);

    await expect(service.indexActiveVersion(ownerId, documentId)).rejects.toMatchObject({ code });
    expect(indexing.indexVersion).not.toHaveBeenCalled();
  });

  it('delegates current index validity to E2 even when a historical index exists', async () => {
    const { service, indexRepository, indexing } = fixture();
    const historical = makeIndex('stale');
    const current = makeIndex('indexed');
    indexRepository.getLatestIndexForVersion.mockResolvedValueOnce(historical);
    indexing.indexVersion.mockResolvedValueOnce(current);

    await expect(service.indexActiveVersion(ownerId, documentId)).resolves.toBe(current);
    expect(indexing.indexVersion).toHaveBeenCalledTimes(1);
    expect(indexing.indexVersion).toHaveBeenCalledWith({
      userId: ownerId,
      documentVersionId: versionId,
    });
  });

  it('returns the indexed materialization returned by E2 without product-level idempotency checks', async () => {
    const { service, indexRepository, indexing } = fixture();
    const existing = makeIndex('indexed');
    indexing.indexVersion.mockResolvedValueOnce(existing);

    await expect(service.indexActiveVersion(ownerId, documentId)).resolves.toBe(existing);
    expect(indexing.indexVersion).toHaveBeenCalledTimes(1);
    expect(indexRepository.getLatestIndexForVersion).not.toHaveBeenCalled();
  });

  it.each(['failed', 'stale'] as const)('delegates %s retry to the accepted E2 retry contract', async (status) => {
    const { service, indexRepository, indexing } = fixture();
    const existing = makeIndex(status);
    indexRepository.getIndex.mockResolvedValueOnce(existing);
    indexing.retryIndex.mockResolvedValueOnce(existing);

    await expect(service.retryIndex(ownerId, indexId)).resolves.toBe(existing);
    expect(indexing.retryIndex).toHaveBeenCalledTimes(1);
    expect(indexing.retryIndex).toHaveBeenCalledWith({ userId: ownerId, indexId });
  });

  it('rejects an index outside the authenticated owner scope', async () => {
    const { service, indexRepository, indexing } = fixture();
    indexRepository.getIndex.mockResolvedValueOnce(null);

    await expect(service.retryIndex(ownerId, indexId)).rejects.toMatchObject({
      code: 'KNOWLEDGE_PRODUCT_INDEX_NOT_FOUND',
      httpStatus: 404,
    });
    expect(indexing.retryIndex).not.toHaveBeenCalled();
  });

  it('rejects indexed and indexing states instead of forcing retry', async () => {
    for (const status of ['indexed', 'indexing'] as const) {
      const { service, indexRepository, indexing } = fixture();
      indexRepository.getIndex.mockResolvedValueOnce(makeIndex(status));

      await expect(service.retryIndex(ownerId, indexId)).rejects.toBeInstanceOf(KnowledgeProductError);
      expect(indexing.retryIndex).not.toHaveBeenCalled();
    }
  });
});
