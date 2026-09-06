import { ZoteroClient } from './zotero.client';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

describe('ZoteroClient', () => {
  it('uses v3 headers and follows item pagination without putting credentials in the URL', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = jest.fn(async (input: string | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return calls.length === 1
        ? jsonResponse([{ key: 'A', version: 4, data: { title: 'A' }, itemType: 'journalArticle' }], 200, { 'Last-Modified-Version': '4', Link: '<https://api.zotero.org/users/42/items?start=1>; rel="next"' })
        : jsonResponse([{ key: 'B', version: 5, data: { title: 'B' }, itemType: 'journalArticle' }], 200, { 'Last-Modified-Version': '5' });
    });
    const client = new ZoteroClient({ baseUrl: 'https://api.zotero.org', fetchImpl, retryDelayMs: 0 });

    await expect(client.listItems('42', 'secret-api-key')).resolves.toMatchObject({ items: [{ key: 'A' }, { key: 'B' }], libraryVersion: '5' });
    expect(calls.every(({ url }) => !url.includes('secret-api-key'))).toBe(true);
    expect(calls.every(({ init }) => (init?.headers as Record<string, string>)['Zotero-API-Key'] === 'secret-api-key')).toBe(true);
    expect(calls.every(({ init }) => (init?.headers as Record<string, string>)['Zotero-API-Version'] === '3')).toBe(true);
  });

  it('retries rate limits with a bounded Retry-After delay and maps the file response', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '0' } }))
      .mockResolvedValueOnce(new Response(Buffer.from('%PDF-1.4'), { status: 200, headers: { 'content-type': 'application/pdf', etag: '"etag-1"' } }));
    const client = new ZoteroClient({ baseUrl: 'https://api.zotero.org', fetchImpl, retryDelayMs: 0, maxRetries: 1 });

    await expect(client.getFile('42', 'secret-api-key', 'ATT')).resolves.toMatchObject({ etag: '"etag-1"' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects an exhausted upstream failure with a stable Zotero error code', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response('', { status: 503 }));
    const client = new ZoteroClient({ baseUrl: 'https://api.zotero.org', fetchImpl, retryDelayMs: 0, maxRetries: 1 });

    await expect(client.getItem('42', 'secret-api-key', 'MISSING')).rejects.toMatchObject({ code: 'ZOTERO_UPSTREAM_FAILED' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
