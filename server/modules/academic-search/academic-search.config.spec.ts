import { resolveAcademicSearchConfig } from './academic-search.config';
import { AcademicSearchError, ACADEMIC_SEARCH_ERROR_CODES } from './academic-search.errors';
import { ACADEMIC_SEARCH_PROVIDER, type AcademicSearchProvider } from './academic-search.provider';

describe('academic search contract and configuration', () => {
  it('uses bounded OpenAlex defaults and accepts safe environment overrides', () => {
    const config = resolveAcademicSearchConfig({
      OPENALEX_API_BASE_URL: 'https://example.test/',
      ACADEMIC_SEARCH_TIMEOUT_MS: '1500',
      ACADEMIC_SEARCH_MAX_RETRIES: '3',
      ACADEMIC_SEARCH_DEFAULT_PAGE_SIZE: '40',
      ACADEMIC_SEARCH_CURSOR_SECRET: 'test-secret',
    });

    expect(config).toMatchObject({
      baseUrl: 'https://example.test',
      timeoutMs: 1500,
      maxRetries: 3,
      defaultPageSize: 40,
      maxPageSize: 100,
      cursorSecret: 'test-secret',
    });
  });

  it('clamps retry and page-size configuration to bounded values', () => {
    const config = resolveAcademicSearchConfig({
      ACADEMIC_SEARCH_MAX_RETRIES: '99',
      ACADEMIC_SEARCH_DEFAULT_PAGE_SIZE: '999',
    });

    expect(config.maxRetries).toBeLessThanOrEqual(4);
    expect(config.defaultPageSize).toBeLessThanOrEqual(config.maxPageSize);
    expect(config.maxPageSize).toBe(100);
    expect(config.cursorSecret.length).toBeGreaterThanOrEqual(32);
  });

  it('keeps the optional OpenAlex API key out of public configuration serialization', () => {
    const config = resolveAcademicSearchConfig({ OPENALEX_API_KEY: 'secret-key' });
    expect(config.apiKey).toBe('secret-key');
    expect(JSON.stringify({ ...config, apiKey: undefined })).not.toContain('secret-key');
  });

  it('exposes exactly the frozen error codes', () => {
    expect(ACADEMIC_SEARCH_ERROR_CODES).toEqual([
      'ACADEMIC_SEARCH_INVALID_QUERY',
      'ACADEMIC_SEARCH_PROVIDER_UNAVAILABLE',
      'ACADEMIC_SEARCH_TIMEOUT',
      'ACADEMIC_SEARCH_RATE_LIMITED',
      'ACADEMIC_SEARCH_INVALID_RESPONSE',
      'ACADEMIC_SEARCH_CURSOR_INVALID',
    ]);
    expect(new AcademicSearchError('ACADEMIC_SEARCH_INVALID_QUERY', 'invalid')).toBeInstanceOf(Error);
  });

  it('defines a replaceable provider token and provider seam', async () => {
    const provider: AcademicSearchProvider = {
      search: async () => ({
        provider: 'openalex',
        status: 'empty',
        items: [],
        diagnostics: [],
        provenance: { provider: 'openalex', queryFingerprint: 'fp', retrievedAt: '2026-01-01T00:00:00.000Z' },
      }),
    };

    expect(typeof ACADEMIC_SEARCH_PROVIDER).toBe('symbol');
    await expect(provider.search({ query: { text: 'test' }, queryFingerprint: 'fp' })).resolves.toMatchObject({ provider: 'openalex' });
  });
});
