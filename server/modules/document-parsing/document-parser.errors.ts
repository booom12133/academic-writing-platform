export type DocumentParseErrorCode =
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'EMPTY_FILE'
  | 'MIME_EXTENSION_MISMATCH'
  | 'INVALID_FILE_SIGNATURE'
  | 'CORRUPT_DOCUMENT'
  | 'PASSWORD_PROTECTED_DOCUMENT'
  | 'PDF_NO_SELECTABLE_TEXT'
  | 'INVALID_TEXT_ENCODING'
  | 'PARSER_FAILED';

export class DocumentParseError extends Error {
  constructor(
    public readonly code: DocumentParseErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DocumentParseError';
  }
}
