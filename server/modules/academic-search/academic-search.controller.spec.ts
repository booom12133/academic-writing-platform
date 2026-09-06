import 'reflect-metadata';
jest.mock('@nestjs/common', () => ({
  Body: () => () => undefined,
  Catch: () => () => undefined,
  Controller: () => () => undefined,
  ExceptionFilter: class {},
  Post: () => () => undefined,
  Req: () => () => undefined,
  UseFilters: () => () => undefined,
  HttpStatus: { BAD_REQUEST: 400, BAD_GATEWAY: 502, GATEWAY_TIMEOUT: 504, TOO_MANY_REQUESTS: 429 },
}));
jest.mock('@lark-apaas/fullstack-nestjs-core', () => ({
  NeedLogin: jest.fn(() => () => undefined),
}));

import { AcademicSearchController } from './academic-search.controller';
import { AcademicSearchError } from './academic-search.errors';
import { AcademicSearchService } from './academic-search.service';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';

describe('AcademicSearchController', () => {
  const service = { search: jest.fn() };
  const controller = new AcademicSearchController(service as unknown as AcademicSearchService);

  beforeEach(() => service.search.mockReset());

  it('declares the authenticated POST search route and delegates the user context', async () => {
    const result = { provider: 'openalex', status: 'empty', items: [], diagnostics: [], provenance: { provider: 'openalex', queryFingerprint: 'fp', retrievedAt: '2026-01-01T00:00:00.000Z' } };
    service.search.mockResolvedValue(result);

    expect(NeedLogin).toHaveBeenCalled();
    await expect(controller.search({ userContext: { userId: 'user-1' } } as never, { q: 'test' })).resolves.toBe(result);
    expect(service.search).toHaveBeenCalledWith({ q: 'test' }, 'user-1');
  });

  it('rejects a missing authenticated user with a stable query error', async () => {
    await expect(controller.search({ userContext: undefined } as never, { q: 'test' })).rejects.toMatchObject({ code: 'ACADEMIC_SEARCH_INVALID_QUERY' });
    expect(service.search).not.toHaveBeenCalled();
  });

  it('maps all frozen errors without exposing implementation details', () => {
    const json = jest.fn();
    const response = { headersSent: false, status: jest.fn(() => ({ json })) };
    const host = { switchToHttp: () => ({ getResponse: () => response }) };
    const filter = new (require('./academic-search.exception-filter').AcademicSearchExceptionFilter)();
    const cases = [
      ['ACADEMIC_SEARCH_INVALID_QUERY', 400],
      ['ACADEMIC_SEARCH_CURSOR_INVALID', 400],
      ['ACADEMIC_SEARCH_RATE_LIMITED', 429],
      ['ACADEMIC_SEARCH_TIMEOUT', 504],
      ['ACADEMIC_SEARCH_PROVIDER_UNAVAILABLE', 502],
      ['ACADEMIC_SEARCH_INVALID_RESPONSE', 502],
    ] as const;

    for (const [code, status] of cases) {
      filter.catch(new AcademicSearchError(code, 'safe message'), host as never);
      expect(response.status).toHaveBeenLastCalledWith(status);
      expect(json).toHaveBeenLastCalledWith({ error: { code, message: 'safe message', timestamp: expect.any(Number) } });
    }
  });
});
