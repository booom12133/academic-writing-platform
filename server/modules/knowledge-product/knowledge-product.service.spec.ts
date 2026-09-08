import { DocumentInputError } from '../document-input/document-input.errors';
import { KnowledgeError } from '../knowledge/knowledge.errors';
import type { DocumentInputRef } from '@shared/document-input.interface';
import type {
  KnowledgeDocument,
  KnowledgeDocumentVersion,
  SourceRecord,
} from '../knowledge/knowledge.types';
import { KnowledgeProductService } from './knowledge-product.service';

const ownerId = 'user-1';
const sourceRecordId = '00000000-0000-4000-8000-000000000001';
const documentRef: DocumentInputRef = {
  version: 1,
  provider: 'self-hosted-filesystem',
  bucketId: 'documents',
  filePath: `academic-writing/users/${'a'.repeat(64)}/00000000-0000-4000-8000-000000000002/paper.pdf`,
  fileName: 'paper.pdf',
  sourceType: 'pdf',
  mimeType: 'application/pdf',
  sizeBytes: 128,
  sha256: 'b'.repeat(64),
};
const reconstructedDocumentRef: DocumentInputRef = {
  version: documentRef.version,
  provider: documentRef.provider,
  bucketId: documentRef.bucketId,
  filePath: documentRef.filePath,
  fileName: documentRef.fileName,
  sourceType: documentRef.sourceType,
  sizeBytes: documentRef.sizeBytes,
  sha256: documentRef.sha256,
};

function document(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    id: '00000000-0000-4000-8000-000000000010',
    userId: ownerId,
    originKind: 'user-upload',
    displayName: 'Paper',
    sourceType: 'pdf',
    activeVersionId: '00000000-0000-4000-8000-000000000020',
    lifecycleStatus: 'active',
    createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: '2026-09-08T00:00:00.000Z',
    ...overrides,
  };
}

function version(
  target: KnowledgeDocument,
  overrides: Partial<KnowledgeDocumentVersion> = {},
): KnowledgeDocumentVersion {
  return {
    id: target.activeVersionId!,
    userId: target.userId,
    documentId: target.id,
    versionNumber: 1,
    originalContentHash: documentRef.sha256,
    parserProfile: { name: 'c1-document-parser-v1', version: '1' },
    chunkingProfile: {
      name: 'c3-deterministic-v1',
      version: '1',
      parameters: { maxSize: 2_000 },
    },
    sourceArtifactRef: {
      version: 1,
      provider: documentRef.provider,
      bucketId: documentRef.bucketId,
      filePath: documentRef.filePath,
      fileName: documentRef.fileName,
      sha256: documentRef.sha256,
      sizeBytes: documentRef.sizeBytes,
    },
    lifecycleStatus: 'active',
    readinessStatus: 'content-ready-for-indexing',
    indexInputFingerprint: 'c'.repeat(64),
    createdAt: '2026-09-08T00:00:00.000Z',
    ...overrides,
  };
}

function serviceFixture() {
  const storedDocument = document();
  const storedVersion = version(storedDocument);
  const textDocument = document({
    id: '00000000-0000-4000-8000-000000000011',
    displayName: 'Notes',
    sourceType: 'txt',
    activeVersionId: '00000000-0000-4000-8000-000000000021',
  });
  const textVersion = version(textDocument, {
    sourceArtifactRef: undefined,
    sourceText: 'Only text',
  });
  const leakedDocument = document({
    id: '00000000-0000-4000-8000-000000000012',
    userId: 'user-2',
    activeVersionId: '00000000-0000-4000-8000-000000000022',
  });
  const versions = new Map([
    [storedVersion.id, storedVersion],
    [textVersion.id, textVersion],
  ]);
  const repository = {
    listDocuments: jest.fn().mockResolvedValue([
      storedDocument,
      textDocument,
      leakedDocument,
    ]),
    getDocument: jest.fn().mockImplementation(async (userId: string, id: string) =>
      userId === ownerId && id === storedDocument.id ? storedDocument : null),
    getVersion: jest.fn().mockImplementation(async (userId: string, id: string) =>
      userId === ownerId ? versions.get(id) ?? null : null),
    getSourceRecord: jest.fn().mockResolvedValue(null),
  };
  const knowledge = {
    importDocument: jest.fn().mockResolvedValue({
      document: storedDocument,
      version: storedVersion,
      chunks: [],
      idempotent: false,
      readiness: 'content-ready-for-indexing',
    }),
    tombstoneDocument: jest.fn().mockResolvedValue(undefined),
  };
  const documentInput = {
    validateOwnedRef: jest.fn().mockResolvedValue(documentRef),
  };
  const indexing = {
    getIndexStatus: jest.fn().mockResolvedValue(null),
    indexActiveVersion: jest.fn(),
    retryIndex: jest.fn(),
  };
  const service = new KnowledgeProductService(
    repository as never,
    knowledge as never,
    documentInput as never,
    indexing as never,
  );
  return {
    service,
    repository,
    knowledge,
    documentInput,
    indexing,
    storedDocument,
    storedVersion,
  };
}

describe('KnowledgeProductService', () => {
  it('lists only owner documents and reconstructs refs only for stored artifacts', async () => {
    const { service, repository, storedDocument } = serviceFixture();

    const result = await service.listDocuments(ownerId);

    expect(repository.listDocuments).toHaveBeenCalledWith(ownerId);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(expect.objectContaining({
      document: storedDocument,
      activeVersion: expect.objectContaining({ id: storedDocument.activeVersionId }),
      documentRef: reconstructedDocumentRef,
    }));
    expect(result[1]).not.toHaveProperty('documentRef');
    expect(result.some((item) => item.document.userId === 'user-2')).toBe(false);
  });

  it('gets a document only through the authenticated owner scope', async () => {
    const { service, repository, storedDocument } = serviceFixture();

    await expect(service.getDocument(ownerId, storedDocument.id)).resolves.toEqual(
      expect.objectContaining({ documentRef: reconstructedDocumentRef }),
    );
    await expect(service.getDocument('user-2', storedDocument.id)).rejects.toMatchObject({
      code: 'KNOWLEDGE_PRODUCT_NOT_FOUND',
      httpStatus: 404,
    });
    expect(repository.getDocument).toHaveBeenLastCalledWith('user-2', storedDocument.id);
  });

  it.each([
    ['missing idempotency key', { displayName: 'Paper', documentRef }],
    ['invalid ref', { idempotencyKey: 'key-1', displayName: 'Paper', documentRef: { ...documentRef, version: 2 } }],
    ['unsupported source type', { idempotencyKey: 'key-1', displayName: 'Paper', documentRef: { ...documentRef, sourceType: 'doc' } }],
  ])('rejects %s before importing', async (_case, request) => {
    const { service, knowledge, documentInput } = serviceFixture();

    await expect(service.importDocument(ownerId, request)).rejects.toMatchObject({
      code: 'KNOWLEDGE_PRODUCT_INVALID_REQUEST',
      httpStatus: 400,
    });
    expect(documentInput.validateOwnedRef).not.toHaveBeenCalled();
    expect(knowledge.importDocument).not.toHaveBeenCalled();
  });

  it('rejects a mismatched document owner before importing', async () => {
    const { service, knowledge, documentInput } = serviceFixture();
    documentInput.validateOwnedRef.mockRejectedValueOnce(
      new DocumentInputError(
        'DOCUMENT_OWNERSHIP_MISMATCH',
        'The document does not belong to the current user.',
      ),
    );

    await expect(service.importDocument(ownerId, {
      idempotencyKey: 'key-1',
      displayName: 'Paper',
      documentRef,
    })).rejects.toMatchObject({
      code: 'KNOWLEDGE_PRODUCT_FORBIDDEN',
      httpStatus: 403,
    });
    expect(knowledge.importDocument).not.toHaveBeenCalled();
  });

  it('rejects a source record outside the owner scope before importing', async () => {
    const { service, repository, knowledge } = serviceFixture();
    repository.getSourceRecord.mockResolvedValueOnce(null);

    await expect(service.importDocument(ownerId, {
      idempotencyKey: 'key-1',
      displayName: 'Paper',
      documentRef,
      sourceRecordId,
    })).rejects.toMatchObject({
      code: 'KNOWLEDGE_PRODUCT_NOT_FOUND',
      httpStatus: 404,
    });
    expect(repository.getSourceRecord).toHaveBeenCalledWith(ownerId, sourceRecordId);
    expect(knowledge.importDocument).not.toHaveBeenCalled();
  });

  it('imports a validated ref with the owner and default chunking policy', async () => {
    const { service, repository, knowledge, documentInput } = serviceFixture();
    repository.getSourceRecord.mockResolvedValueOnce({
      id: sourceRecordId,
      userId: ownerId,
      kind: 'user-declared',
      canonicalMetadata: {},
      externalProvenance: [],
      status: 'active',
      createdAt: '2026-09-08T00:00:00.000Z',
      updatedAt: '2026-09-08T00:00:00.000Z',
    } satisfies SourceRecord);

    const result = await service.importDocument(ownerId, {
      idempotencyKey: 'key-1',
      displayName: '  Paper  ',
      documentRef,
      sourceRecordId,
    });

    expect(documentInput.validateOwnedRef).toHaveBeenCalledWith(ownerId, documentRef);
    expect(knowledge.importDocument).toHaveBeenCalledWith({
      userId: ownerId,
      idempotencyKey: 'key-1',
      displayName: 'Paper',
      originKind: 'user-upload',
      input: { kind: 'stored-file', documentRef },
      sourceRecordId,
      chunkingPolicy: { maxSize: 2_000 },
    });
    expect(result).toEqual(expect.objectContaining({
      documentRef: reconstructedDocumentRef,
    }));
    expect(result).not.toHaveProperty('index');
  });

  it('preserves the idempotency key on repeated product imports', async () => {
    const { service, knowledge } = serviceFixture();
    const request = { idempotencyKey: 'same-key', displayName: 'Paper', documentRef };

    await service.importDocument(ownerId, request);
    await service.importDocument(ownerId, request);

    expect(knowledge.importDocument).toHaveBeenCalledTimes(2);
    expect(knowledge.importDocument.mock.calls.map(([input]) => input.idempotencyKey))
      .toEqual(['same-key', 'same-key']);
  });

  it('maps an accepted Knowledge idempotency conflict to a stable product conflict', async () => {
    const { service, knowledge } = serviceFixture();
    knowledge.importDocument.mockRejectedValueOnce(
      new KnowledgeError(
        'KNOWLEDGE_IDEMPOTENCY_CONFLICT',
        'Idempotency key belongs to a different import.',
      ),
    );

    await expect(service.importDocument(ownerId, {
      idempotencyKey: 'reused-key',
      displayName: 'Paper',
      documentRef,
    })).rejects.toMatchObject({
      code: 'KNOWLEDGE_PRODUCT_IDEMPOTENCY_CONFLICT',
      httpStatus: 409,
    });
  });

  it('tombstones only an owner-scoped document', async () => {
    const { service, knowledge, storedDocument } = serviceFixture();

    await expect(service.deleteDocument(ownerId, storedDocument.id)).resolves.toEqual({
      documentId: storedDocument.id,
      status: 'tombstoned',
    });
    await expect(service.deleteDocument('user-2', storedDocument.id)).rejects.toMatchObject({
      code: 'KNOWLEDGE_PRODUCT_NOT_FOUND',
    });
    expect(knowledge.tombstoneDocument).toHaveBeenCalledTimes(1);
  });
});
