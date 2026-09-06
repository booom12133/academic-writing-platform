import { createHash } from 'node:crypto';
import { AcademicSearchError } from './academic-search.errors';
import type { AcademicSearchConfig } from './academic-search.config';
import type { AcademicSearchCursorCodec } from './academic-search.cursor';
import type { AcademicSearchProvider } from './academic-search.provider';
import type { AcademicDiscoverySet, AcademicSearchQuery, AcademicSearchRequest } from './academic-search.types';

const REQUEST_KEYS = new Set(['q', 'fromPublicationDate', 'toPublicationDate', 'publicationYear', 'workType', 'isOpenAccess', 'pageSize', 'cursor']);

export function computeAcademicQueryFingerprint(query: Omit<AcademicSearchQuery, 'cursor'>): string {
  return createHash('sha256').update(JSON.stringify(query)).digest('hex');
}

export class AcademicSearchService {
  constructor(
    private readonly provider: AcademicSearchProvider,
    private readonly cursorCodec: AcademicSearchCursorCodec,
    private readonly config: AcademicSearchConfig,
  ) {}

  async search(request: AcademicSearchRequest, userId: string): Promise<AcademicDiscoverySet> {
    if (!userId || typeof userId !== 'string') throw this.invalidQuery();
    if (!request || typeof request !== 'object' || Array.isArray(request)) throw this.invalidQuery();
    const record = request as unknown as Record<string, unknown>;
    if (Object.keys(record).some((key) => !REQUEST_KEYS.has(key))) throw this.invalidQuery();
    if (typeof record.q !== 'string') throw this.invalidQuery();
    const text = record.q.trim();
    if (!text || [...text].length > 512) throw this.invalidQuery();
    this.validateDate(record.fromPublicationDate);
    this.validateDate(record.toPublicationDate);
    if (record.fromPublicationDate && record.toPublicationDate && record.fromPublicationDate > record.toPublicationDate) throw this.invalidQuery();
    if (record.publicationYear !== undefined && (!Number.isSafeInteger(record.publicationYear) || (record.publicationYear as number) < 1000 || (record.publicationYear as number) > 9999)) throw this.invalidQuery();
    if (record.workType !== undefined && (typeof record.workType !== 'string' || !record.workType.trim())) throw this.invalidQuery();
    if (record.isOpenAccess !== undefined && typeof record.isOpenAccess !== 'boolean') throw this.invalidQuery();
    if (record.pageSize !== undefined && (!Number.isSafeInteger(record.pageSize) || (record.pageSize as number) < 1 || (record.pageSize as number) > 100)) throw this.invalidQuery();
    if (record.cursor !== undefined && (typeof record.cursor !== 'string' || !record.cursor || record.cursor.length > 4096)) throw this.invalidCursor();

    const filters = {
      ...(record.fromPublicationDate ? { fromPublicationDate: record.fromPublicationDate as string } : {}),
      ...(record.toPublicationDate ? { toPublicationDate: record.toPublicationDate as string } : {}),
      ...(record.publicationYear === undefined ? {} : { publicationYear: record.publicationYear as number }),
      ...(record.workType ? { workType: (record.workType as string).trim() } : {}),
      ...(record.isOpenAccess === undefined ? {} : { isOpenAccess: record.isOpenAccess as boolean }),
    };
    const query: AcademicSearchQuery = {
      text,
      pageSize: (record.pageSize as number | undefined) ?? this.config.defaultPageSize,
      filters: Object.keys(filters).length ? filters : undefined,
      cursor: record.cursor as AcademicSearchQuery['cursor'] | undefined,
    };
    const queryForFingerprint: Omit<AcademicSearchQuery, 'cursor'> = {
      text: query.text,
      pageSize: query.pageSize,
      filters: query.filters,
    };
    const queryFingerprint = computeAcademicQueryFingerprint(queryForFingerprint);
    if (query.cursor) this.cursorCodec.validate(query.cursor, queryFingerprint);
    return this.provider.search({ query, queryFingerprint });
  }

  private validateDate(value: unknown): void {
    if (value === undefined) return;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw this.invalidQuery();
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw this.invalidQuery();
  }

  private invalidQuery(): AcademicSearchError {
    return new AcademicSearchError('ACADEMIC_SEARCH_INVALID_QUERY', 'The academic search query is invalid.');
  }

  private invalidCursor(): AcademicSearchError {
    return new AcademicSearchError('ACADEMIC_SEARCH_CURSOR_INVALID', 'The academic search cursor is invalid.');
  }
}
