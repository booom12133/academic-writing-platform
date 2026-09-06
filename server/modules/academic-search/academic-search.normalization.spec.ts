import {
  deduplicateAcademicResults,
  normalizeDoi,
  normalizeOpenAlexWork,
  rebuildOpenAlexAbstract,
} from './academic-search.normalization';
import type { AcademicSearchResult } from './academic-search.types';

const fingerprint = 'query-fingerprint';
const retrievedAt = '2026-01-01T00:00:00.000Z';

function rawWork(overrides: Record<string, unknown> = {}) {
  return {
    id: 'https://openalex.org/W123',
    title: 'A normalized title',
    authorships: [{ author: { id: 'https://openalex.org/A1', display_name: 'Ada Lovelace', orcid: 'https://orcid.org/0000-0001-2345-6789' } }],
    publication_date: '2024-05-06',
    publication_year: 2024,
    primary_location: { landing_page_url: 'https://publisher.test/work', pdf_url: 'https://publisher.test/work.pdf', source: { display_name: 'Journal of Tests' } },
    type: 'article',
    cited_by_count: 7,
    open_access: { is_oa: true },
    doi: 'https://doi.org/10.1234/ABC.1.',
    abstract_inverted_index: { A: [0], normalized: [1], title: [2] },
    ...overrides,
  };
}

function result(overrides: Partial<AcademicSearchResult> = {}): AcademicSearchResult {
  return {
    provider: 'openalex',
    externalRecordId: 'https://openalex.org/W1',
    title: 'A normalized title',
    authors: [{ name: 'Ada Lovelace' }],
    publicationYear: 2024,
    doi: '10.1234/example',
    provenance: {
      provider: 'openalex',
      externalRecordId: 'https://openalex.org/W1',
      canonicalUrl: 'https://openalex.org/W1',
      retrievedAt,
      providerRank: 1,
      queryFingerprint: fingerprint,
      verificationStatus: 'observed',
    },
    ...overrides,
  };
}

describe('academic search normalization', () => {
  it('normalizes an OpenAlex work and emits complete observed provenance', () => {
    expect(normalizeOpenAlexWork(rawWork(), 3, fingerprint, retrievedAt)).toEqual({
      provider: 'openalex',
      externalRecordId: 'https://openalex.org/W123',
      title: 'A normalized title',
      authors: [{ name: 'Ada Lovelace', orcid: 'https://orcid.org/0000-0001-2345-6789', externalId: 'https://openalex.org/A1' }],
      publicationDate: '2024-05-06',
      publicationYear: 2024,
      venue: 'Journal of Tests',
      doi: '10.1234/abc.1',
      abstract: 'A normalized title',
      workType: 'article',
      citedByCount: 7,
      isOpenAccess: true,
      landingPageUrl: 'https://publisher.test/work',
      pdfUrl: 'https://publisher.test/work.pdf',
      provenance: {
        provider: 'openalex',
        externalRecordId: 'https://openalex.org/W123',
        canonicalUrl: 'https://openalex.org/W123',
        retrievedAt,
        providerRank: 3,
        queryFingerprint: fingerprint,
        verificationStatus: 'observed',
      },
    });
  });

  it('rebuilds an inverted-index abstract in position order and tolerates missing input', () => {
    expect(rebuildOpenAlexAbstract({ second: [1], first: [0] })).toBe('first second');
    expect(rebuildOpenAlexAbstract(undefined)).toBeUndefined();
    expect(rebuildOpenAlexAbstract({ broken: ['not-a-position'] } as never)).toBeUndefined();
  });

  it('normalizes only valid DOI values', () => {
    expect(normalizeDoi(' DOI: https://doi.org/10.1234/ABC.1. ')).toBe('10.1234/abc.1');
    expect(normalizeDoi('http://dx.doi.org/10.5555/xyz')).toBe('10.5555/xyz');
    expect(normalizeDoi('not-a-doi')).toBeUndefined();
    expect(normalizeDoi(undefined)).toBeUndefined();
  });

  it('deduplicates records by normalized DOI exact independently', () => {
    const records = [
      result({ externalRecordId: 'https://openalex.org/W1', doi: '10.1234/SAME' }),
      result({ externalRecordId: 'https://openalex.org/W2', title: 'Different title', doi: 'https://doi.org/10.1234/same' }),
    ];

    expect(deduplicateAcademicResults(records)).toHaveLength(1);
  });

  it('deduplicates records by same provider and external record ID exact independently', () => {
    const records = [
      result({ externalRecordId: 'https://openalex.org/W1', doi: undefined }),
      result({ externalRecordId: 'https://openalex.org/W1', title: 'Different title', doi: undefined }),
    ];

    expect(deduplicateAcademicResults(records)).toHaveLength(1);
  });

  it('deduplicates records by strong normalized title, year, and first-author fingerprint', () => {
    const records = [
      result({ externalRecordId: 'https://openalex.org/W1', doi: undefined, title: 'A NORMALIZED: title', authors: [{ name: 'Ada Lovelace' }] }),
      result({ externalRecordId: 'https://openalex.org/W2', doi: undefined, title: 'a normalized title', authors: [{ name: 'Ada Lovelace' }] }),
    ];

    expect(deduplicateAcademicResults(records)).toHaveLength(1);
  });

  it('does not deduplicate by title alone, author alone, or fuzzy similarity', () => {
    const records = [
      result({ externalRecordId: 'https://openalex.org/W1', doi: undefined, publicationYear: undefined }),
      result({ externalRecordId: 'https://openalex.org/W2', doi: undefined, publicationYear: undefined, title: 'A normalized title' }),
      result({ externalRecordId: 'https://openalex.org/W3', doi: undefined, title: 'Unrelated title', authors: [{ name: 'Ada Lovelace' }] }),
      result({ externalRecordId: 'https://openalex.org/W4', doi: undefined, title: 'A normalized title with extra words' }),
    ];

    expect(deduplicateAcademicResults(records)).toHaveLength(4);
  });
});
