import { AcademicSearchError } from './academic-search.errors';
import type { AcademicSearchConfig } from './academic-search.config';
import type { OpenAlexPage } from './openalex.types';

export interface FetchLike {
  (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }): Promise<{
    ok: boolean;
    status: number;
    headers: Headers;
    json(): Promise<unknown>;
  }>;
}

const SELECT_FIELDS = [
  'id', 'title', 'authorships', 'publication_date', 'publication_year',
  'primary_location', 'type', 'cited_by_count', 'open_access', 'doi', 'abstract_inverted_index',
].join(',');

interface SearchWorksInput {
  text: string;
  filters?: {
    fromPublicationDate?: string;
    toPublicationDate?: string;
    publicationYear?: number;
    workType?: string;
    isOpenAccess?: boolean;
  };
  pageSize: number;
  providerCursor?: string;
}

export class OpenAlexClient {
  constructor(
    private readonly config: AcademicSearchConfig,
    private readonly fetchImpl: FetchLike = ((url, init) => fetch(url, init as RequestInit)),
    private readonly sleepImpl: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {}

  async searchWorks(input: SearchWorksInput): Promise<OpenAlexPage> {
    const url = this.buildUrl(input);
    const deadline = Date.now() + this.config.timeoutMs;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw this.timeoutError();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), remaining);
      try {
        const response = await this.fetchImpl(url, {
          headers: this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {},
          signal: controller.signal,
        });
        if (response.ok) {
          return await this.parsePage(response);
        }
        if (response.status === 429) {
          const retryAfterMs = this.retryAfterMs(response.headers, attempt);
          if (attempt < this.config.maxRetries && Date.now() + retryAfterMs < deadline) {
            await this.sleepImpl(retryAfterMs);
            continue;
          }
          throw new AcademicSearchError('ACADEMIC_SEARCH_RATE_LIMITED', 'The academic search provider is rate limited.', retryAfterMs);
        }
        if (response.status === 503 && attempt < this.config.maxRetries && Date.now() + this.backoffMs(attempt) < deadline) {
          await this.sleepImpl(this.backoffMs(attempt));
          continue;
        }
        throw new AcademicSearchError('ACADEMIC_SEARCH_PROVIDER_UNAVAILABLE', 'The academic search provider is unavailable.');
      } catch (error) {
        if (error instanceof AcademicSearchError) throw error;
        if (controller.signal.aborted) {
          if (attempt < this.config.maxRetries && Date.now() < deadline) continue;
          throw this.timeoutError();
        }
        const backoffMs = this.backoffMs(attempt);
        if (attempt < this.config.maxRetries && Date.now() + backoffMs < deadline) {
          await this.sleepImpl(backoffMs);
          continue;
        }
        throw new AcademicSearchError('ACADEMIC_SEARCH_PROVIDER_UNAVAILABLE', 'The academic search provider is unavailable.');
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new AcademicSearchError('ACADEMIC_SEARCH_PROVIDER_UNAVAILABLE', 'The academic search provider is unavailable.');
  }

  private buildUrl(input: SearchWorksInput): string {
    const url = new URL(`${this.config.baseUrl.replace(/\/$/u, '')}/works`);
    url.searchParams.set('search', input.text);
    url.searchParams.set('per-page', String(Math.min(Math.max(input.pageSize, 1), this.config.maxPageSize)));
    url.searchParams.set('select', SELECT_FIELDS);
    const filterValues = [
      input.filters?.fromPublicationDate ? `from_publication_date:${input.filters.fromPublicationDate}` : undefined,
      input.filters?.toPublicationDate ? `to_publication_date:${input.filters.toPublicationDate}` : undefined,
      input.filters?.publicationYear === undefined ? undefined : `publication_year:${input.filters.publicationYear}`,
      input.filters?.workType ? `type:${input.filters.workType}` : undefined,
      input.filters?.isOpenAccess === undefined ? undefined : `open_access.is_oa:${String(input.filters.isOpenAccess)}`,
    ].filter((value): value is string => value !== undefined);
    if (filterValues.length) url.searchParams.set('filter', filterValues.join(','));
    if (input.providerCursor) url.searchParams.set('cursor', input.providerCursor);
    return url.toString();
  }

  private async parsePage(response: { json(): Promise<unknown> }): Promise<OpenAlexPage> {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new AcademicSearchError('ACADEMIC_SEARCH_INVALID_RESPONSE', 'The academic search provider response was invalid.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw this.invalidResponse();
    const value = body as { meta?: unknown; results?: unknown };
    if (!value.meta || typeof value.meta !== 'object' || Array.isArray(value.meta) || !Array.isArray(value.results)) throw this.invalidResponse();
    const meta = value.meta as { count?: unknown; next_cursor?: unknown };
    if (!Number.isSafeInteger(meta.count) || (meta.count as number) < 0 || (meta.next_cursor !== null && typeof meta.next_cursor !== 'string')) throw this.invalidResponse();
    if (value.results.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) throw this.invalidResponse();
    return { meta: { count: meta.count as number, next_cursor: meta.next_cursor as string | null }, results: value.results as OpenAlexPage['results'] };
  }

  private retryAfterMs(headers: Headers, attempt: number): number {
    const raw = headers.get('Retry-After');
    const seconds = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(seconds) && seconds >= 0 && seconds <= 60 ? seconds * 1_000 : this.backoffMs(attempt);
  }

  private backoffMs(attempt: number): number {
    return Math.min(this.config.retryDelayMs * (2 ** attempt), 5_000);
  }

  private invalidResponse(): AcademicSearchError {
    return new AcademicSearchError('ACADEMIC_SEARCH_INVALID_RESPONSE', 'The academic search provider response was invalid.');
  }

  private timeoutError(): AcademicSearchError {
    return new AcademicSearchError('ACADEMIC_SEARCH_TIMEOUT', 'The academic search provider request timed out.');
  }
}
