import { ZoteroError } from './zotero.errors';
import type { ZoteroAttachmentDto, ZoteroConfig, ZoteroFileResponse, ZoteroItemDto, ZoteroItemsPage } from './zotero.types';

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

const DEFAULT_CONFIG: ZoteroConfig = {
  baseUrl: 'https://api.zotero.org', apiVersion: '3', timeoutMs: 10_000,
  maxRetries: 2, maxConcurrency: 4, maxFileBytes: 20 * 1024 * 1024,
};

export class ZoteroClient {
  private readonly config: ZoteroConfig;
  private readonly fetchImpl: FetchLike;
  private readonly retryDelayMs: number;

  constructor(options: Partial<ZoteroConfig> & { fetchImpl?: FetchLike; retryDelayMs?: number }) {
    this.config = { ...DEFAULT_CONFIG, ...options, baseUrl: (options.baseUrl ?? DEFAULT_CONFIG.baseUrl).replace(/\/$/u, '') };
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.retryDelayMs = options.retryDelayMs ?? 250;
  }

  async listItems(libraryId: string, apiKey: string, options?: { includeTrashed?: boolean }): Promise<ZoteroItemsPage> {
    const items: ZoteroItemDto[] = [];
    let nextUrl: string | undefined = this.url(`/users/${encodeURIComponent(libraryId)}/items`, options?.includeTrashed ? { includeTrashed: '1' } : undefined);
    let libraryVersion: string | undefined;
    while (nextUrl) {
      const response = await this.request(nextUrl, apiKey, 'json');
      const page = this.parseItems(response.body);
      items.push(...page);
      libraryVersion = response.headers.get('Last-Modified-Version') ?? libraryVersion;
      nextUrl = this.nextLink(response.headers.get('Link'));
    }
    return { items, ...(libraryVersion === undefined ? {} : { libraryVersion }) };
  }

  async getItem(libraryId: string, apiKey: string, itemKey: string, options?: { includeTrashed?: boolean }): Promise<ZoteroItemDto> {
    const response = await this.request(this.url(`/users/${encodeURIComponent(libraryId)}/items/${encodeURIComponent(itemKey)}`, options?.includeTrashed ? { includeTrashed: '1' } : undefined), apiKey, 'json');
    const body = response.body as Record<string, unknown>;
    if (!body || typeof body.key !== 'string' || typeof body.version !== 'number' || typeof body.itemType !== 'string' || !body.data) {
      throw new ZoteroError('ZOTERO_UPSTREAM_FAILED', 'The Zotero item response was invalid.');
    }
    return body as unknown as ZoteroItemDto;
  }

  async getChildren(libraryId: string, apiKey: string, itemKey: string, options?: { includeTrashed?: boolean }): Promise<ZoteroAttachmentDto[]> {
    const response = await this.request(this.url(`/users/${encodeURIComponent(libraryId)}/items/${encodeURIComponent(itemKey)}/children`, options?.includeTrashed ? { includeTrashed: '1' } : undefined), apiKey, 'json');
    return this.parseItems(response.body).filter((item) => item.itemType === 'attachment') as ZoteroAttachmentDto[];
  }

  async getFile(libraryId: string, apiKey: string, attachmentKey: string): Promise<ZoteroFileResponse> {
    const response = await this.request(this.url(`/users/${encodeURIComponent(libraryId)}/items/${encodeURIComponent(attachmentKey)}/file`), apiKey, 'bytes');
    const buffer = Buffer.from(response.body as ArrayBuffer);
    if (buffer.length > this.config.maxFileBytes) throw new ZoteroError('ZOTERO_ATTACHMENT_TOO_LARGE', 'The Zotero attachment exceeds the 20 MB size limit.');
    return { buffer, ...(response.headers.get('content-type') ? { contentType: response.headers.get('content-type')! } : {}), ...(response.headers.get('etag') ? { etag: response.headers.get('etag')! } : {}) };
  }

  async verifyLibraryRead(libraryId: string, apiKey: string): Promise<void> {
    await this.request(this.url(`/users/${encodeURIComponent(libraryId)}/items`, { limit: '1' }), apiKey, 'json');
  }

  async mapWithConcurrency<T, R>(values: T[], worker: (value: T) => Promise<R>): Promise<R[]> {
    const results = new Array<R>(values.length);
    let cursor = 0;
    const run = async () => {
      while (true) {
        const index = cursor++;
        if (index >= values.length) return;
        results[index] = await worker(values[index]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.config.maxConcurrency, values.length) }, run));
    return results;
  }

  private async request(url: string, apiKey: string, mode: 'json' | 'bytes'): Promise<{ body: unknown; headers: Headers }> {
    if (!apiKey) throw new ZoteroError('ZOTERO_INVALID_CREDENTIAL', 'The Zotero credential is invalid.');
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchImpl(url, { headers: { 'Zotero-API-Key': apiKey, 'Zotero-API-Version': '3' } });
      } catch {
        if (attempt < this.config.maxRetries) { await this.delay(this.backoff(attempt)); continue; }
        throw new ZoteroError('ZOTERO_UPSTREAM_TIMEOUT', 'The Zotero request timed out.');
      }
      if (response.ok) {
        return { body: mode === 'json' ? await response.json() : await response.arrayBuffer(), headers: response.headers };
      }
      if (response.status === 401 || response.status === 403) throw new ZoteroError('ZOTERO_INVALID_CREDENTIAL', 'The Zotero credential is invalid.');
      if (response.status === 404) throw new ZoteroError('ZOTERO_ITEM_NOT_FOUND', 'The Zotero item was not found.');
      if (response.status === 429 && attempt < this.config.maxRetries) { await this.delay(this.retryAfter(response.headers, attempt)); continue; }
      if ((response.status === 429 || response.status === 503) && attempt < this.config.maxRetries) { await this.delay(this.retryAfter(response.headers, attempt)); continue; }
      if (response.status === 429) throw new ZoteroError('ZOTERO_RATE_LIMITED', 'The Zotero request was rate limited.');
      throw new ZoteroError('ZOTERO_UPSTREAM_FAILED', 'The Zotero request failed.');
    }
    throw new ZoteroError('ZOTERO_UPSTREAM_FAILED', 'The Zotero request failed.');
  }

  private parseItems(body: unknown): ZoteroItemDto[] {
    if (!Array.isArray(body)) throw new ZoteroError('ZOTERO_UPSTREAM_FAILED', 'The Zotero item list response was invalid.');
    return body as ZoteroItemDto[];
  }

  private url(path: string, query?: Record<string, string>): string {
    const url = new URL(`${this.config.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
    return url.toString();
  }

  private nextLink(value: string | null): string | undefined {
    const match = value?.split(',').find((part) => /rel="next"/u.test(part));
    return match?.match(/<([^>]+)>/u)?.[1];
  }

  private retryAfter(headers: Headers, attempt: number): number {
    const seconds = Number(headers.get('Retry-After'));
    return Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds * 1000, 5_000) : this.backoff(attempt);
  }

  private backoff(attempt: number): number {
    return Math.min(this.retryDelayMs * (2 ** attempt), 5_000);
  }

  private async delay(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  }
}
