import { KnowledgeService } from './knowledge.service';
import { KnowledgeRepository } from './knowledge.repository';
import { createLocalDevelopmentDatabase } from '../../database/local-development.database';
import type { Chunk } from '../chunking/chunking.types';
import type { ParsedDocument } from '../document-parsing/document-parser.types';
import type { StructuralDocumentContext } from '../context-builder/context-builder.types';
import type { StructuralChunkedDocument } from '../chunking/chunking.types';
import type { KnowledgeChunk, KnowledgeDocument, KnowledgeDocumentVersion } from './knowledge.types';

const parsed: ParsedDocument = {
  source: { type: 'txt', fileName: 'input.txt', extension: '.txt', sizeBytes: 8 },
  blocks: [{ id: 'b1', type: 'paragraph', text: '😀 text' }],
  outline: [],
  plainText: '😀 text',
  metadata: {},
  warnings: [],
};

const structural: StructuralDocumentContext = {
  version: 1,
  source: {
    id: 'document-1', kind: 'parsed-document', fileName: 'input.txt', sourceType: 'txt', extension: '.txt', sizeBytes: 8, metadata: {}, warnings: [],
  },
  units: [{
    id: 'document-1:b000001', sourceId: 'document-1', sourceBlockId: 'b1', sourceBlockIndex: 0,
    section: 'content', headingPath: [], block: { id: 'b1', type: 'paragraph', text: '😀 text' },
  }],
};

const chunks: Chunk[] = [{
  id: 'document-1:c000001', sourceId: 'document-1', section: 'content', size: 6,
  items: [{ kind: 'whole-unit', unit: structural.units[0], size: 6 }],
}];

const chunked: StructuralChunkedDocument = {
  version: 1, source: structural.source, policy: { version: 1, maxSize: 100, sizeMetric: 'unicode-code-points', overlap: 0 }, chunks, warnings: [],
};

function repositoryMock() {
  const document: KnowledgeDocument = { id: 'doc-1', userId: 'user-1', originKind: 'user-upload', displayName: 'Input', sourceType: 'txt', lifecycleStatus: 'active' };
  const version: KnowledgeDocumentVersion = { id: 'version-1', userId: 'user-1', documentId: 'doc-1', versionNumber: 1, originalContentHash: 'hash', parserProfile: { name: 'c1-document-parser-v1', version: '1' }, chunkingProfile: { name: 'c3-deterministic-v1', version: '1', parameters: { maxSize: 100 } }, sourceText: '😀 text', lifecycleStatus: 'active', readinessStatus: 'content-ready-for-indexing', indexInputFingerprint: 'fingerprint', createdAt: new Date().toISOString() };
  const chunk: KnowledgeChunk = { id: 'chunk-1', userId: 'user-1', documentVersionId: 'version-1', ordinal: 0, text: '😀 text', textHash: 'chunk-hash', provenance: { documentId: 'doc-1', documentVersionId: 'version-1', sourceBlockId: 'b1', sourceBlockIndex: 0, section: 'content', headingPath: [], sourceUnitId: 'document-1:b000001', sourceChunkOrdinal: 0, itemOrdinal: 0 }, citationLocator: { documentVersionId: 'version-1', chunkId: 'chunk-1', section: 'content', sourceBlockId: 'b1', sourceBlockIndex: 0 } };
  return {
    findImport: jest.fn().mockResolvedValue(null),
    createImportMarker: jest.fn().mockResolvedValue('import-1'),
    createDocument: jest.fn().mockResolvedValue(document),
    createVersion: jest.fn().mockResolvedValue(version),
    createChunks: jest.fn().mockResolvedValue([chunk]),
    activateVersion: jest.fn().mockResolvedValue(undefined),
    completeImport: jest.fn().mockResolvedValue(undefined),
    createSourceRecord: jest.fn(),
    createExternalLinks: jest.fn(),
    getSourceRecord: jest.fn().mockResolvedValue(null),
    getDocument: jest.fn().mockResolvedValue(document),
    getVersion: jest.fn().mockResolvedValue(version),
    getChunks: jest.fn().mockResolvedValue([chunk]),
    getLatestVersion: jest.fn().mockResolvedValue(version),
    tombstoneDocument: jest.fn(),
    document, version, chunk,
  };
}

describe('KnowledgeService', () => {
  it('imports exact text through the neutral C2/C3 boundaries and marks readiness', async () => {
    const repository = repositoryMock();
    const parser = { parse: jest.fn().mockResolvedValue(parsed) };
    const contextBuilder = { build: jest.fn(), buildStructural: jest.fn().mockReturnValue(structural) };
    const chunker = { chunk: jest.fn(), chunkStructural: jest.fn().mockReturnValue(chunked) };
    const documentInput = { readVerified: jest.fn() };
    const service = new KnowledgeService(repository, parser, contextBuilder, chunker, documentInput);

    const result = await service.importDocument({
      userId: 'user-1', idempotencyKey: 'import-1', displayName: 'Input', originKind: 'user-upload',
      input: { kind: 'text', text: '😀 text', fileName: 'unsafe/ignored.txt' }, chunkingPolicy: { maxSize: 100 },
    });

    expect(parser.parse).toHaveBeenCalledWith(expect.objectContaining({ buffer: Buffer.from('😀 text', 'utf8'), fileName: 'ignored.txt' }));
    expect(contextBuilder.buildStructural).toHaveBeenCalledWith(parsed);
    expect(contextBuilder.build).not.toHaveBeenCalled();
    expect(chunker.chunkStructural).toHaveBeenCalledWith({ context: structural, policy: { maxSize: 100 } });
    expect(chunker.chunk).not.toHaveBeenCalled();
    expect(repository.createVersion).toHaveBeenCalledWith(expect.objectContaining({ sourceText: '😀 text', readinessStatus: 'content-ready-for-indexing' }));
    expect(repository.completeImport).toHaveBeenCalledWith('user-1', 'import-1', 'doc-1', 'version-1');
    expect(result.readiness).toBe('content-ready-for-indexing');
  });

  it('re-reads stored files through C4 and persists the verified artifact reference', async () => {
    const repository = repositoryMock();
    const parser = { parse: jest.fn().mockResolvedValue(parsed) };
    const contextBuilder = { build: jest.fn(), buildStructural: jest.fn().mockReturnValue(structural) };
    const chunker = { chunk: jest.fn(), chunkStructural: jest.fn().mockReturnValue(chunked) };
    const ref = { version: 1 as const, provider: 'self-hosted-filesystem' as const, bucketId: 'documents', filePath: 'academic-writing/users/a/1/file.txt', fileName: 'file.txt', sourceType: 'txt' as const, sizeBytes: 6, sha256: 'a'.repeat(64) };
    const documentInput = { readVerified: jest.fn().mockResolvedValue({ version: 1, buffer: Buffer.from('stored'), document: ref }) };
    const service = new KnowledgeService(repository, parser, contextBuilder, chunker, documentInput);

    await service.importDocument({ userId: 'user-1', idempotencyKey: 'stored-1', displayName: 'Stored', originKind: 'user-upload', input: { kind: 'stored-file', documentRef: ref }, chunkingPolicy: { maxSize: 100 } });
    expect(documentInput.readVerified).toHaveBeenCalledWith('user-1', ref);
    expect(repository.createVersion).toHaveBeenCalledWith(expect.objectContaining({ sourceArtifactRef: ref }));
  });

  it('creates an immutable next version and preserves the supersedes link', async () => {
    const repository = repositoryMock();
    const parser = { parse: jest.fn().mockResolvedValue(parsed) };
    const contextBuilder = { buildStructural: jest.fn().mockReturnValue(structural) };
    const chunker = { chunkStructural: jest.fn().mockReturnValue(chunked) };
    const service = new KnowledgeService(repository, parser, contextBuilder, chunker, { readVerified: jest.fn() });

    await service.createNextVersion({
      userId: 'user-1', documentId: 'doc-1', idempotencyKey: 'v2', displayName: 'Input', originKind: 'user-upload',
      input: { kind: 'text', text: '😀 text', fileName: 'input.txt' }, chunkingPolicy: { maxSize: 100 },
    });

    expect(repository.createVersion).toHaveBeenCalledWith(expect.objectContaining({ versionNumber: 2, supersedesVersionId: 'version-1', lifecycleStatus: 'active' }));
    expect(repository.activateVersion).toHaveBeenCalledWith('user-1', 'doc-1', 'version-1');
  });

  it('uses the real repository transaction for an all-or-nothing text import', async () => {
    const local = await createLocalDevelopmentDatabase();
    try {
      const parser = { parse: jest.fn().mockResolvedValue(parsed) };
      const contextBuilder = { buildStructural: jest.fn().mockReturnValue(structural) };
      const chunker = { chunkStructural: jest.fn().mockReturnValue(chunked) };
      const service = new KnowledgeService(new KnowledgeRepository(local.db), parser, contextBuilder, chunker, { readVerified: jest.fn() });
      const result = await service.importDocument({
        userId: 'user-1', idempotencyKey: 'real-1', displayName: 'Input', originKind: 'user-upload',
        input: { kind: 'text', text: '😀 text', fileName: 'input.txt' }, chunkingPolicy: { maxSize: 100 },
      });

      expect(result.version.readinessStatus).toBe('content-ready-for-indexing');
      await expect(new KnowledgeRepository(local.db).getDocument('user-1', result.document.id)).resolves.toMatchObject({ activeVersionId: result.version.id });
      await expect(new KnowledgeRepository(local.db).getChunks('user-1', result.version.id)).resolves.toHaveLength(1);
    } finally {
      await local.close();
    }
  });
});
