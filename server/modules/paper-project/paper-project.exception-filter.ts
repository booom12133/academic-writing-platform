import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { PaperProjectError } from './paper-project.errors';

@Catch(PaperProjectError)
export class PaperProjectExceptionFilter implements ExceptionFilter {
  catch(error: PaperProjectError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error.code === 'PAPER_PROJECT_VERSION_CONFLICT' || error.code === 'PAPER_SECTION_REVISION_CONFLICT' || error.code === 'PAPER_MANUSCRIPT_CHANGED' || error.code === 'PAPER_PROJECT_ARCHIVED' ? 409
      : error.code === 'PAPER_PROJECT_NOT_FOUND' ? 404
      : error.code === 'PAPER_MANUSCRIPT_INTEGRITY_FAILURE' ? 500
      : error.code.includes('PROVIDER_UNAVAILABLE') ? 503
      : error.code.includes('TIMEOUT') ? 504 : 400;
    response.status(status).json({ statusCode: status, code: error.code, message: error.message, ...(error.details === undefined ? {} : { details: error.details }) });
  }
}
