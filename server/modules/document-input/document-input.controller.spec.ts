jest.mock('@nestjs/common', () => ({
  Controller: () => () => undefined,
  Post: () => () => undefined,
  Req: () => () => undefined,
  UploadedFile: () => () => undefined,
  UseFilters: () => () => undefined,
  UseInterceptors: () => () => undefined,
  Catch: () => () => undefined,
  Injectable: () => () => undefined,
  Inject: () => () => undefined,
  HttpStatus: {
    BAD_REQUEST: 400,
    PAYLOAD_TOO_LARGE: 413,
    INTERNAL_SERVER_ERROR: 500,
    NOT_FOUND: 404,
    FORBIDDEN: 403,
    UNPROCESSABLE_ENTITY: 422,
  },
}));
jest.mock('@nestjs/platform-express', () => ({
  FileInterceptor: () => class {},
}));
jest.mock('@lark-apaas/fullstack-nestjs-core', () => ({
  NeedLogin: () => () => undefined,
}));

import { DocumentInputController } from './document-input.controller';
import { DocumentInputError } from './document-input.errors';

describe('DocumentInputController', () => {
  it('passes the authenticated user and multipart file to the service', async () => {
    const descriptor = { document: { version: 1 }, summary: { blockCount: 1 } };
    const service = { upload: jest.fn().mockResolvedValue(descriptor) };
    const controller = new DocumentInputController(service as never);
    const file = { buffer: Buffer.from('synthetic'), originalname: 'note.txt', mimetype: 'text/plain' };

    await expect(controller.upload({ userContext: { userId: 'user-1' } } as never, file as never))
      .resolves.toBe(descriptor);

    expect(service.upload).toHaveBeenCalledWith('user-1', file);
  });

  it('rejects a request without a multipart file before service/storage work', async () => {
    const service = { upload: jest.fn() };
    const controller = new DocumentInputController(service as never);

    await expect(controller.upload({ userContext: { userId: 'user-1' } } as never, undefined))
      .rejects.toMatchObject({ code: 'INVALID_DOCUMENT_UPLOAD' } satisfies Partial<DocumentInputError>);
    expect(service.upload).not.toHaveBeenCalled();
  });
});
