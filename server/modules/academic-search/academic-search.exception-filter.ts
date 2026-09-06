import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { AcademicSearchError, type AcademicSearchErrorCode } from './academic-search.errors';

const STATUS_BY_CODE: Record<AcademicSearchErrorCode, HttpStatus> = {
  ACADEMIC_SEARCH_INVALID_QUERY: HttpStatus.BAD_REQUEST,
  ACADEMIC_SEARCH_PROVIDER_UNAVAILABLE: HttpStatus.BAD_GATEWAY,
  ACADEMIC_SEARCH_TIMEOUT: HttpStatus.GATEWAY_TIMEOUT,
  ACADEMIC_SEARCH_RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  ACADEMIC_SEARCH_INVALID_RESPONSE: HttpStatus.BAD_GATEWAY,
  ACADEMIC_SEARCH_CURSOR_INVALID: HttpStatus.BAD_REQUEST,
};

@Catch(AcademicSearchError)
export class AcademicSearchExceptionFilter implements ExceptionFilter {
  catch(exception: AcademicSearchError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) return;
    response.status(STATUS_BY_CODE[exception.code]).json({
      error: { code: exception.code, message: exception.message, timestamp: Date.now() },
    });
  }
}
