import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

import { KnowledgeProductError } from './knowledge-product.errors';

@Catch(KnowledgeProductError)
export class KnowledgeProductExceptionFilter implements ExceptionFilter {
  catch(exception: KnowledgeProductError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) return;
    response.status(exception.httpStatus).json({
      error: {
        code: exception.code,
        message: exception.message,
        timestamp: Date.now(),
      },
    });
  }
}
