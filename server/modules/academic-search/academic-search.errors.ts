export const ACADEMIC_SEARCH_ERROR_CODES = [
  'ACADEMIC_SEARCH_INVALID_QUERY',
  'ACADEMIC_SEARCH_PROVIDER_UNAVAILABLE',
  'ACADEMIC_SEARCH_TIMEOUT',
  'ACADEMIC_SEARCH_RATE_LIMITED',
  'ACADEMIC_SEARCH_INVALID_RESPONSE',
  'ACADEMIC_SEARCH_CURSOR_INVALID',
] as const;

export type AcademicSearchErrorCode = (typeof ACADEMIC_SEARCH_ERROR_CODES)[number];

export class AcademicSearchError extends Error {
  constructor(
    public readonly code: AcademicSearchErrorCode,
    message: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'AcademicSearchError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
