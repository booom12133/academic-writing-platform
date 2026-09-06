import { ZoteroClient } from './zotero.client';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

const itemWrapper = (key: string, version: number, data: Record<string, unknown>) => ({
  key,
  version,
  library: { type: 'user', id: '42' },
  links: {},
  meta: { creatorSummary: '' },
  data: { key, version, ...data },
});

describe('ZoteroClient', () => {
  it('uses v3 headers and follows item pagination without putting credentials in the URL', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = jest.fn(async (input: string | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return calls.length === 1
        ? jsonResponse([itemWrapper('A', 4, { title: 'A', itemType: 'journalArticle' })], 200, { 'Last-Modified-Version': '4', Link: '<https://api.zotero.org/users/42/items?start=1>; rel="next"' })
        : jsonResponse([itemWrapper('B', 5, { title: 'B', itemType: 'journalArticle' })], 200, { 'Last-Modified-Version': '5' });
    });
    const client = new ZoteroClient({ baseUrl: 'https://api.zotero.org', fetchImpl, retryDelayMs: 0 });

    await expect(client.listItems('42', 'secret-api-key')).resolves.toMatchObject({ items: [{ key: 'A' }, { key: 'B' }], libraryVersion: '5' });
    expect(calls.every(({ url }) => !url.includes('secret-api-key'))).toBe(true);
    expect(calls.every(({ init }) => (init?.headers as Record<string, string>)['Zotero-API-Key'] === 'secret-api-key')).toBe(true);
    expect(calls.every(({ init }) => (init?.headers as Record<string, string>)['Zotero-API-Version'] === '3')).toBe(true);
  });

  it('maps an official single bibliographic wrapper with data.itemType to the narrow DTO', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(itemWrapper('ITEM1', 7, { itemType: 'journalArticle', title: 'Study' })));
    const client = new ZoteroClient({ fetchImpl });

    await expect(client.getItem('42', 'secret-api-key', 'ITEM1')).resolves.toEqual({
      key: 'ITEM1', version: 7, itemType: 'journalArticle', data: { key: 'ITEM1', version: 7, itemType: 'journalArticle', title: 'Study' },
    });
  });

  it('maps an official single attachment wrapper with data.itemType to the narrow DTO', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(itemWrapper('ATT1', 8, { itemType: 'attachment', parentItem: 'ITEM1' })));
    const client = new ZoteroClient({ fetchImpl });

    await expect(client.getItem('42', 'secret-api-key', 'ATT1')).resolves.toMatchObject({
      key: 'ATT1', version: 8, itemType: 'attachment', data: { itemType: 'attachment', parentItem: 'ITEM1' },
    });
  });

  it('maps an official attachment wrapper and paginated children without exposing raw response shape', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(jsonResponse([itemWrapper('ATT1', 2, { itemType: 'attachment', parentItem: 'ITEM1' }), itemWrapper('NOTE1', 2, { itemType: 'note' })], 200, { Link: '<https://api.zotero.org/users/42/items/ITEM1/children?start=2>; rel="next"' }))
      .mockResolvedValueOnce(jsonResponse([itemWrapper('ATT2', 3, { itemType: 'attachment', parentItem: 'ITEM1' })]));
    const client = new ZoteroClient({ fetchImpl });

    await expect(client.getChildren('42', 'secret-api-key', 'ITEM1')).resolves.toEqual([
      expect.objectContaining({ key: 'ATT1', itemType: 'attachment' }),
      expect.objectContaining({ key: 'ATT2', itemType: 'attachment' }),
    ]);
  });

  it.each([
    {},
    { key: 'ITEM1', version: 1, data: {} },
    { key: 'ITEM1', version: 1, data: { itemType: 'journalArticle' } },
    [{ key: 'ITEM1', version: 1, itemType: 'journalArticle', data: {} }],
  ])('rejects malformed official item wrapper: %j', async (body) => {
    const client = new ZoteroClient({ fetchImpl: jest.fn().mockResolvedValue(jsonResponse(body)) });

    await expect(client.getItem('42', 'secret-api-key', 'ITEM1')).rejects.toMatchObject({ code: 'ZOTERO_UPSTREAM_FAILED' });
  });

  it('retries rate limits with a bounded Retry-After delay and maps the file response', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '0' } }))
      .mockResolvedValueOnce(new Response(Buffer.from('%PDF-1.4'), { status: 200, headers: { 'content-type': 'application/pdf', etag: '"etag-1"' } }));
    const client = new ZoteroClient({ baseUrl: 'https://api.zotero.org', fetchImpl, retryDelayMs: 0, maxRetries: 1 });

    await expect(client.getFile('42', 'secret-api-key', 'ATT')).resolves.toMatchObject({ etag: '"etag-1"' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('aborts each request attempt at the configured timeout and maps aborts safely', async () => {
    jest.useFakeTimers();
    try {
      const fetchImpl = jest.fn((_input: string | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
      }));
      const client = new ZoteroClient({ fetchImpl, timeoutMs: 25, maxRetries: 0 });
      const request = client.getItem('42', 'secret-api-key', 'ITEM1');
      const result = expect(request).rejects.toMatchObject({ code: 'ZOTERO_UPSTREAM_TIMEOUT' });

      await jest.advanceTimersByTimeAsync(25);
      await result;
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('respects a valid Backoff header from a successful response before the next request', async () => {
    let currentTime = 1_000;
    const now = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);
    const sleeps: number[] = [];
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(jsonResponse([itemWrapper('A', 1, { itemType: 'journalArticle' })], 200, { Backoff: '2', Link: '<https://api.zotero.org/users/42/items?start=1>; rel="next"' }))
      .mockResolvedValueOnce(jsonResponse([itemWrapper('B', 2, { itemType: 'journalArticle' })]));
    const client = new ZoteroClient({ fetchImpl, sleepImpl: async (milliseconds) => { sleeps.push(milliseconds); currentTime += milliseconds; }, maxRetries: 0 });

    try {
      await expect(client.listItems('42', 'secret-api-key')).resolves.toMatchObject({ items: [{ key: 'A' }, { key: 'B' }] });
      expect(sleeps).toEqual([2_000]);
    } finally {
      now.mockRestore();
    }
  });

  it('keeps all concurrent requests behind a shared Backoff deadline', async () => {
    jest.useFakeTimers();
    try {
      const fetchImpl = jest.fn()
        .mockResolvedValueOnce(jsonResponse(itemWrapper('A', 1, { itemType: 'journalArticle' }), 200, { Backoff: '2' }))
        .mockImplementation(() => Promise.resolve(jsonResponse(itemWrapper('B', 2, { itemType: 'journalArticle' }))));
      const client = new ZoteroClient({ fetchImpl, maxRetries: 0 });

      await client.getItem('42', 'secret-api-key', 'A');
      const left = client.getItem('42', 'secret-api-key', 'B');
      const right = client.getItem('42', 'secret-api-key', 'C');
      await Promise.resolve();
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1_999);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      await Promise.all([left, right]);
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it('extends the shared Backoff deadline when an in-flight response reports a longer Backoff', async () => {
    jest.useFakeTimers();
    try {
      let resolveEarly!: (response: Response) => void;
      const early = new Promise<Response>((resolve) => { resolveEarly = resolve; });
      const fetchImpl = jest.fn((input: string | URL) => {
        if (String(input).endsWith('/EARLY')) return early;
        if (String(input).endsWith('/A')) return Promise.resolve(jsonResponse(itemWrapper('A', 1, { itemType: 'journalArticle' }), 200, { Backoff: '2' }));
        return Promise.resolve(jsonResponse(itemWrapper('B', 2, { itemType: 'journalArticle' })));
      });
      const client = new ZoteroClient({ fetchImpl, maxRetries: 0 });

      const inFlight = client.getItem('42', 'secret-api-key', 'EARLY');
      await Promise.resolve();
      await client.getItem('42', 'secret-api-key', 'A');
      const waiting = client.getItem('42', 'secret-api-key', 'B');
      await Promise.resolve();
      expect(fetchImpl).toHaveBeenCalledTimes(2);

      resolveEarly(jsonResponse(itemWrapper('EARLY', 1, { itemType: 'journalArticle' }), 200, { Backoff: '4' }));
      await inFlight;
      await jest.advanceTimersByTimeAsync(2_000);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(2_000);
      await waiting;
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignores malformed Backoff while preserving bounded retry fallback', async () => {
    const sleeps: number[] = [];
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { Backoff: 'not-a-duration', 'Retry-After': 'not-a-duration' } }))
      .mockResolvedValueOnce(jsonResponse(itemWrapper('ITEM1', 1, { itemType: 'journalArticle' })));
    const client = new ZoteroClient({ fetchImpl, retryDelayMs: 7, sleepImpl: async (milliseconds) => { sleeps.push(milliseconds); }, maxRetries: 1 });

    await expect(client.getItem('42', 'secret-api-key', 'ITEM1')).resolves.toMatchObject({ key: 'ITEM1' });
    expect(sleeps).toEqual([7]);
  });

  it('falls back to bounded retry delay for a malformed Retry-After header', async () => {
    const sleeps: number[] = [];
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': 'not-a-duration' } }))
      .mockResolvedValueOnce(jsonResponse(itemWrapper('ITEM1', 1, { itemType: 'journalArticle' })));
    const client = new ZoteroClient({ fetchImpl, retryDelayMs: 7, sleepImpl: async (milliseconds) => { sleeps.push(milliseconds); }, maxRetries: 1 });

    await expect(client.getItem('42', 'secret-api-key', 'ITEM1')).resolves.toMatchObject({ key: 'ITEM1' });
    expect(sleeps).toEqual([7]);
  });

  it('respects Retry-After on a 503 response with bounded retry', async () => {
    const sleeps: number[] = [];
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(new Response('', { status: 503, headers: { 'Retry-After': '3' } }))
      .mockResolvedValueOnce(jsonResponse(itemWrapper('ITEM1', 1, { itemType: 'journalArticle' })));
    const client = new ZoteroClient({ fetchImpl, sleepImpl: async (milliseconds) => { sleeps.push(milliseconds); }, maxRetries: 1 });

    await expect(client.getItem('42', 'secret-api-key', 'ITEM1')).resolves.toMatchObject({ key: 'ITEM1' });
    expect(sleeps).toEqual([3_000]);
  });

  it('rejects an oversized Content-Length before reading the response body', async () => {
    const client = new ZoteroClient({
      maxFileBytes: 4,
      fetchImpl: jest.fn().mockResolvedValue(new Response('12345', { status: 200, headers: { 'content-length': '5' } })),
    });

    await expect(client.getFile('42', 'secret-api-key', 'ATT')).rejects.toMatchObject({ code: 'ZOTERO_ATTACHMENT_TOO_LARGE' });
  });

  it('aborts and rejects a chunked response as soon as the byte limit is exceeded', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.enqueue(new Uint8Array([4, 5, 6]));
        controller.close();
      },
    });
    const client = new ZoteroClient({
      maxFileBytes: 5,
      fetchImpl: jest.fn().mockResolvedValue(new Response(stream, { status: 200 })),
    });

    await expect(client.getFile('42', 'secret-api-key', 'ATT')).rejects.toMatchObject({ code: 'ZOTERO_ATTACHMENT_TOO_LARGE' });
  });

  it('rejects an exhausted upstream failure with a stable Zotero error code', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response('', { status: 503 }));
    const client = new ZoteroClient({ baseUrl: 'https://api.zotero.org', fetchImpl, retryDelayMs: 0, maxRetries: 1 });

    await expect(client.getItem('42', 'secret-api-key', 'MISSING')).rejects.toMatchObject({ code: 'ZOTERO_UPSTREAM_FAILED' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
