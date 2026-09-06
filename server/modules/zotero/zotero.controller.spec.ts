jest.mock('@nestjs/common', () => ({
  Controller: () => () => undefined,
  Delete: () => () => undefined,
  Get: () => () => undefined,
  Post: () => () => undefined,
  Param: () => () => undefined,
  Body: () => () => undefined,
  Req: () => () => undefined,
  UseFilters: () => () => undefined,
  Catch: () => () => undefined,
  ExceptionFilter: class {},
  HttpStatus: { UNAUTHORIZED: 401, FORBIDDEN: 403, CONFLICT: 409, NOT_FOUND: 404, UNPROCESSABLE_ENTITY: 422, BAD_GATEWAY: 502, PAYLOAD_TOO_LARGE: 413, TOO_MANY_REQUESTS: 429, GATEWAY_TIMEOUT: 504 },
  BadRequestException: class extends Error {},
}));
jest.mock('@lark-apaas/fullstack-nestjs-core', () => ({ NeedLogin: () => () => undefined }));

import { ZoteroController } from './zotero.controller';

describe('ZoteroController', () => {
  it('takes the authenticated owner and only apiKey from connection input', async () => {
    const service = {
      connect: jest.fn().mockResolvedValue({ userId: 'platform-user', libraryType: 'user', libraryId: '42' }),
    };
    const controller = new ZoteroController(service as never);

    await expect(controller.connect({ userContext: { userId: 'platform-user' } } as never, {
      apiKey: 'secret-api-key', userId: 'attacker', libraryId: 'attacker-library',
    } as never)).resolves.toMatchObject({ libraryId: '42' });
    expect(service.connect).toHaveBeenCalledWith('platform-user', 'secret-api-key');
  });

  it('rejects a connection request without an API key', async () => {
    const service = { connect: jest.fn() };
    const controller = new ZoteroController(service as never);

    await expect(controller.connect({ userContext: { userId: 'platform-user' } } as never, {})).rejects.toThrow('A Zotero API key is required.');
    expect(service.connect).not.toHaveBeenCalled();
  });
});
