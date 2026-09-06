import type { AcademicSearchCursorCodec } from './academic-search.cursor';
import { deduplicateAcademicResults, normalizeOpenAlexWork } from './academic-search.normalization';
import { OpenAlexClient } from './openalex.client';
import type { AcademicDiscoverySet, AcademicSearchQuery } from './academic-search.types';
import type { AcademicSearchProvider } from './academic-search.provider';

export class OpenAlexProvider implements AcademicSearchProvider {
  constructor(
    private readonly client: OpenAlexClient,
    private readonly cursorCodec: AcademicSearchCursorCodec,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async search(input: { query: AcademicSearchQuery; queryFingerprint: string }): Promise<AcademicDiscoverySet> {
    const providerCursor = input.query.cursor
      ? this.cursorCodec.decodeProviderCursor(input.query.cursor, input.queryFingerprint)
      : '*';
    const page = await this.client.searchWorks({
      text: input.query.text,
      filters: input.query.filters,
      pageSize: input.query.pageSize ?? 20,
      providerCursor,
    });
    const retrievedAt = this.now();
    const diagnostics: AcademicDiscoverySet['diagnostics'] = [];
    const normalized = page.results.flatMap((work, index) => {
      const result = normalizeOpenAlexWork(work, index + 1, input.queryFingerprint, retrievedAt);
      if (!result) {
        diagnostics.push({ code: 'invalid-result-skipped' });
        return [];
      }
      return [result];
    });
    const deduplicated = deduplicateAcademicResults(normalized);
    for (let index = deduplicated.length; index < normalized.length; index += 1) diagnostics.push({ code: 'duplicate-result-removed' });
    const nextCursor = page.meta.next_cursor
      ? this.cursorCodec.encodeProviderCursor(page.meta.next_cursor, input.queryFingerprint)
      : undefined;
    const status = diagnostics.length ? 'partial' : deduplicated.length === 0 ? 'empty' : 'complete';
    return {
      provider: 'openalex',
      status,
      items: deduplicated,
      totalCount: page.meta.count,
      ...(nextCursor ? { nextCursor } : {}),
      diagnostics,
      provenance: { provider: 'openalex', queryFingerprint: input.queryFingerprint, retrievedAt },
    };
  }
}
