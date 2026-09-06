import { AcademicSearchError } from './academic-search.errors';
import { resolveAcademicSearchConfig } from './academic-search.config';
import { AcademicSearchService } from './academic-search.service';
import type { AcademicSearchCursorCodec } from './academic-search.cursor';
import type { AcademicDiscoverySet, AcademicSearchRequest } from './academic-search.types';
import type { AcademicSearchProvider } from './academic-search.provider';

const discoverySet: AcademicDiscoverySet = {
  provider: 'openalex',
  status: 'empty',
  items: [],
  diagnostics: [],
  provenance: { provider: 'openalex', queryFingerprint: 'query-fingerprint', retrievedAt: '2026-01-01T00:00:00.000Z' },
};

describe('AcademicSearchService', () => {
  const provider: jest.Mocked<AcademicSearchProvider> = { search: jest.fn().mockResolvedValue(discoverySet) };
  const cursorCodec: jest.Mocked<AcademicSearchCursorCodec> = {
    validate: jest.fn(),
    encodeProviderCursor: jest.fn(),
    decodeProviderCursor: jest.fn(),
  };
  let service: AcademicSearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AcademicSearchService(provider, cursorCodec, resolveAcademicSearchConfig({ ACADEMIC_SEARCH_CURSOR_SECRET: 'cursor-secret-for-tests' }));
  });

  it('normalizes the request, computes a cursor-independent fingerprint and delegates to the provider', async () => {
    await expect(service.search({ q: '  graph neural networks  ', pageSize: 20 }, 'user-1')).resolves.toBe(discoverySet);

    expect(provider.search).toHaveBeenCalledWith({
      query: { text: 'graph neural networks', pageSize: 20, filters: undefined, cursor: undefined },
      queryFingerprint: expect.any(String),
    });
  });

  it.each([
    ['empty q', { q: '   ' }],
    ['too-long q', { q: 'x'.repeat(513) }],
    ['invalid date', { q: 'test', fromPublicationDate: '2024/01/01' }],
    ['reversed dates', { q: 'test', fromPublicationDate: '2025-01-01', toPublicationDate: '2024-01-01' }],
    ['invalid year', { q: 'test', publicationYear: 999 }],
    ['invalid boolean', { q: 'test', isOpenAccess: 'true' as unknown as boolean }],
    ['invalid page size', { q: 'test', pageSize: 101 }],
    ['unknown field', { q: 'test', unknown: true } as unknown as AcademicSearchRequest],
  ])('rejects %s before provider invocation', async (_name, request) => {
    await expect(service.search(request, 'user-1')).rejects.toMatchObject({ code: 'ACADEMIC_SEARCH_INVALID_QUERY' });
    expect(provider.search).not.toHaveBeenCalled();
  });

  it('rejects missing authentication and invalid cursor with stable errors', async () => {
    await expect(service.search({ q: 'test' }, '')).rejects.toMatchObject({ code: 'ACADEMIC_SEARCH_INVALID_QUERY' });
    cursorCodec.validate.mockImplementation(() => { throw new AcademicSearchError('ACADEMIC_SEARCH_CURSOR_INVALID', 'The academic search cursor is invalid.'); });
    await expect(service.search({ q: 'test', cursor: 'invalid' as never }, 'user-1')).rejects.toMatchObject({ code: 'ACADEMIC_SEARCH_CURSOR_INVALID' });
    expect(cursorCodec.validate).toHaveBeenCalled();
    expect(provider.search).not.toHaveBeenCalled();
  });

  it('propagates cursor validation errors without converting them to provider errors', async () => {
    cursorCodec.validate.mockImplementation(() => { throw new AcademicSearchError('ACADEMIC_SEARCH_CURSOR_INVALID', 'The academic search cursor is invalid.'); });

    await expect(service.search({ q: 'test', cursor: 'opaque' as never }, 'user-1')).rejects.toMatchObject({ code: 'ACADEMIC_SEARCH_CURSOR_INVALID' });
    expect(provider.search).not.toHaveBeenCalled();
  });
});
