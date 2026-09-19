export type PaperProjectErrorCode =
  | 'PAPER_PROJECT_NOT_FOUND' | 'PAPER_PROJECT_VERSION_CONFLICT' | 'PAPER_PROJECT_INVALID_REQUEST'
  | 'PAPER_OUTLINE_INVALID_TREE' | 'PAPER_SECTION_REVISION_CONFLICT'
  | 'PAPER_SOURCE_OWNERSHIP_MISMATCH' | 'PAPER_SOURCE_CANONICAL_CHAIN_MISMATCH'
  | 'PAPER_SOURCE_METADATA_ONLY' | 'PAPER_SOURCE_NOT_INDEXED' | 'PAPER_SOURCE_INDEXING'
  | 'PAPER_SOURCE_INDEX_FAILED' | 'PAPER_EVIDENCE_INSUFFICIENT'
  | 'PAPER_GENERATION_INVALID_RESPONSE' | 'PAPER_INTEGRITY_VALIDATION_FAILED'
  | 'PAPER_GENERATION_PROVIDER_UNAVAILABLE' | 'PAPER_GENERATION_TIMEOUT';

export class PaperProjectError extends Error {
  constructor(public readonly code: PaperProjectErrorCode, message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'PaperProjectError';
  }
}

export function toPaperGenerationError(error: unknown): PaperProjectError {
  if (error instanceof PaperProjectError) return error;
  const message = error instanceof Error ? error.message : '';
  if (/invalid structured output/iu.test(message)) return new PaperProjectError('PAPER_GENERATION_INVALID_RESPONSE', 'Paper generation returned an invalid structured response.');
  if (/timed?\s*out|timeout/iu.test(message)) return new PaperProjectError('PAPER_GENERATION_TIMEOUT', 'Paper generation timed out.');
  return new PaperProjectError('PAPER_GENERATION_PROVIDER_UNAVAILABLE', 'Paper generation provider is unavailable.');
}
