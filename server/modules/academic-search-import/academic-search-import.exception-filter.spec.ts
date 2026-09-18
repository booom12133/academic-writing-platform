import { AcademicSearchImportError } from './academic-search-import.errors';
import { AcademicSearchImportExceptionFilter } from './academic-search-import.exception-filter';

describe('AcademicSearchImportExceptionFilter', () => {
  it('returns a stable sanitized invalid-request response', () => {
    const json = jest.fn();
    const response = { headersSent: false, status: jest.fn(() => ({ json })) };
    new AcademicSearchImportExceptionFilter().catch(
      new AcademicSearchImportError('ACADEMIC_SEARCH_IMPORT_INVALID_REQUEST', 'Academic search import request is invalid.'),
      { switchToHttp: () => ({ getResponse: () => response }) } as never,
    );
    expect(response.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: { code: 'ACADEMIC_SEARCH_IMPORT_INVALID_REQUEST', message: 'Academic search import request is invalid.', timestamp: expect.any(Number) } });
  });
});
