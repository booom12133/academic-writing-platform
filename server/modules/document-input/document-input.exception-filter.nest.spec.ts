jest.mock('multer', () => {
  const actual = jest.requireActual('multer') as typeof import('multer');
  const mockedMulter = jest.fn(() => ({
    single: () => (_request: unknown, _response: unknown, callback: (error: Error) => void) => {
      callback(new actual.MulterError('LIMIT_FILE_SIZE'));
    },
  }));
  Object.assign(mockedMulter, actual);
  return mockedMulter;
});

import { HttpStatus, PayloadTooLargeException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { DocumentInputExceptionFilter } from './document-input.exception-filter';

describe('DocumentInputExceptionFilter with Nest FileInterceptor', () => {
  it('maps the actual FileInterceptor-transformed size exception', async () => {
    const interceptor = new (FileInterceptor('file', { limits: { fileSize: 10 } }))();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({}),
        getResponse: () => ({}),
      }),
    } as never;

    let exception: unknown;
    await (interceptor.intercept(context, { handle: () => undefined } as never) as Promise<unknown>)
      .catch((error: unknown) => { exception = error; });

    expect(exception).toBeInstanceOf(PayloadTooLargeException);
    expect((exception as PayloadTooLargeException).getStatus()).toBe(HttpStatus.PAYLOAD_TOO_LARGE);

    const json = jest.fn();
    const response = { status: jest.fn().mockReturnValue({ json }) };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as never;
    new DocumentInputExceptionFilter().catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'DOCUMENT_TOO_LARGE' }),
    }));
  });
});
