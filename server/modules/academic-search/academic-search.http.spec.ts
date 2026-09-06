import { Body, Controller, HttpCode, Inject, Post, Req, UseFilters } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { AcademicSearchError } from './academic-search.errors';
import { AcademicSearchExceptionFilter } from './academic-search.exception-filter';

const SERVICE_TOKEN = Symbol('E5_HTTP_SERVICE');

class AcademicSearchHttpBoundaryController {
  constructor(private readonly service: { search: jest.Mock }) {}

  search(request: { userContext?: { userId: string } }, body: unknown) {
    const userId = request.userContext?.userId;
    if (!userId) throw new AcademicSearchError('ACADEMIC_SEARCH_INVALID_QUERY', 'The academic search query is invalid.');
    return this.service.search(body, userId);
  }
}

Controller('api/academic-search')(AcademicSearchHttpBoundaryController);
UseFilters(AcademicSearchExceptionFilter)(AcademicSearchHttpBoundaryController);
Post('search')(AcademicSearchHttpBoundaryController.prototype, 'search', Object.getOwnPropertyDescriptor(AcademicSearchHttpBoundaryController.prototype, 'search')!);
HttpCode(200)(AcademicSearchHttpBoundaryController.prototype, 'search', Object.getOwnPropertyDescriptor(AcademicSearchHttpBoundaryController.prototype, 'search')!);
NeedLogin()(AcademicSearchHttpBoundaryController.prototype, 'search', Object.getOwnPropertyDescriptor(AcademicSearchHttpBoundaryController.prototype, 'search')!);
Req()(AcademicSearchHttpBoundaryController.prototype, 'search', 0);
Body()(AcademicSearchHttpBoundaryController.prototype, 'search', 1);
Inject(SERVICE_TOKEN)(AcademicSearchHttpBoundaryController, undefined, 0);

describe('AcademicSearch HTTP contract', () => {
  let app: INestApplication;
  let baseUrl: string;
  const service = { search: jest.fn() };

  beforeEach(async () => {
    service.search.mockReset();
    const module = await Test.createTestingModule({
      controllers: [AcademicSearchHttpBoundaryController],
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

  afterEach(async () => app.close());

  async function request(path: string, body?: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? { q: 'test' }),
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }

  it('returns the domain discovery set from the approved POST route', async () => {
    const discovery = { provider: 'openalex', status: 'empty', items: [], diagnostics: [], provenance: { provider: 'openalex', queryFingerprint: 'fp', retrievedAt: '2026-01-01T00:00:00.000Z' } };
    service.search.mockResolvedValue(discovery);

    const result = await request('/api/academic-search/search', { q: 'test' });

    expect(result.status).toBe(200);
    expect(result.body).toEqual(discovery);
    expect(service.search).toHaveBeenCalledWith({ q: 'test' }, 'user-1');
  });

  it.each([
    ['ACADEMIC_SEARCH_INVALID_QUERY', 400],
    ['ACADEMIC_SEARCH_CURSOR_INVALID', 400],
    ['ACADEMIC_SEARCH_RATE_LIMITED', 429],
    ['ACADEMIC_SEARCH_TIMEOUT', 504],
    ['ACADEMIC_SEARCH_PROVIDER_UNAVAILABLE', 502],
    ['ACADEMIC_SEARCH_INVALID_RESPONSE', 502],
  ] as const)('maps %s to HTTP %s without leaking secrets or raw errors', async (code, status) => {
    service.search.mockRejectedValueOnce(new AcademicSearchError(code, `safe ${code} message`));

    const result = await request('/api/academic-search/search');

    expect(result.status).toBe(status);
    expect(result.body).toEqual({ error: { code, message: `safe ${code} message`, timestamp: expect.any(Number) } });
    expect(JSON.stringify(result.body)).not.toContain('stack');
    expect(JSON.stringify(result.body)).not.toContain('cause');
    expect(JSON.stringify(result.body)).not.toContain('raw upstream');
  });

  it('does not expose a non-contract works route', async () => {
    const response = await fetch(`${baseUrl}/api/academic-search/works`);
    expect(response.status).toBe(404);
  });
});
