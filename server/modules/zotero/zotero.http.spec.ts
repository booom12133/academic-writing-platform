import { Body, Controller, Delete, Get, Inject, Param, Post, Req, UseFilters } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ZoteroExceptionFilter } from './zotero.exception-filter';
import { ZoteroError } from './zotero.errors';

const SERVICE_TOKEN = Symbol('E4_HTTP_SERVICE');

class ZoteroHttpBoundaryController {
  constructor(private readonly service: Record<string, jest.Mock>) {}

  connect(request: { userContext?: { userId: string } }, body: { apiKey?: unknown }) {
    return this.service.connect(request.userContext?.userId, body.apiKey);
  }

  health(request: { userContext?: { userId: string } }) { return this.service.health(request.userContext?.userId); }
  disconnect(request: { userContext?: { userId: string } }) { return this.service.disconnect(request.userContext?.userId); }
  list(request: { userContext?: { userId: string } }) { return this.service.listItems(request.userContext?.userId); }
  importItem(request: { userContext?: { userId: string } }, itemKey: string) { return this.service.importItem(request.userContext?.userId, itemKey); }
  syncItem(request: { userContext?: { userId: string } }, itemKey: string) { return this.service.syncItem(request.userContext?.userId, itemKey); }
  importAttachment(request: { userContext?: { userId: string } }, attachmentKey: string) { return this.service.importAttachment(request.userContext?.userId, attachmentKey); }
}

Controller('api/zotero')(ZoteroHttpBoundaryController);
UseFilters(ZoteroExceptionFilter)(ZoteroHttpBoundaryController);
Post('connection')(ZoteroHttpBoundaryController.prototype, 'connect', Object.getOwnPropertyDescriptor(ZoteroHttpBoundaryController.prototype, 'connect')!);
Get('connection/health')(ZoteroHttpBoundaryController.prototype, 'health', Object.getOwnPropertyDescriptor(ZoteroHttpBoundaryController.prototype, 'health')!);
Delete('connection')(ZoteroHttpBoundaryController.prototype, 'disconnect', Object.getOwnPropertyDescriptor(ZoteroHttpBoundaryController.prototype, 'disconnect')!);
Get('items')(ZoteroHttpBoundaryController.prototype, 'list', Object.getOwnPropertyDescriptor(ZoteroHttpBoundaryController.prototype, 'list')!);
Post('items/:itemKey/import')(ZoteroHttpBoundaryController.prototype, 'importItem', Object.getOwnPropertyDescriptor(ZoteroHttpBoundaryController.prototype, 'importItem')!);
Post('items/:itemKey/sync')(ZoteroHttpBoundaryController.prototype, 'syncItem', Object.getOwnPropertyDescriptor(ZoteroHttpBoundaryController.prototype, 'syncItem')!);
Post('attachments/:attachmentKey/import')(ZoteroHttpBoundaryController.prototype, 'importAttachment', Object.getOwnPropertyDescriptor(ZoteroHttpBoundaryController.prototype, 'importAttachment')!);
Req()(ZoteroHttpBoundaryController.prototype, 'connect', 0);
Body()(ZoteroHttpBoundaryController.prototype, 'connect', 1);
Req()(ZoteroHttpBoundaryController.prototype, 'health', 0);
Req()(ZoteroHttpBoundaryController.prototype, 'disconnect', 0);
Req()(ZoteroHttpBoundaryController.prototype, 'list', 0);
Req()(ZoteroHttpBoundaryController.prototype, 'importItem', 0);
Param('itemKey')(ZoteroHttpBoundaryController.prototype, 'importItem', 1);
Req()(ZoteroHttpBoundaryController.prototype, 'syncItem', 0);
Param('itemKey')(ZoteroHttpBoundaryController.prototype, 'syncItem', 1);
Req()(ZoteroHttpBoundaryController.prototype, 'importAttachment', 0);
Param('attachmentKey')(ZoteroHttpBoundaryController.prototype, 'importAttachment', 1);
Inject(SERVICE_TOKEN)(ZoteroHttpBoundaryController, undefined, 0);

describe('ZoteroController HTTP error boundary', () => {
  let app: INestApplication;
  let baseUrl: string;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      connect: jest.fn(), health: jest.fn(), disconnect: jest.fn(), listItems: jest.fn(),
      importItem: jest.fn(), syncItem: jest.fn(), importAttachment: jest.fn(),
    };
    const module = await Test.createTestingModule({
      controllers: [ZoteroHttpBoundaryController],
      providers: [{ provide: SERVICE_TOKEN, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    app.use((request: { userContext?: { userId: string } }, _response: unknown, next: () => void) => {
      request.userContext = { userId: 'user-1' };
      next();
    });
    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await app.close();
  });

  async function request(path: string, options?: RequestInit): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await fetch(`${baseUrl}${path}`, options);
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }

  it.each([
    ['/api/zotero/connection', 'POST', 'connect', 'ZOTERO_INVALID_CREDENTIAL', 401, { apiKey: 'secret-api-key' }],
    ['/api/zotero/connection/health', 'GET', 'health', 'ZOTERO_CONNECTION_DISABLED', 409, undefined],
    ['/api/zotero/items', 'GET', 'listItems', 'ZOTERO_ITEM_NOT_FOUND', 404, undefined],
    ['/api/zotero/items/ITEM1/import', 'POST', 'importItem', 'ZOTERO_RATE_LIMITED', 429, undefined],
    ['/api/zotero/items/ITEM1/sync', 'POST', 'syncItem', 'ZOTERO_UPSTREAM_TIMEOUT', 504, undefined],
    ['/api/zotero/attachments/ATT1/import', 'POST', 'importAttachment', 'ZOTERO_ATTACHMENT_INTEGRITY_FAILED', 422, undefined],
  ] as const)('maps %s errors through the controller-wide filter', async (path, method, serviceMethod, code, status, body) => {
    service[serviceMethod].mockRejectedValueOnce(new ZoteroError(code, `safe ${code} message`));

    const result = await request(path, {
      method,
      ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });

    expect(result.status).toBe(status);
    expect(result.body).toEqual({ error: { code, message: `safe ${code} message`, timestamp: expect.any(Number) } });
    expect(JSON.stringify(result.body)).not.toContain('secret-api-key');
    expect(JSON.stringify(result.body)).not.toContain('stack');
    expect(JSON.stringify(result.body)).not.toContain('cause');
  });
});
