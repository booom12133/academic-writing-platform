import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ZoteroError, type ZoteroErrorCode } from './zotero.errors';

const statusByCode: Record<ZoteroErrorCode, HttpStatus> = {
  ZOTERO_INVALID_CREDENTIAL: HttpStatus.UNAUTHORIZED,
  ZOTERO_INSUFFICIENT_PRIVILEGES: HttpStatus.FORBIDDEN,
  ZOTERO_CONNECTION_DISABLED: HttpStatus.CONFLICT,
  ZOTERO_ITEM_NOT_FOUND: HttpStatus.NOT_FOUND,
  ZOTERO_ATTACHMENT_UNSUPPORTED: HttpStatus.UNPROCESSABLE_ENTITY,
  ZOTERO_ATTACHMENT_UNAVAILABLE: HttpStatus.BAD_GATEWAY,
  ZOTERO_ATTACHMENT_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
  ZOTERO_ATTACHMENT_INTEGRITY_FAILED: HttpStatus.UNPROCESSABLE_ENTITY,
  ZOTERO_RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  ZOTERO_UPSTREAM_TIMEOUT: HttpStatus.GATEWAY_TIMEOUT,
  ZOTERO_UPSTREAM_FAILED: HttpStatus.BAD_GATEWAY,
  ZOTERO_METADATA_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
};

@Catch(ZoteroError)
export class ZoteroExceptionFilter implements ExceptionFilter {
  catch(exception: ZoteroError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) return;
    response.status(statusByCode[exception.code]).json({ error: { code: exception.code, message: exception.message, ...(exception.retryAfterMs === undefined ? {} : { retryAfterMs: exception.retryAfterMs }), timestamp: Date.now() } });
  }
}
