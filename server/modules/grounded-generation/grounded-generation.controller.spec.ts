import 'reflect-metadata';
jest.mock('@nestjs/common', () => ({
  Body: () => () => undefined,
  Catch: () => () => undefined,
  Controller: () => () => undefined,
  ExceptionFilter: class {},
  HttpCode: jest.fn(() => () => undefined),
  Post: () => () => undefined,
  Req: () => () => undefined,
  UseFilters: () => () => undefined,
  HttpStatus: { OK: 200 },
  UnauthorizedException: class UnauthorizedException extends Error {
    status = 401;
  },
}));
jest.mock('@lark-apaas/fullstack-nestjs-core', () => ({ NeedLogin: jest.fn(() => () => undefined) }));

import type { Request } from 'express';
import { GroundedGenerationController } from './grounded-generation.controller';
import type { GroundedGenerationResult } from './grounded-generation.types';

describe('GroundedGenerationController', () => {
  it('returns the synchronous grounded generation result for the authenticated user', async () => {
    const result = { schemaVersion: 1, status: 'grounded', content: 'content' } as unknown as GroundedGenerationResult;
    const service = { generate: jest.fn().mockResolvedValue(result) };
    const body = { instructions: 'Write.', queryText: 'query' };
    const request = { userContext: { userId: 'user-1' } } as Request;

    const response = await new GroundedGenerationController(service as never).generate(request, body);

    expect(response).toBe(result);
    expect(service.generate).toHaveBeenCalledWith('user-1', body);
  });

  it('keeps the defensive missing-authentication fallback at HTTP 401', async () => {
    const service = { generate: jest.fn() };
    const request = {} as Request;

    await expect(new GroundedGenerationController(service as never).generate(request, {} as never)).rejects.toMatchObject({ status: 401 });
    expect(service.generate).not.toHaveBeenCalled();
  });
});
