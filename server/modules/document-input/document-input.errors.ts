export type DocumentInputErrorCode =
  | 'INVALID_DOCUMENT_UPLOAD'
  | 'UNSUPPORTED_DOCUMENT_TYPE'
  | 'DOCUMENT_TOO_LARGE'
  | 'DOCUMENT_STORAGE_FAILED'
  | 'DOCUMENT_NOT_FOUND'
  | 'DOCUMENT_OWNERSHIP_MISMATCH'
  | 'DOCUMENT_INTEGRITY_MISMATCH'
  | 'DOCUMENT_PREPARATION_FAILED';

export class DocumentInputError extends Error {
  constructor(
    public readonly code: DocumentInputErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DocumentInputError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
