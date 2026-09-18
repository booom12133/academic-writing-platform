export type AcademicSearchImportErrorCode = 'ACADEMIC_SEARCH_IMPORT_INVALID_REQUEST';

export class AcademicSearchImportError extends Error {
  constructor(public readonly code: AcademicSearchImportErrorCode, message: string) {
    super(message);
    this.name = 'AcademicSearchImportError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
