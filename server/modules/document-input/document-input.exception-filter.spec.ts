import { HttpStatus } from '@nestjs/common';

import { DocumentInputError } from './document-input.errors';
import { DocumentInputExceptionFilter } from './document-input.exception-filter';

describe('DocumentInputExceptionFilter', () => {
  it('maps C4 errors to stable error codes without touching the global filter', () => {
    const json = jest.fn();
    const response = { status: jest.fn().mockReturnValue({ json }) };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as never;

    new DocumentInputExceptionFilter().catch(
      new DocumentInputError('DOCUMENT_INTEGRITY_MISMATCH', 'hash mismatch'),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        code: 'DOCUMENT_INTEGRITY_MISMATCH',
        message: 'hash mismatch',
      }),
    }));
  });

  it('maps Multer size-limit errors to DOCUMENT_TOO_LARGE', () => {
    const json = jest.fn();
    const response = { status: jest.fn().mockReturnValue({ json }) };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as never;

    new DocumentInputExceptionFilter().catch({ code: 'LIMIT_FILE_SIZE', message: 'too large' }, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'DOCUMENT_TOO_LARGE' }),
    }));
  });
});
