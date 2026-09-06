import { HmacAcademicSearchCursorCodec } from './academic-search.cursor';
import { OpenAlexProvider } from './openalex.provider';
import type { OpenAlexClient } from './openalex.client';
import type { AcademicSearchQuery } from './academic-search.types';

function query(cursor?: AcademicSearchQuery['cursor']): AcademicSearchQuery {
  return { text: 'graph neural networks', pageSize: 20, ...(cursor ? { cursor } : {}) };
}

function work(id: string, title = 'A title') {
  return {
    id,
    title,
    authorships: [{ author: { display_name: 'Ada Lovelace' } }],
    publication_year: 2024,
    publication_date: '2024-01-02',
    doi: `10.1234/${id.split('/').pop()}`,
  };
}

describe('OpenAlexProvider', () => {
  const codec = new HmacAcademicSearchCursorCodec({ secret: 'cursor-secret-for-tests', ttlMs: 60_000, now: () => Date.parse('2026-01-01T00:00:00.000Z') });

  it('normalizes, ranks, deduplicates and emits complete provenance', async () => {
    const client = {
      searchWorks: jest.fn().mockResolvedValue({ meta: { count: 2, next_cursor: null }, results: [work('https://openalex.org/W1'), work('https://openalex.org/W2', 'Another title')] }),
    } as unknown as OpenAlexClient;
    const provider = new OpenAlexProvider(client, codec, () => '2026-01-01T00:00:00.000Z');

    const result = await provider.search({ query: query(), queryFingerprint: 'query-fingerprint' });

    expect(client.searchWorks).toHaveBeenCalledWith({ text: 'graph neural networks', pageSize: 20, filters: undefined, providerCursor: '*' });
    expect(result.status).toBe('complete');
    expect(result.items.map((item) => item.provenance.providerRank)).toEqual([1, 2]);
    expect(result.items[0].provenance).toEqual({
      provider: 'openalex',
      externalRecordId: 'https://openalex.org/W1',
      canonicalUrl: 'https://openalex.org/W1',
      retrievedAt: '2026-01-01T00:00:00.000Z',
      providerRank: 1,
      queryFingerprint: 'query-fingerprint',
      verificationStatus: 'observed',
    });
    expect(result.provenance).toEqual({ provider: 'openalex', queryFingerprint: 'query-fingerprint', retrievedAt: '2026-01-01T00:00:00.000Z' });
  });

  it('starts the first OpenAlex page with the internal cursor wildcard', async () => {
    const client = {
      searchWorks: jest.fn().mockResolvedValue({ meta: { count: 0, next_cursor: null }, results: [] }),
    } as unknown as OpenAlexClient;
    const provider = new OpenAlexProvider(client, codec, () => '2026-01-01T00:00:00.000Z');

    await provider.search({ query: query(), queryFingerprint: 'query-fingerprint' });

    expect(client.searchWorks).toHaveBeenCalledWith({ text: 'graph neural networks', pageSize: 20, filters: undefined, providerCursor: '*' });
  });

  it('skips invalid records, reports duplicates and marks the set partial', async () => {
    const client = {
      searchWorks: jest.fn().mockResolvedValue({ meta: { count: 3, next_cursor: null }, results: [work('https://openalex.org/W1'), { id: 'invalid' }, work('https://openalex.org/W1', 'different')] }),
    } as unknown as OpenAlexClient;
    const provider = new OpenAlexProvider(client, codec, () => '2026-01-01T00:00:00.000Z');

    const result = await provider.search({ query: query(), queryFingerprint: 'query-fingerprint' });

    expect(result.status).toBe('partial');
    expect(result.items).toHaveLength(1);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['invalid-result-skipped', 'duplicate-result-removed']);
  });

  it('marks a non-empty page with no normalizable records as partial', async () => {
    const client = {
      searchWorks: jest.fn().mockResolvedValue({ meta: { count: 1, next_cursor: null }, results: [{ id: 'invalid' }] }),
    } as unknown as OpenAlexClient;
    const provider = new OpenAlexProvider(client, codec, () => '2026-01-01T00:00:00.000Z');

    const result = await provider.search({ query: query(), queryFingerprint: 'query-fingerprint' });

    expect(result.status).toBe('partial');
    expect(result.items).toEqual([]);
    expect(result.diagnostics).toEqual([{ code: 'invalid-result-skipped' }]);
  });

  it('encodes the provider next cursor and decodes it only inside the provider', async () => {
    const cursor = codec.encodeProviderCursor('openalex-next', 'query-fingerprint');
    const client = {
      searchWorks: jest.fn().mockResolvedValue({ meta: { count: 0, next_cursor: 'openalex-next' }, results: [] }),
    } as unknown as OpenAlexClient;
    const provider = new OpenAlexProvider(client, codec, () => '2026-01-01T00:00:00.000Z');

    const result = await provider.search({ query: query(cursor), queryFingerprint: 'query-fingerprint' });

    expect(client.searchWorks).toHaveBeenCalledWith({ text: 'graph neural networks', pageSize: 20, filters: undefined, providerCursor: 'openalex-next' });
    expect(result.status).toBe('empty');
    expect(result.nextCursor).toEqual(expect.any(String));
    expect(result.nextCursor).not.toBe('openalex-next');
    expect(JSON.stringify(result)).not.toContain('openalex-next');
  });
});
