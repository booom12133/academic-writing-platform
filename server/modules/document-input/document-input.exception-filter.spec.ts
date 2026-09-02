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

  it('does not handle unrelated exceptions', () => {
    const exception = new Error('unrelated');
    const response = { status: jest.fn() };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as never;

    expect(() => new DocumentInputExceptionFilter().catch(exception, host)).toThrow(exception);
    expect(response.status).not.toHaveBeenCalled();
  });
});
