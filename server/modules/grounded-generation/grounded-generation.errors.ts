export const GROUNDED_GENERATION_ERROR_CODES = [
  'GROUNDED_GENERATION_INVALID_QUERY',
  'GROUNDED_GENERATION_INSUFFICIENT_EVIDENCE',
  'GROUNDED_GENERATION_RETRIEVAL_UNAVAILABLE',
  'GROUNDED_GENERATION_PROVIDER_UNAVAILABLE',
  'GROUNDED_GENERATION_TIMEOUT',
  'GROUNDED_GENERATION_INVALID_RESPONSE',
  'GROUNDED_GENERATION_CITATION_INVALID',
  'GROUNDED_GENERATION_RATE_LIMITED',
] as const;

export type GroundedGenerationErrorCode = typeof GROUNDED_GENERATION_ERROR_CODES[number];

export class GroundedGenerationError extends Error {
  constructor(
    public readonly code: GroundedGenerationErrorCode,
    message: string,
    public readonly httpStatus: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'GroundedGenerationError';
  }
}
