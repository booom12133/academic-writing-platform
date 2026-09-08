jest.mock('../../client/src/api/http', () => ({
  productHttpClient: {
    delete: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import { productHttpClient } from '../../client/src/api/http';
import {
  deleteDocument,
  getDocument,
  importDocument,
  listDocuments,
} from '../../client/src/api/knowledge';
import type { DocumentInputDescriptor } from '@shared/document-input.interface';
import type { KnowledgeWorkspaceDocument } from '@shared/knowledge-product.interface';
import {
  initialDocumentWorkspaceState,
  reduceDocumentWorkspaceState,
  runDocumentUploadFlow,
  toWorkspaceDocumentSelection,
} from '../../client/src/components/documents/document-workspace.state';

const descriptor: DocumentInputDescriptor = {
  document: {
    version: 1,
    provider: 'platform-file',
    bucketId: 'documents',
    filePath: `academic-writing/users/${'a'.repeat(64)}/00000000-0000-4000-8000-000000000001/paper.pdf`,
    fileName: 'paper.pdf',
    sourceType: 'pdf',
    mimeType: 'application/pdf',
    sizeBytes: 128,
    sha256: 'b'.repeat(64),
  },
  summary: {
    title: 'Research Paper',
    sourceType: 'pdf',
    pageCount: 2,
    blockCount: 4,
    warningCount: 0,
  },
};

const workspaceDocument: KnowledgeWorkspaceDocument = {
  document: {
    id: '00000000-0000-4000-8000-000000000010',
    userId: 'user-1',
    originKind: 'user-upload',
    displayName: 'Research Paper',
    sourceType: 'pdf',
    activeVersionId: '00000000-0000-4000-8000-000000000020',
    lifecycleStatus: 'active',
  },
  activeVersion: {
    id: '00000000-0000-4000-8000-000000000020',
    documentId: '00000000-0000-4000-8000-000000000010',
    versionNumber: 1,
    readinessStatus: 'content-ready-for-indexing',
    createdAt: '2026-09-08T00:00:00.000Z',
  },
  documentRef: descriptor.document,
};

describe('knowledge product client API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('imports a real DocumentInputRef without a client user id', async () => {
    const post = productHttpClient.post as jest.Mock;
    post.mockResolvedValueOnce({ data: workspaceDocument });
    const request = {
      idempotencyKey: 'workspace:uuid-1',
      displayName: 'Research Paper',
      documentRef: descriptor.document,
    };

    await expect(importDocument(request)).resolves.toEqual(workspaceDocument);
    expect(post).toHaveBeenCalledWith('/api/knowledge/documents', request);
    expect(post.mock.calls[0][1]).not.toHaveProperty('userId');
  });

  it('uses the owner-scoped list, detail, and delete routes', async () => {
    const get = productHttpClient.get as jest.Mock;
    const remove = productHttpClient.delete as jest.Mock;
    get.mockResolvedValueOnce({ data: [workspaceDocument] });
    get.mockResolvedValueOnce({ data: workspaceDocument });
    remove.mockResolvedValueOnce({
      data: { documentId: workspaceDocument.document.id, status: 'tombstoned' },
    });

    await expect(listDocuments()).resolves.toEqual([workspaceDocument]);
    await expect(getDocument(workspaceDocument.document.id)).resolves.toEqual(
      workspaceDocument,
    );
    await expect(deleteDocument(workspaceDocument.document.id)).resolves.toEqual({
      documentId: workspaceDocument.document.id,
      status: 'tombstoned',
    });
    expect(get).toHaveBeenNthCalledWith(1, '/api/knowledge/documents');
    expect(get).toHaveBeenNthCalledWith(
      2,
      `/api/knowledge/documents/${workspaceDocument.document.id}`,
    );
    expect(remove).toHaveBeenCalledWith(
      `/api/knowledge/documents/${workspaceDocument.document.id}`,
    );
  });

  it('normalizes product API failures without exposing a raw response', async () => {
    const post = productHttpClient.post as jest.Mock;
    post.mockRejectedValueOnce({
      response: {
        status: 503,
        data: {
          error: {
            code: 'KNOWLEDGE_PRODUCT_UNAVAILABLE',
            message: 'The document storage is unavailable.',
          },
        },
      },
    });

    await expect(importDocument({
      idempotencyKey: 'workspace:uuid-1',
      displayName: 'Research Paper',
      documentRef: descriptor.document,
    })).rejects.toMatchObject({
      name: 'ProductApiError',
      code: 'KNOWLEDGE_PRODUCT_UNAVAILABLE',
      message: 'The document storage is unavailable.',
      status: 503,
      retryable: true,
    });
  });
});

describe('document workspace state', () => {
  it('reconstructs a tool selection only from a stored artifact projection', () => {
    expect(toWorkspaceDocumentSelection(workspaceDocument)).toEqual({
      documentRef: descriptor.document,
      documentId: workspaceDocument.document.id,
      documentVersionId: workspaceDocument.activeVersion?.id,
      displayName: 'Research Paper',
    });

    expect(toWorkspaceDocumentSelection({
      ...workspaceDocument,
      document: { ...workspaceDocument.document, displayName: 'Text notes' },
      documentRef: undefined,
    })).toBeNull();
  });

  it('clears a previous descriptor and selection when a new file is selected', () => {
    const ready = {
      ...initialDocumentWorkspaceState,
      status: 'ready' as const,
      file: new File(['old'], 'old.txt'),
      descriptor,
      selection: toWorkspaceDocumentSelection(workspaceDocument),
      error: { stage: 'import' as const, message: 'old error' },
    };
    const nextFile = new File(['new'], 'new.txt');

    expect(reduceDocumentWorkspaceState(ready, {
      type: 'select-file',
      file: nextFile,
    })).toEqual({
      status: 'selecting',
      file: nextFile,
      descriptor: null,
      selection: null,
      error: null,
    });
  });

  it('distinguishes upload and import failures in state', () => {
    const file = new File(['paper'], 'paper.pdf', { type: 'application/pdf' });
    const selected = reduceDocumentWorkspaceState(initialDocumentWorkspaceState, {
      type: 'select-file', file,
    });
    const uploading = reduceDocumentWorkspaceState(selected, { type: 'upload-started' });
    expect(uploading.status).toBe('uploading');
    expect(reduceDocumentWorkspaceState(uploading, {
      type: 'flow-failed', stage: 'upload', message: 'Upload failed',
    })).toEqual(expect.objectContaining({
      status: 'error', error: { stage: 'upload', message: 'Upload failed' },
    }));

    const importing = reduceDocumentWorkspaceState(uploading, {
      type: 'upload-succeeded', descriptor,
    });
    expect(importing.status).toBe('importing');
    expect(reduceDocumentWorkspaceState(importing, {
      type: 'flow-failed', stage: 'import', message: 'Import failed',
    })).toEqual(expect.objectContaining({
      status: 'error', error: { stage: 'import', message: 'Import failed' },
    }));
  });

  it('uploads then imports with a generated idempotency key and real ref', async () => {
    const file = new File(['paper'], 'paper.pdf', { type: 'application/pdf' });
    const upload = jest.fn().mockResolvedValue(descriptor);
    const importIntoWorkspace = jest.fn().mockResolvedValue(workspaceDocument);

    await expect(runDocumentUploadFlow(file, {
      uploadDocument: upload,
      importDocument: importIntoWorkspace,
      createIdempotencyKey: () => 'uuid-1',
    })).resolves.toEqual({ descriptor, workspaceDocument });
    expect(upload).toHaveBeenCalledWith(file);
    expect(importIntoWorkspace).toHaveBeenCalledWith({
      idempotencyKey: 'workspace:uuid-1',
      displayName: 'Research Paper',
      documentRef: descriptor.document,
    });
  });

  it('labels the failing stage without calling import after upload failure', async () => {
    const file = new File(['paper'], 'paper.pdf', { type: 'application/pdf' });
    const importIntoWorkspace = jest.fn();

    await expect(runDocumentUploadFlow(file, {
      uploadDocument: jest.fn().mockRejectedValue(new Error('network')),
      importDocument: importIntoWorkspace,
      createIdempotencyKey: () => 'uuid-1',
    })).rejects.toMatchObject({ stage: 'upload' });
    expect(importIntoWorkspace).not.toHaveBeenCalled();
  });
});
