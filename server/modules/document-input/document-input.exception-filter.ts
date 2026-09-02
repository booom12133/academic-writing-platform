import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Response } from 'express';

import { DocumentInputError, type DocumentInputErrorCode } from './document-input.errors';

const STATUS_BY_CODE: Record<DocumentInputErrorCode, HttpStatus> = {
  INVALID_DOCUMENT_UPLOAD: HttpStatus.BAD_REQUEST,
  UNSUPPORTED_DOCUMENT_TYPE: HttpStatus.BAD_REQUEST,
  DOCUMENT_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
  DOCUMENT_STORAGE_FAILED: HttpStatus.INTERNAL_SERVER_ERROR,
  DOCUMENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  DOCUMENT_OWNERSHIP_MISMATCH: HttpStatus.FORBIDDEN,
  DOCUMENT_INTEGRITY_MISMATCH: HttpStatus.UNPROCESSABLE_ENTITY,
  DOCUMENT_PREPARATION_FAILED: HttpStatus.BAD_REQUEST,
};

@Catch(DocumentInputError, PayloadTooLargeException)
export class DocumentInputExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (!(exception instanceof DocumentInputError) && !(exception instanceof PayloadTooLargeException)) {
      throw exception;
    }

    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) return;

    const code: DocumentInputErrorCode = exception instanceof DocumentInputError
      ? exception.code
      : 'DOCUMENT_TOO_LARGE';
    response.status(STATUS_BY_CODE[code]).json({
      error: {
        code,
        message: exception instanceof DocumentInputError
          ? exception.message
          : 'The document exceeds the 20 MB size limit.',
        timestamp: Date.now(),
      },
    });
  }
}
