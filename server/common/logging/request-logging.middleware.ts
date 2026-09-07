import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggingMiddleware.name);

  use(request: Request, response: Response, next: () => void): void {
    const requestId = randomUUID();
    const startedAt = Date.now();
    response.setHeader('x-request-id', requestId);
    response.on('finish', () => {
      this.logger.log(
        JSON.stringify({
          requestId,
          method: request.method,
          route: request.route?.path || request.path,
          status: response.statusCode,
          latencyMs: Date.now() - startedAt,
        }),
      );
    });
    next();
  }
}
