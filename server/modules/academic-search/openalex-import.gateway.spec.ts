import { OpenAlexImportGateway } from './openalex-import.gateway';

describe('OpenAlexImportGateway PDF safety boundary', () => {
  const client = { getWork: jest.fn() };

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('accepts only the authoritative work that matches the requested OpenAlex identifier', async () => {
    client.getWork.mockResolvedValue({
      id: 'https://openalex.org/W999',
      title: 'Wrong work',
      authorships: [],
      updated_date: '2026-09-18T00:00:00.000Z',
    });
    const gateway = new OpenAlexImportGateway(client as never);

    await expect(gateway.resolveWork('W123')).rejects.toMatchObject({ code: 'ACADEMIC_SEARCH_INVALID_RESPONSE' });
  });

  it('requires an authoritative OpenAlex updated_date for stable external versioning', async () => {
    client.getWork.mockResolvedValue({
      id: 'https://openalex.org/W123',
      title: 'Missing version',
      authorships: [],
      updated_date: 'not-a-date',
    });
    const gateway = new OpenAlexImportGateway(client as never);

    await expect(gateway.resolveWork('W123')).rejects.toMatchObject({ code: 'ACADEMIC_SEARCH_INVALID_RESPONSE' });
  });

  it.each([
    'http://papers.example/paper.pdf',
    'https://user:password@papers.example/paper.pdf',
    'https://papers.example:8443/paper.pdf',
  ])('rejects an unsafe PDF URL before lookup or fetch: %s', async (pdfUrl) => {
    const fetchImpl = jest.fn();
    const lookupImpl = jest.fn();
    const gateway = new OpenAlexImportGateway(client as never, fetchImpl as never, lookupImpl);
    await expect(gateway.fetchPdf(pdfUrl)).resolves.toEqual({ kind: 'invalid-pdf' });
    expect(lookupImpl).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects private destinations before sending a request', async () => {
    const fetchImpl = jest.fn();
    const gateway = new OpenAlexImportGateway(client as never, fetchImpl as never, async () => [{ address: '127.0.0.1', family: 4 }]);
    await expect(gateway.fetchPdf('https://papers.example/paper.pdf')).resolves.toEqual({ kind: 'invalid-pdf' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('accepts only a bounded response with a PDF signature', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response(Buffer.from('%PDF-safe-fixture'), { status: 200, headers: { 'content-type': 'application/pdf', 'content-length': '17' } }));
    const gateway = new OpenAlexImportGateway(client as never, fetchImpl as never, async () => [{ address: '93.184.216.34', family: 4 }]);
    const result = await gateway.fetchPdf('https://papers.example/paper.pdf');
    expect(result).toMatchObject({ kind: 'downloaded' });
    expect(fetchImpl).toHaveBeenCalledWith(expect.any(URL), expect.any(Object), { address: '93.184.216.34', family: 4 });
  });

  it('revalidates redirect destinations and rejects redirects to private networks', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://private.example/file.pdf' } }));
    const gateway = new OpenAlexImportGateway(client as never, fetchImpl as never, async (hostname) => [{ address: hostname === 'private.example' ? '10.0.0.2' : '93.184.216.34', family: 4 }]);
    await expect(gateway.fetchPdf('https://papers.example/paper.pdf')).resolves.toEqual({ kind: 'invalid-pdf' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('accepts safe octet-stream PDFs but rejects oversized, wrong-type, and unsigned responses', async () => {
    const lookupImpl = async () => [{ address: '93.184.216.34', family: 4 }];
    const safe = new OpenAlexImportGateway(client as never, jest.fn().mockResolvedValue(
      new Response(Buffer.from('%PDF-safe'), { status: 200, headers: { 'content-type': 'application/octet-stream' } }),
    ) as never, lookupImpl);
    await expect(safe.fetchPdf('https://papers.example/paper.pdf')).resolves.toMatchObject({ kind: 'downloaded' });

    const oversized = new OpenAlexImportGateway(client as never, jest.fn().mockResolvedValue(
      new Response(null, { status: 200, headers: { 'content-type': 'application/pdf', 'content-length': String(20 * 1024 * 1024 + 1) } }),
    ) as never, lookupImpl);
    await expect(oversized.fetchPdf('https://papers.example/paper.pdf')).resolves.toEqual({ kind: 'invalid-pdf' });

    const rejectedBodyCancel = jest.fn();
    const rejectedBody = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(Buffer.from('%PDF-safe')); },
      cancel: rejectedBodyCancel,
    });
    const wrongType = new OpenAlexImportGateway(client as never, jest.fn().mockResolvedValue(
      new Response(rejectedBody, { status: 200, headers: { 'content-type': 'text/html' } }),
    ) as never, lookupImpl);
    await expect(wrongType.fetchPdf('https://papers.example/paper.pdf')).resolves.toEqual({ kind: 'invalid-pdf' });
    expect(rejectedBodyCancel).toHaveBeenCalledTimes(1);

    const unsigned = new OpenAlexImportGateway(client as never, jest.fn().mockResolvedValue(
      new Response(Buffer.from('not-a-pdf'), { status: 200, headers: { 'content-type': 'application/pdf' } }),
    ) as never, lookupImpl);
    await expect(unsigned.fetchPdf('https://papers.example/paper.pdf')).resolves.toEqual({ kind: 'invalid-pdf' });
  });

  it('caps redirect hops', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: '/next.pdf' } }));
    const gateway = new OpenAlexImportGateway(client as never, fetchImpl as never, async () => [{ address: '93.184.216.34', family: 4 }]);
    await expect(gateway.fetchPdf('https://papers.example/paper.pdf')).resolves.toEqual({ kind: 'unavailable' });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('cancels a stream that crosses the 20 MiB limit', async () => {
    const cancel = jest.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(20 * 1024 * 1024 + 1));
      },
      cancel,
    });
    const gateway = new OpenAlexImportGateway(client as never, jest.fn().mockResolvedValue(
      new Response(body, { status: 200, headers: { 'content-type': 'application/pdf' } }),
    ) as never, async () => [{ address: '93.184.216.34', family: 4 }]);
    await expect(gateway.fetchPdf('https://papers.example/paper.pdf')).resolves.toEqual({ kind: 'invalid-pdf' });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('uses one bounded deadline for a stalled fetch', async () => {
    jest.useFakeTimers();
    const fetchImpl = jest.fn((_url: unknown, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const gateway = new OpenAlexImportGateway(client as never, fetchImpl as never, async () => [{ address: '93.184.216.34', family: 4 }]);
    const pending = gateway.fetchPdf('https://papers.example/paper.pdf');
    await jest.advanceTimersByTimeAsync(15_000);
    await expect(pending).resolves.toEqual({ kind: 'unavailable' });
  });

  it('rejects IPv4-mapped IPv6 and non-public documentation ranges', async () => {
    const fetchImpl = jest.fn();
    const mapped = new OpenAlexImportGateway(client as never, fetchImpl as never, async () => [{ address: '::ffff:127.0.0.1', family: 6 }]);
    const documentation = new OpenAlexImportGateway(client as never, fetchImpl as never, async () => [{ address: '203.0.113.10', family: 4 }]);
    await expect(mapped.fetchPdf('https://papers.example/paper.pdf')).resolves.toEqual({ kind: 'invalid-pdf' });
    await expect(documentation.fetchPdf('https://papers.example/paper.pdf')).resolves.toEqual({ kind: 'invalid-pdf' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
