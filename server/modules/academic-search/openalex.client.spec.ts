import { AcademicSearchError } from './academic-search.errors';
import { OpenAlexClient, type FetchLike } from './openalex.client';
import type { AcademicSearchConfig } from './academic-search.config';

function config(overrides: Partial<AcademicSearchConfig> = {}): AcademicSearchConfig {
  return {
    baseUrl: 'https://api.openalex.org',
    timeoutMs: 100,
    maxRetries: 2,
    retryDelayMs: 0,
    defaultPageSize: 20,
    maxPageSize: 100,
    cursorSecret: 'cursor-secret-for-tests',
    cursorTtlMs: 60_000,
    ...overrides,
  };
}

function response(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

describe('OpenAlexClient', () => {
  it('builds a bounded works request with filters and a fixed field selection', async () => {
    let requestUrl = '';
    let requestInit: { headers?: Record<string, string> } | undefined;
    const fetchImpl: FetchLike = async (url, init) => {
      requestUrl = url;
      requestInit = init;
      return response({ meta: { count: 1, next_cursor: 'next' }, results: [{ id: 'W1' }] });
    };
    const client = new OpenAlexClient(config({ apiKey: 'secret-api-key' }), fetchImpl);

    const page = await client.searchWorks({
      text: 'graph neural networks',
      filters: { fromPublicationDate: '2020-01-01', toPublicationDate: '2024-12-31', publicationYear: 2024, workType: 'article', isOpenAccess: true },
      pageSize: 100,
      providerCursor: 'openalex-cursor',
    });
    const url = new URL(requestUrl);

    expect(url.pathname).toBe('/works');
    expect(url.searchParams.get('search')).toBe('graph neural networks');
    expect(url.searchParams.get('per-page')).toBe('100');
    expect(url.searchParams.get('cursor')).toBe('openalex-cursor');
    expect(url.searchParams.get('filter')).toContain('from_publication_date:2020-01-01');
    expect(url.searchParams.get('filter')).toContain('to_publication_date:2024-12-31');
    expect(url.searchParams.get('filter')).toContain('publication_year:2024');
    expect(url.searchParams.get('filter')).toContain('type:article');
    expect(url.searchParams.get('filter')).toContain('open_access.is_oa:true');
    expect(url.searchParams.get('select')).toContain('abstract_inverted_index');
    expect(url.search).not.toContain('secret-api-key');
    expect(requestInit?.headers).toEqual({ Authorization: 'Bearer secret-api-key' });
    expect(page).toEqual({ meta: { count: 1, next_cursor: 'next' }, results: [{ id: 'W1' }] });
  });

  it('retries a transient 503 and succeeds without making more than one page request', async () => {
    let attempts = 0;
    const fetchImpl: FetchLike = async () => {
      attempts += 1;
      return attempts === 1
        ? response({ error: 'temporary' }, 503)
        : response({ meta: { count: 0, next_cursor: null }, results: [] });
    };
    const client = new OpenAlexClient(config(), fetchImpl, async () => undefined);

    await expect(client.searchWorks({ text: 'test', pageSize: 20 })).resolves.toMatchObject({ results: [] });
    expect(attempts).toBe(2);
  });

  it('does not sleep for a generic network retry when backoff exceeds the shared deadline', async () => {
    const sleeps: number[] = [];
    const fetchImpl: FetchLike = async () => { throw new Error('network unavailable'); };
    const client = new OpenAlexClient(
      config({ timeoutMs: 5, retryDelayMs: 10 }),
      fetchImpl,
      async (milliseconds) => { sleeps.push(milliseconds); },
    );

    await expect(client.searchWorks({ text: 'test', pageSize: 20 })).rejects.toMatchObject({ code: 'ACADEMIC_SEARCH_PROVIDER_UNAVAILABLE' });
    expect(sleeps).toEqual([]);
  });

  it('maps a final 429 to the stable rate-limit error and honors numeric Retry-After', async () => {
    const sleeps: number[] = [];
    const fetchImpl: FetchLike = async () => response({ error: 'rate limited' }, 429, { 'Retry-After': '1' });
    const client = new OpenAlexClient(config({ maxRetries: 0 }), fetchImpl, async (milliseconds) => { sleeps.push(milliseconds); });

    await expect(client.searchWorks({ text: 'test', pageSize: 20 })).rejects.toMatchObject({
      code: 'ACADEMIC_SEARCH_RATE_LIMITED',
      retryAfterMs: 1000,
    });
    expect(sleeps).toEqual([]);
  });

  it('maps an aborted fetch to the stable timeout error', async () => {
    const fetchImpl: FetchLike = async (_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
    const client = new OpenAlexClient(config({ timeoutMs: 5 }), fetchImpl);

    await expect(client.searchWorks({ text: 'test', pageSize: 20 })).rejects.toMatchObject({ code: 'ACADEMIC_SEARCH_TIMEOUT' });
  });

  it('rejects malformed JSON and invalid response shape without exposing upstream details', async () => {
    const malformed: FetchLike = async () => new Response('{', { status: 200 });
    const invalid = new OpenAlexClient(config(), malformed);
    await expect(invalid.searchWorks({ text: 'test', pageSize: 20 })).rejects.toMatchObject({ code: 'ACADEMIC_SEARCH_INVALID_RESPONSE' });

    const missingResults: FetchLike = async () => response({ meta: { count: 0, next_cursor: null } });
    const invalidShape = new OpenAlexClient(config(), missingResults);
    await expect(invalidShape.searchWorks({ text: 'test', pageSize: 20 })).rejects.toBeInstanceOf(AcademicSearchError);
  });
});
