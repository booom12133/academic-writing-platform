import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseFilters,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';

import type { DocumentInputRef } from '@shared/document-input.interface';
import { KnowledgeProductExceptionFilter } from '../../server/modules/knowledge-product/knowledge-product.exception-filter';
import { KnowledgeProductService } from '../../server/modules/knowledge-product/knowledge-product.service';
import type { KnowledgeDocument, KnowledgeDocumentVersion } from '../../server/modules/knowledge/knowledge.types';

const SERVICE_TOKEN = Symbol('KNOWLEDGE_PRODUCT_HTTP_SERVICE');

class KnowledgeProductHttpBoundaryController {
  constructor(private readonly service: KnowledgeProductService) {}

  importDocument(request: { userContext?: { userId: string } }, body: unknown) {
    return this.service.importDocument(this.requireUser(request), body);
  }

  listDocuments(request: { userContext?: { userId: string } }) {
    return this.service.listDocuments(this.requireUser(request));
  }

  getDocument(request: { userContext?: { userId: string } }, id: string) {
    return this.service.getDocument(this.requireUser(request), id);
  }

  deleteDocument(request: { userContext?: { userId: string } }, id: string) {
    return this.service.deleteDocument(this.requireUser(request), id);
  }

  private requireUser(request: { userContext?: { userId: string } }): string {
    const userId = request.userContext?.userId;
    if (!userId) throw new UnauthorizedException('Authentication is required.');
    return userId;
  }
}

Controller('api/knowledge/documents')(KnowledgeProductHttpBoundaryController);
UseFilters(KnowledgeProductExceptionFilter)(KnowledgeProductHttpBoundaryController);
Post()(KnowledgeProductHttpBoundaryController.prototype, 'importDocument', Object.getOwnPropertyDescriptor(KnowledgeProductHttpBoundaryController.prototype, 'importDocument')!);
Get()(KnowledgeProductHttpBoundaryController.prototype, 'listDocuments', Object.getOwnPropertyDescriptor(KnowledgeProductHttpBoundaryController.prototype, 'listDocuments')!);
Get(':documentId')(KnowledgeProductHttpBoundaryController.prototype, 'getDocument', Object.getOwnPropertyDescriptor(KnowledgeProductHttpBoundaryController.prototype, 'getDocument')!);
Delete(':documentId')(KnowledgeProductHttpBoundaryController.prototype, 'deleteDocument', Object.getOwnPropertyDescriptor(KnowledgeProductHttpBoundaryController.prototype, 'deleteDocument')!);
Req()(KnowledgeProductHttpBoundaryController.prototype, 'importDocument', 0);
Body()(KnowledgeProductHttpBoundaryController.prototype, 'importDocument', 1);
Req()(KnowledgeProductHttpBoundaryController.prototype, 'listDocuments', 0);
Req()(KnowledgeProductHttpBoundaryController.prototype, 'getDocument', 0);
Param('documentId')(KnowledgeProductHttpBoundaryController.prototype, 'getDocument', 1);
Req()(KnowledgeProductHttpBoundaryController.prototype, 'deleteDocument', 0);
Param('documentId')(KnowledgeProductHttpBoundaryController.prototype, 'deleteDocument', 1);
Inject(SERVICE_TOKEN)(KnowledgeProductHttpBoundaryController, undefined, 0);

const documentId = '00000000-0000-4000-8000-000000000010';
const versionId = '00000000-0000-4000-8000-000000000020';
const documentRef: DocumentInputRef = {
  version: 1,
  provider: 'self-hosted-filesystem',
  bucketId: 'documents',
  filePath: `academic-writing/users/${'a'.repeat(64)}/00000000-0000-4000-8000-000000000001/paper.pdf`,
  fileName: 'paper.pdf',
  sourceType: 'pdf',
  sizeBytes: 128,
  sha256: 'b'.repeat(64),
};
const document: KnowledgeDocument = {
  id: documentId,
  userId: 'owner-1',
  originKind: 'user-upload',
  displayName: 'Paper',
  sourceType: 'pdf',
  activeVersionId: versionId,
  lifecycleStatus: 'active',
};
const version: KnowledgeDocumentVersion = {
  id: versionId,
  userId: 'owner-1',
  documentId,
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
    sizeBytes: documentRef.sizeBytes,
    sha256: documentRef.sha256,
  },
  lifecycleStatus: 'active',
  readinessStatus: 'content-ready-for-indexing',
  indexInputFingerprint: 'c'.repeat(64),
  createdAt: '2026-09-08T00:00:00.000Z',
};

describe('KnowledgeProduct HTTP boundary', () => {
  let app: INestApplication;
  let baseUrl: string;
  const repository = {
    listDocuments: jest.fn(async (userId: string) => userId === 'owner-1' ? [document] : []),
    getDocument: jest.fn(async (userId: string, id: string) =>
      userId === 'owner-1' && id === documentId ? document : null),
    getVersion: jest.fn(async (userId: string, id: string) =>
      userId === 'owner-1' && id === versionId ? version : null),
    getSourceRecord: jest.fn().mockResolvedValue(null),
  };
  const knowledge = {
    importDocument: jest.fn().mockResolvedValue({
      document,
      version,
      chunks: [],
      idempotent: false,
      readiness: 'content-ready-for-indexing',
    }),
    tombstoneDocument: jest.fn().mockResolvedValue(undefined),
  };
  const documentInput = {
    validateOwnedRef: jest.fn().mockResolvedValue(documentRef),
  };

  beforeAll(async () => {
    const service = new KnowledgeProductService(
      repository as never,
      knowledge as never,
      documentInput as never,
    );
    const moduleRef = await Test.createTestingModule({
      controllers: [KnowledgeProductHttpBoundaryController],
      providers: [{ provide: SERVICE_TOKEN, useValue: service }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use((req: { headers: Record<string, unknown>; userContext?: { userId: string } }, _res: unknown, next: () => void) => {
      const userId = req.headers['x-test-user'];
      if (typeof userId === 'string') req.userContext = { userId };
      next();
    });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    knowledge.importDocument.mockClear();
    knowledge.tombstoneDocument.mockClear();
    documentInput.validateOwnedRef.mockClear();
  });

  it('serves authenticated import, list, detail, and tombstone routes', async () => {
    const importResponse = await fetch(`${baseUrl}/api/knowledge/documents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user': 'owner-1' },
      body: JSON.stringify({
        idempotencyKey: 'workspace:key-1',
        displayName: 'Paper',
        documentRef,
      }),
    });
    expect(importResponse.status).toBe(201);
    expect(await importResponse.json()).toEqual(expect.objectContaining({
      document: expect.objectContaining({ id: documentId, userId: 'owner-1' }),
      documentRef,
    }));

    const listResponse = await fetch(`${baseUrl}/api/knowledge/documents`, {
      headers: { 'x-test-user': 'owner-1' },
    });
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toHaveLength(1);

    const detailResponse = await fetch(`${baseUrl}/api/knowledge/documents/${documentId}`, {
      headers: { 'x-test-user': 'owner-1' },
    });
    expect(detailResponse.status).toBe(200);

    const deleteResponse = await fetch(`${baseUrl}/api/knowledge/documents/${documentId}`, {
      method: 'DELETE',
      headers: { 'x-test-user': 'owner-1' },
    });
    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ documentId, status: 'tombstoned' });
    expect(knowledge.tombstoneDocument).toHaveBeenCalledWith('owner-1', documentId);
  });

  it('rejects anonymous, cross-owner, malformed, and body-user injection requests', async () => {
    const anonymous = await fetch(`${baseUrl}/api/knowledge/documents`);
    expect(anonymous.status).toBe(401);

    const crossOwner = await fetch(`${baseUrl}/api/knowledge/documents/${documentId}`, {
      headers: { 'x-test-user': 'owner-2' },
    });
    expect(crossOwner.status).toBe(404);

    const malformed = await fetch(`${baseUrl}/api/knowledge/documents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user': 'owner-1' },
      body: JSON.stringify({ displayName: 'Paper' }),
    });
    expect(malformed.status).toBe(400);

    const injectedUser = await fetch(`${baseUrl}/api/knowledge/documents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user': 'owner-1' },
      body: JSON.stringify({
        userId: 'owner-2',
        idempotencyKey: 'workspace:key-2',
        displayName: 'Paper',
        documentRef,
      }),
    });
    expect(injectedUser.status).toBe(400);
    expect(knowledge.importDocument).not.toHaveBeenCalled();
  });
});
