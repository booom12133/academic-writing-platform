import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DocumentInputError } from './document-input.errors';
import { DocumentInputService } from './document-input.service';
import type { DocumentStoragePort } from './document-input.storage';
import type { DocumentInputProvider, DocumentInputRef } from '@shared/document-input.interface';
import { SelfHostedFilesystemDocumentStorageAdapter } from './filesystem-document-storage.adapter';

const bytes = Buffer.from('## Title\n\nEvidence.');
const sha256 = (value: Buffer): string => createHash('sha256').update(value).digest('hex');

const ref = (overrides: Partial<DocumentInputRef> = {}): DocumentInputRef => ({
  version: 1,
  provider: 'platform-file',
  bucketId: 'bucket-1',
  filePath: 'academic-writing/users/user-scope/550e8400-e29b-41d4-a716-446655440000/paper.md',
  fileName: 'paper.md',
  sourceType: 'markdown',
  mimeType: 'text/markdown',
  sizeBytes: bytes.length,
  sha256: sha256(bytes),
  ...overrides,
});

const makeStorage = (stored: Buffer | null = bytes): DocumentStoragePort & {
  upload: jest.Mock;
  download: jest.Mock;
  remove: jest.Mock;
} => ({
  getProvider: jest.fn().mockReturnValue('platform-file'),
  getDefaultBucketId: jest.fn().mockResolvedValue('bucket-1'),
  upload: jest.fn().mockResolvedValue(undefined),
  download: jest.fn().mockResolvedValue(stored),
  remove: jest.fn().mockResolvedValue(undefined),
});

const parsed = {
  source: {
    type: 'markdown' as const,
    fileName: 'paper.md',
    extension: '.md' as const,
    mimeType: 'text/markdown',
    sizeBytes: bytes.length,
  },
  title: 'Title',
  blocks: [{ id: 'b000001', type: 'paragraph' as const, text: 'Evidence.' }],
  outline: [],
  plainText: 'Evidence.',
  metadata: {},
  warnings: [],
};

const context = {
  version: 1 as const,
  task: { type: 'polish' as const, userInstructions: 'Keep facts.' },
  source: {
    id: 'document-1' as const,
    kind: 'parsed-document' as const,
    fileName: 'paper.md',
    sourceType: 'markdown' as const,
    extension: '.md' as const,
    mimeType: 'text/markdown',
    sizeBytes: bytes.length,
    title: 'Title',
    metadata: {},
    warnings: [],
  },
  units: [{
    id: 'document-1:b000001',
    sourceId: 'document-1' as const,
    sourceBlockId: 'b000001',
    sourceBlockIndex: 0,
    section: 'content' as const,
    headingPath: [],
    block: { id: 'b000001', type: 'paragraph' as const, text: 'Evidence.' },
  }],
};

const chunked = {
  version: 1 as const,
  task: context.task,
  source: context.source,
  policy: {
    version: 1 as const,
    maxSize: 100,
    sizeMetric: 'unicode-code-points' as const,
    overlap: 0 as const,
  },
  chunks: [],
  warnings: [],
};

const buildService = <T extends DocumentStoragePort>(storage: T) => {
  const parser = { parse: jest.fn().mockResolvedValue(parsed) };
  const builder = { build: jest.fn().mockReturnValue(context) };
  const chunker = { chunk: jest.fn().mockReturnValue(chunked) };
  const service = new DocumentInputService(storage, parser as never, builder as never, chunker as never);
  return { service, storage, parser, builder, chunker };
};

const makeService = (storage: ReturnType<typeof makeStorage> = makeStorage()) =>
  buildService(storage);

describe('DocumentInputService', () => {
  it('uses the storage provider when creating a descriptor', async () => {
    const storage = makeStorage();
    (storage.getProvider as jest.Mock).mockReturnValue('self-hosted-filesystem' satisfies DocumentInputProvider);
    const { service } = makeService(storage);

    await expect(service.upload('user-1', {
      buffer: bytes,
      originalname: 'paper.md',
      mimetype: 'text/markdown',
    })).resolves.toMatchObject({
      document: { provider: 'self-hosted-filesystem' },
    });
  });

  it('prepares a ref created by the filesystem adapter through C1, C2, and C3', async () => {
    const root = await mkdtemp(join(tmpdir(), 'academic-writing-c4-service-'));
    try {
      const storage = new SelfHostedFilesystemDocumentStorageAdapter(root);
      const { service, parser, builder, chunker } = buildService(storage);
      const descriptor = await service.upload('user-1', {
        buffer: bytes,
        originalname: 'paper.md',
        mimetype: 'text/markdown',
      });

      await expect(service.prepare({
        userId: 'user-1',
        documentRef: descriptor.document,
        taskType: 'polish',
        chunkingPolicy: { maxSize: 100 },
      })).resolves.toMatchObject({ document: { provider: 'self-hosted-filesystem' } });
      expect(parser.parse).toHaveBeenCalledTimes(2);
      expect(builder.build).toHaveBeenCalledTimes(1);
      expect(chunker.chunk).toHaveBeenCalledTimes(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('reads and verifies a stored artifact without entering a tool pipeline', async () => {
    const trustedRef = ref({
      filePath: 'academic-writing/users/' + sha256(Buffer.from('user-1')) + '/550e8400-e29b-41d4-a716-446655440000/paper.md',
    });
    const { service, parser, storage } = makeService();

    await expect(service.readVerified('user-1', trustedRef)).resolves.toEqual({
      version: 1,
      document: trustedRef,
      buffer: bytes,
    });
    expect(parser.parse).not.toHaveBeenCalled();
    expect(storage.download).toHaveBeenCalledTimes(1);
  });

  it('persists only after parsing and returns a descriptor without document content', async () => {
    const { service, storage, parser } = makeService();
    const result = await service.upload('user-1', {
      buffer: bytes,
      originalname: 'paper.md',
      mimetype: 'text/markdown',
    });

    expect(parser.parse).toHaveBeenCalled();
    expect(storage.upload.mock.invocationCallOrder[0])
      .toBeGreaterThan(parser.parse.mock.invocationCallOrder[0]);
    expect(result).toMatchObject({
      document: {
        version: 1,
        provider: 'platform-file',
        fileName: 'paper.md',
        sourceType: 'markdown',
        sizeBytes: bytes.length,
        sha256: sha256(bytes),
      },
      summary: { title: 'Title', blockCount: 1, warningCount: 0 },
    });
    expect(JSON.stringify(result)).not.toContain('Evidence.');
  });

  it('rejects malformed documents before storage persistence', async () => {
    const storage = makeStorage();
    const { service, parser } = makeService(storage);
    parser.parse.mockRejectedValue(new Error('malformed'));

    await expect(service.upload('user-1', {
      buffer: bytes,
      originalname: 'paper.md',
      mimetype: 'text/markdown',
    })).rejects.toMatchObject({ code: 'INVALID_DOCUMENT_UPLOAD' });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('best-effort removes an object when storage reports partial persistence', async () => {
    const storage = makeStorage();
    storage.upload.mockImplementationOnce(async (input: { bucketId: string; filePath: string }) => {
      storage.remove.mockResolvedValueOnce(undefined);
      throw new Error(`partial ${input.filePath}`);
    });
    const { service } = makeService(storage);

    await expect(service.upload('user-1', {
      buffer: bytes,
      originalname: 'paper.md',
      mimetype: 'text/markdown',
    })).rejects.toMatchObject({ code: 'DOCUMENT_STORAGE_FAILED' });
    expect(storage.remove).toHaveBeenCalledTimes(1);
  });

  it('removes an owned canonical artifact through the provider-neutral compensation seam', async () => {
    const storage = makeStorage();
    const { service } = makeService(storage);
    const owned = ref({
      filePath: 'academic-writing/users/' + sha256(Buffer.from('user-1')) + '/550e8400-e29b-41d4-a716-446655440000/paper.md',
    });

    await expect(service.removeOwned('user-1', owned)).resolves.toBeUndefined();
    expect(storage.remove).toHaveBeenCalledWith({ bucketId: 'bucket-1', filePath: owned.filePath });
  });

  it('rejects another user or noncanonical document refs without deleting storage', async () => {
    const storage = makeStorage();
    const { service } = makeService(storage);
    const owned = ref({
      filePath: 'academic-writing/users/' + sha256(Buffer.from('user-1')) + '/550e8400-e29b-41d4-a716-446655440000/paper.md',
    });

    await expect(service.removeOwned('user-2', owned)).rejects.toMatchObject({ code: 'DOCUMENT_OWNERSHIP_MISMATCH' });
    await expect(service.removeOwned('user-1', { ...owned, filePath: 'arbitrary/path.pdf' })).rejects.toMatchObject({ code: 'DOCUMENT_OWNERSHIP_MISMATCH' });
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('rejects a ref whose path belongs to another user before download', async () => {
    const storage = makeStorage();
    const { service } = makeService(storage);

    await expect(service.prepare({
      userId: 'user-2',
      documentRef: ref(),
      taskType: 'polish',
      chunkingPolicy: { maxSize: 100 },
    })).rejects.toMatchObject({ code: 'DOCUMENT_OWNERSHIP_MISMATCH' });
    expect(storage.getDefaultBucketId).not.toHaveBeenCalled();
    expect(storage.download).not.toHaveBeenCalled();
  });

  it('rejects altered stored bytes before C1 parsing', async () => {
    const storage = makeStorage(Buffer.from('altered'));
    const { service, parser } = makeService(storage);
    const trustedRef = ref({
      filePath: 'academic-writing/users/' + sha256(Buffer.from('user-1')) + '/550e8400-e29b-41d4-a716-446655440000/paper.md',
    });

    await expect(service.prepare({
      userId: 'user-1',
      documentRef: trustedRef,
      taskType: 'polish',
      chunkingPolicy: { maxSize: 100 },
    })).rejects.toMatchObject({ code: 'DOCUMENT_INTEGRITY_MISMATCH' });
    expect(parser.parse).not.toHaveBeenCalled();
  });

  it('passes trusted path-derived metadata through C1, C2, and C3', async () => {
    const trustedRef = ref({
      filePath: 'academic-writing/users/' + sha256(Buffer.from('user-1')) + '/550e8400-e29b-41d4-a716-446655440000/paper.md',
    });
    const { service, parser, builder, chunker, storage } = makeService();

    const result = await service.prepare({
      userId: 'user-1',
      documentRef: trustedRef,
      taskType: 'polish',
      userInstructions: 'Keep facts.',
      chunkingPolicy: { maxSize: 100 },
    });

    expect(parser.parse).toHaveBeenCalledWith(expect.objectContaining({
      buffer: bytes,
      fileName: 'paper.md',
    }));
    expect(builder.build).toHaveBeenCalledWith({
      taskType: 'polish',
      document: parsed,
      userInstructions: 'Keep facts.',
    });
    expect(chunker.chunk).toHaveBeenCalledWith({
      context,
      policy: { maxSize: 100 },
    });
    expect(result.context).toBe(chunked);
    expect(result.document).toEqual(trustedRef);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it.each([
    ['sourceType', { sourceType: 'pdf' as const }],
    ['fileName', { fileName: 'other.md' }],
    ['mimeType', { mimeType: 'application/pdf' }],
    ['sizeBytes', { sizeBytes: bytes.length + 1 }],
  ])('rejects inconsistent untrusted ref field: %s', async (_field, override) => {
    const { service } = makeService();
    const trustedRef = ref({
      filePath: 'academic-writing/users/' + sha256(Buffer.from('user-1')) + '/550e8400-e29b-41d4-a716-446655440000/paper.md',
      ...override,
    });

    await expect(service.prepare({
      userId: 'user-1',
      documentRef: trustedRef,
      taskType: 'polish',
      chunkingPolicy: { maxSize: 100 },
    })).rejects.toBeInstanceOf(DocumentInputError);
  });

  it.each([
    ['version', { version: 2 as unknown as 1 }],
    ['provider', { provider: 'other-provider' as unknown as 'platform-file' }],
    ['path grammar', { filePath: 'academic-writing/invalid/path' }],
  ])('rejects untrusted ref field: %s', async (_field, override) => {
    const { service } = makeService();
    const trustedRef = ref({
      filePath: 'academic-writing/users/' + sha256(Buffer.from('user-1')) + '/550e8400-e29b-41d4-a716-446655440000/paper.md',
      ...override,
    });

    await expect(service.prepare({
      userId: 'user-1',
      documentRef: trustedRef,
      taskType: 'polish',
      chunkingPolicy: { maxSize: 100 },
    })).rejects.toBeInstanceOf(DocumentInputError);
  });

  it('maps a missing stored object without invoking C1', async () => {
    const storage = makeStorage();
    storage.download.mockResolvedValue(null);
    const { service, parser } = makeService(storage);
    const trustedRef = ref({
      filePath: 'academic-writing/users/' + sha256(Buffer.from('user-1')) + '/550e8400-e29b-41d4-a716-446655440000/paper.md',
    });

    await expect(service.prepare({
      userId: 'user-1',
      documentRef: trustedRef,
      taskType: 'polish',
      chunkingPolicy: { maxSize: 100 },
    })).rejects.toMatchObject({ code: 'DOCUMENT_NOT_FOUND' });
    expect(parser.parse).not.toHaveBeenCalled();
  });

  it.each([
    ['raw backslash', 'paper\\evil.docx'],
    ['encoded slash uppercase', 'paper%2Fother.docx'],
    ['encoded slash lowercase', 'paper%2fother.docx'],
    ['encoded backslash uppercase', 'paper%5Cother.docx'],
    ['encoded backslash lowercase', 'paper%5cother.docx'],
  ])('rejects non-canonical storage basename before download: %s', async (_case, basename) => {
    const storage = makeStorage();
    const { service } = makeService(storage);
    const untrustedRef = ref({
      filePath: 'academic-writing/users/' + sha256(Buffer.from('user-1')) + '/550e8400-e29b-41d4-a716-446655440000/' + basename,
      fileName: basename,
      sourceType: 'docx',
      mimeType: 'application/octet-stream',
    });

    await expect(service.prepare({
      userId: 'user-1',
      documentRef: untrustedRef,
      taskType: 'polish',
      chunkingPolicy: { maxSize: 100 },
    })).rejects.toBeInstanceOf(DocumentInputError);
    expect(storage.download).not.toHaveBeenCalled();
  });
});
