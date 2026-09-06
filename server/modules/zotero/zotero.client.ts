import { ZoteroError } from './zotero.errors';
import type { ZoteroAttachmentDto, ZoteroConfig, ZoteroFileResponse, ZoteroItemDto, ZoteroItemsPage } from './zotero.types';

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

const DEFAULT_CONFIG: ZoteroConfig = {
  baseUrl: 'https://api.zotero.org', apiVersion: '3', timeoutMs: 10_000,
  maxRetries: 2, maxConcurrency: 4, maxFileBytes: 20 * 1024 * 1024,
};
const MAX_PAGINATION_PAGES = 1000;

export class ZoteroClient {
  private readonly config: ZoteroConfig;
  private readonly fetchImpl: FetchLike;
  private readonly retryDelayMs: number;
  private readonly sleepImpl: (milliseconds: number) => Promise<void>;
  private backoffUntil = 0;

  constructor(options: Partial<ZoteroConfig> & { fetchImpl?: FetchLike; retryDelayMs?: number; sleepImpl?: (milliseconds: number) => Promise<void> }) {
    this.config = { ...DEFAULT_CONFIG, ...options, baseUrl: (options.baseUrl ?? DEFAULT_CONFIG.baseUrl).replace(/\/$/u, '') };
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.retryDelayMs = options.retryDelayMs ?? 250;
    this.sleepImpl = options.sleepImpl ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  }

  async listItems(libraryId: string, apiKey: string, options?: { includeTrashed?: boolean }): Promise<ZoteroItemsPage> {
    return this.paginateItems(this.url(`/users/${encodeURIComponent(libraryId)}/items`, options?.includeTrashed ? { includeTrashed: '1' } : undefined), apiKey);
  }

  async getItem(libraryId: string, apiKey: string, itemKey: string, options?: { includeTrashed?: boolean }): Promise<ZoteroItemDto> {
    const response = await this.request(this.url(`/users/${encodeURIComponent(libraryId)}/items/${encodeURIComponent(itemKey)}`, options?.includeTrashed ? { includeTrashed: '1' } : undefined), apiKey, 'json');
    return this.parseItem(response.body);
  }

  async getChildren(libraryId: string, apiKey: string, itemKey: string, options?: { includeTrashed?: boolean }): Promise<ZoteroAttachmentDto[]> {
    const page = await this.paginateItems(this.url(`/users/${encodeURIComponent(libraryId)}/items/${encodeURIComponent(itemKey)}/children`, options?.includeTrashed ? { includeTrashed: '1' } : undefined), apiKey);
    return page.items.filter((item) => item.itemType === 'attachment') as ZoteroAttachmentDto[];
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
      await this.waitForBackoff();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          headers: { 'Zotero-API-Key': apiKey, 'Zotero-API-Version': '3' },
          signal: controller.signal,
        });
        this.observeBackoff(response.headers);
        if (response.ok) {
          const body = mode === 'json' ? await response.json() : await this.readBoundedBytes(response, controller);
          return { body, headers: response.headers };
        }
        if (response.status === 401 || response.status === 403) throw new ZoteroError('ZOTERO_INVALID_CREDENTIAL', 'The Zotero credential is invalid.');
        if (response.status === 404) throw new ZoteroError('ZOTERO_ITEM_NOT_FOUND', 'The Zotero item was not found.');
        if ((response.status === 429 || response.status === 503) && attempt < this.config.maxRetries) {
          await this.delay(this.retryAfter(response.headers, attempt));
          continue;
        }
        if (response.status === 429) throw new ZoteroError('ZOTERO_RATE_LIMITED', 'The Zotero request was rate limited.');
        throw new ZoteroError('ZOTERO_UPSTREAM_FAILED', 'The Zotero request failed.');
      } catch (error) {
        if (error instanceof ZoteroError) throw error;
        if (attempt < this.config.maxRetries) {
          await this.delay(this.backoff(attempt));
          continue;
        }
        if (controller.signal.aborted) throw new ZoteroError('ZOTERO_UPSTREAM_TIMEOUT', 'The Zotero request timed out.');
        throw new ZoteroError('ZOTERO_UPSTREAM_FAILED', 'The Zotero request failed.');
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new ZoteroError('ZOTERO_UPSTREAM_FAILED', 'The Zotero request failed.');
  }

  private async readBoundedBytes(response: Response, controller: AbortController): Promise<Buffer> {
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > this.config.maxFileBytes) {
      throw new ZoteroError('ZOTERO_ATTACHMENT_TOO_LARGE', 'The Zotero attachment exceeds the configured size limit.');
    }
    if (!response.body) return Buffer.alloc(0);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > this.config.maxFileBytes) {
          controller.abort();
          try {
            await reader.cancel();
          } catch {
            // Preserve the size-limit error even if the upstream stream rejects cancellation.
          }
          throw new ZoteroError('ZOTERO_ATTACHMENT_TOO_LARGE', 'The Zotero attachment exceeds the configured size limit.');
        }
        chunks.push(next.value);
      }
    } finally {
      reader.releaseLock();
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  }

  private parseItems(body: unknown): ZoteroItemDto[] {
    if (!Array.isArray(body)) throw new ZoteroError('ZOTERO_UPSTREAM_FAILED', 'The Zotero item list response was invalid.');
    return body.map((item) => this.parseItem(item));
  }

  private async paginateItems(initialUrl: string, apiKey: string): Promise<ZoteroItemsPage> {
    const items: ZoteroItemDto[] = [];
    let nextUrl: string | undefined = initialUrl;
    let libraryVersion: string | undefined;
    for (let pageCount = 0; nextUrl; pageCount += 1) {
      if (pageCount >= MAX_PAGINATION_PAGES) throw new ZoteroError('ZOTERO_UPSTREAM_FAILED', 'The Zotero item pagination exceeded the safety limit.');
      const response = await this.request(nextUrl, apiKey, 'json');
      items.push(...this.parseItems(response.body));
      libraryVersion = response.headers.get('Last-Modified-Version') ?? libraryVersion;
      nextUrl = this.nextLink(response.headers.get('Link'));
    }
    return { items, ...(libraryVersion === undefined ? {} : { libraryVersion }) };
  }

  private parseItem(body: unknown): ZoteroItemDto {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ZoteroError('ZOTERO_UPSTREAM_FAILED', 'The Zotero item response was invalid.');
    }
    const wrapper = body as { key?: unknown; version?: unknown; data?: unknown };
    if (typeof wrapper.key !== 'string' || !wrapper.key || typeof wrapper.version !== 'number' || !Number.isSafeInteger(wrapper.version)) {
      throw new ZoteroError('ZOTERO_UPSTREAM_FAILED', 'The Zotero item response was invalid.');
    }
    if (!wrapper.data || typeof wrapper.data !== 'object' || Array.isArray(wrapper.data)) {
      throw new ZoteroError('ZOTERO_UPSTREAM_FAILED', 'The Zotero item response was invalid.');
    }
    const data = wrapper.data as Record<string, unknown>;
    if (data.key !== wrapper.key || data.version !== wrapper.version || typeof data.itemType !== 'string' || !data.itemType) {
      throw new ZoteroError('ZOTERO_UPSTREAM_FAILED', 'The Zotero item response was invalid.');
    }
    return { key: wrapper.key, version: wrapper.version, itemType: data.itemType, data };
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

  private observeBackoff(headers: Headers): void {
    const seconds = Number(headers.get('Backoff'));
    if (!Number.isFinite(seconds) || seconds < 0) return;
    this.backoffUntil = Math.max(this.backoffUntil, Date.now() + Math.min(seconds * 1000, 5_000));
  }

  private async waitForBackoff(): Promise<void> {
    const remaining = this.backoffUntil - Date.now();
    if (remaining <= 0) {
      this.backoffUntil = 0;
      return;
    }
    const until = this.backoffUntil;
    this.backoffUntil = 0;
    await this.delay(Math.min(remaining, 5_000));
    if (this.backoffUntil === until) this.backoffUntil = 0;
  }

  private backoff(attempt: number): number {
    return Math.min(this.retryDelayMs * (2 ** attempt), 5_000);
  }

  private async delay(milliseconds: number): Promise<void> {
    if (milliseconds <= 0) return;
    await this.sleepImpl(milliseconds);
  }
}
