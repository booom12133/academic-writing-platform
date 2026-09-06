import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { GroundedGenerationError } from './grounded-generation.errors';

@Catch(GroundedGenerationError)
export class GroundedGenerationExceptionFilter implements ExceptionFilter {
  catch(exception: GroundedGenerationError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(exception.httpStatus).json({
      error: {
        code: exception.code,
        message: exception.message,
        ...(exception.details === undefined ? {} : { details: exception.details }),
        timestamp: Date.now(),
      },
    });
  }
}
