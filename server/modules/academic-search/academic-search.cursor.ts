import { createHmac, timingSafeEqual } from 'node:crypto';
import { AcademicSearchError } from './academic-search.errors';
import type { AcademicSearchCursor } from './academic-search.types';

interface CursorPayload {
  version: 1;
  provider: 'openalex';
  queryFingerprint: string;
  providerCursor: string;
  issuedAt: number;
}

export interface AcademicSearchCursorCodec {
  validate(cursor: AcademicSearchCursor, expectedQueryFingerprint: string): void;
  encodeProviderCursor(providerCursor: string, queryFingerprint: string): AcademicSearchCursor;
  decodeProviderCursor(cursor: AcademicSearchCursor, expectedQueryFingerprint: string): string;
}

export interface AcademicSearchCursorCodecOptions {
  secret: string;
  ttlMs: number;
  now?: () => number;
}

export class HmacAcademicSearchCursorCodec implements AcademicSearchCursorCodec {
  private readonly now: () => number;

  constructor(private readonly options: AcademicSearchCursorCodecOptions) {
    this.now = options.now ?? (() => Date.now());
    if (!options.secret || options.secret.length < 16 || options.ttlMs <= 0) {
      throw new Error('Academic search cursor configuration is invalid.');
    }
  }

  encodeProviderCursor(providerCursor: string, queryFingerprint: string): AcademicSearchCursor {
    if (!providerCursor || !queryFingerprint) throw this.invalidCursor();
    const payload: CursorPayload = {
      version: 1,
      provider: 'openalex',
      queryFingerprint,
      providerCursor,
      issuedAt: this.now(),
    };
    const body = this.toBase64Url(JSON.stringify(payload));
    return `${body}.${this.signature(body)}` as AcademicSearchCursor;
  }

  validate(cursor: AcademicSearchCursor, expectedQueryFingerprint: string): void {
    const payload = this.read(cursor);
    if (payload.queryFingerprint !== expectedQueryFingerprint) throw this.invalidCursor();
    if (payload.issuedAt > this.now() || this.now() - payload.issuedAt > this.options.ttlMs) throw this.invalidCursor();
  }

  decodeProviderCursor(cursor: AcademicSearchCursor, expectedQueryFingerprint: string): string {
    this.validate(cursor, expectedQueryFingerprint);
    return this.read(cursor).providerCursor;
  }

  private read(cursor: AcademicSearchCursor): CursorPayload {
    if (typeof cursor !== 'string' || !cursor || cursor.length > 4096) throw this.invalidCursor();
    const parts = cursor.split('.');
    if (parts.length !== 2) throw this.invalidCursor();
    const [body, encodedSignature] = parts;
    const expectedSignature = this.signature(body);
    const actual = Buffer.from(encodedSignature, 'base64url');
    const expected = Buffer.from(expectedSignature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw this.invalidCursor();
    try {
      const parsed: unknown = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw this.invalidCursor();
      const value = parsed as Partial<CursorPayload>;
      if (
        value.version !== 1 || value.provider !== 'openalex' ||
        typeof value.queryFingerprint !== 'string' || !value.queryFingerprint ||
        typeof value.providerCursor !== 'string' || !value.providerCursor ||
        !Number.isSafeInteger(value.issuedAt)
      ) throw this.invalidCursor();
      return value as CursorPayload;
    } catch (error) {
      if (error instanceof AcademicSearchError) throw error;
      throw this.invalidCursor();
    }
  }

  private signature(body: string): string {
    return createHmac('sha256', this.options.secret).update(body).digest('base64url');
  }

  private toBase64Url(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64url');
  }

  private invalidCursor(): AcademicSearchError {
    return new AcademicSearchError('ACADEMIC_SEARCH_CURSOR_INVALID', 'The academic search cursor is invalid.');
  }
}
