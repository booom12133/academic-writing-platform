import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { AcademicSearchImportError } from './academic-search-import.errors';

@Catch(AcademicSearchImportError)
export class AcademicSearchImportExceptionFilter implements ExceptionFilter {
  catch(exception: AcademicSearchImportError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) return;
    response.status(HttpStatus.BAD_REQUEST).json({
      error: { code: exception.code, message: exception.message, timestamp: Date.now() },
    });
  }
}
