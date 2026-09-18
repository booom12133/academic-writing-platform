import 'reflect-metadata';

jest.mock('@nestjs/common', () => ({
  Body: () => () => undefined,
  Catch: () => () => undefined,
  Controller: () => () => undefined,
  Delete: () => () => undefined,
  Get: () => () => undefined,
  ExceptionFilter: class {},
  Inject: () => () => undefined,
  Injectable: () => () => undefined,
  Param: () => () => undefined,
  Post: () => () => undefined,
  Req: () => () => undefined,
  UnauthorizedException: class UnauthorizedException extends Error {},
  UseFilters: () => () => undefined,
}));

jest.mock('@lark-apaas/fullstack-nestjs-core', () => ({
  NeedLogin: jest.fn(() => () => undefined),
}));

import { UnauthorizedException } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { KnowledgeProductController } from './knowledge-product.controller';
import { KnowledgeProductService } from './knowledge-product.service';

describe('KnowledgeProductController', () => {
  const service = {
    importDocument: jest.fn(),
    listDocuments: jest.fn(),
    getDocument: jest.fn(),
    indexActiveVersion: jest.fn(),
    getIndexStatus: jest.fn(),
    deleteDocument: jest.fn(),
    retryIndex: jest.fn(),
  };
  const controller = new KnowledgeProductController(
    service as unknown as KnowledgeProductService,
  );

  beforeEach(() => {
    service.importDocument.mockReset();
    service.listDocuments.mockReset();
    service.getDocument.mockReset();
    service.deleteDocument.mockReset();
  });

  it('protects all routes and delegates import with userContext rather than body userId', async () => {
    const body = {
      userId: 'attacker',
      idempotencyKey: 'key-1',
      displayName: 'Paper',
      documentRef: {},
    };
    service.importDocument.mockResolvedValueOnce({ document: { id: 'doc-1' } });

    await controller.importDocument(
      { userContext: { userId: 'owner-1' } } as never,
      body,
    );

    expect(NeedLogin).toHaveBeenCalledTimes(8);
    expect(service.importDocument).toHaveBeenCalledWith('owner-1', body);
  });

  it('delegates owner-scoped list, get, and delete operations', async () => {
    service.listDocuments.mockResolvedValueOnce([]);
    service.getDocument.mockResolvedValueOnce({ document: { id: 'doc-1' } });
    service.deleteDocument.mockResolvedValueOnce({ documentId: 'doc-1', status: 'tombstoned' });
    const request = { userContext: { userId: 'owner-1' } } as never;

    await expect(controller.listDocuments(request)).resolves.toEqual([]);
    await expect(controller.getDocument(request, 'doc-1')).resolves.toEqual({
      document: { id: 'doc-1' },
    });
    await expect(controller.deleteDocument(request, 'doc-1')).resolves.toEqual({
      documentId: 'doc-1',
      status: 'tombstoned',
    });
    expect(service.listDocuments).toHaveBeenCalledWith('owner-1');
    expect(service.getDocument).toHaveBeenCalledWith('owner-1', 'doc-1');
    expect(service.deleteDocument).toHaveBeenCalledWith('owner-1', 'doc-1');
  });

  it('rejects anonymous access before calling the product service', async () => {
    await expect(controller.listDocuments({} as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(controller.getDocument({} as never, 'doc-1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(controller.deleteDocument({} as never, 'doc-1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(controller.importDocument({} as never, {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(service.listDocuments).not.toHaveBeenCalled();
    expect(service.getDocument).not.toHaveBeenCalled();
    expect(service.deleteDocument).not.toHaveBeenCalled();
    expect(service.importDocument).not.toHaveBeenCalled();
  });
});
