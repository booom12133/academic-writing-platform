import type { AcademicSearchResult } from './academic-search.types';

export interface OpenAlexWorkLike {
  id?: unknown;
  title?: unknown;
  authorships?: unknown;
  publication_date?: unknown;
  publication_year?: unknown;
  primary_location?: unknown;
  type?: unknown;
  cited_by_count?: unknown;
  open_access?: unknown;
  doi?: unknown;
  abstract_inverted_index?: unknown;
  updated_date?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function normalizeDoi(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  let normalized = value.trim().toLowerCase();
  normalized = normalized.replace(/^doi:\s*/u, '');
  normalized = normalized.replace(/^https?:\/\/(?:dx\.)?doi\.org\//u, '');
  normalized = normalized.replace(/[.,;:]+$/u, '');
  return /^10\.\d{4,9}\/\S+$/u.test(normalized) ? normalized : undefined;
}

export function rebuildOpenAlexAbstract(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(value)) {
    if (!Array.isArray(positions)) return undefined;
    for (const position of positions) {
      if (!Number.isSafeInteger(position) || (position as number) < 0) return undefined;
      words[position as number] = word;
    }
  }
  if (words.length === 0 || words.some((word) => typeof word !== 'string')) return undefined;
  return words.join(' ');
}

function normalizeAuthors(value: unknown): AcademicSearchResult['authors'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry) || !isRecord(entry.author)) return [];
    const author = entry.author;
    const name = optionalString(author.display_name);
    if (!name) return [];
    return [{
      name,
      ...(optionalString(author.orcid) ? { orcid: optionalString(author.orcid) } : {}),
      ...(optionalString(author.id) ? { externalId: optionalString(author.id) } : {}),
    }];
  });
}

export function normalizeOpenAlexWork(
  value: unknown,
  providerRank: number,
  queryFingerprint: string,
  retrievedAt: string,
): AcademicSearchResult | undefined {
  if (!isRecord(value) || !Number.isSafeInteger(providerRank) || providerRank < 1) return undefined;
  const work = value as OpenAlexWorkLike;
  const externalRecordId = optionalString(work.id);
  const title = optionalString(work.title);
  if (!externalRecordId || !title) return undefined;

  const primaryLocation = isRecord(work.primary_location) ? work.primary_location : {};
  const source = isRecord(primaryLocation.source) ? primaryLocation.source : {};
  const publicationYear = Number.isSafeInteger(work.publication_year) ? work.publication_year as number : undefined;
  const citedByCount = Number.isSafeInteger(work.cited_by_count) && (work.cited_by_count as number) >= 0
    ? work.cited_by_count as number
    : undefined;
  const canonicalUrl = externalRecordId;
  const result: AcademicSearchResult = {
    provider: 'openalex',
    externalRecordId,
    title,
    authors: normalizeAuthors(work.authorships),
    ...(optionalString(work.publication_date) ? { publicationDate: optionalString(work.publication_date) } : {}),
    ...(publicationYear === undefined ? {} : { publicationYear }),
    ...(optionalString(source.display_name) ? { venue: optionalString(source.display_name) } : {}),
    ...(normalizeDoi(work.doi) ? { doi: normalizeDoi(work.doi) } : {}),
    ...(rebuildOpenAlexAbstract(work.abstract_inverted_index) ? { abstract: rebuildOpenAlexAbstract(work.abstract_inverted_index) } : {}),
    ...(optionalString(work.type) ? { workType: optionalString(work.type) } : {}),
    ...(citedByCount === undefined ? {} : { citedByCount }),
    ...(isRecord(work.open_access) && typeof work.open_access.is_oa === 'boolean' ? { isOpenAccess: work.open_access.is_oa } : {}),
    ...(optionalString(primaryLocation.landing_page_url) ? { landingPageUrl: optionalString(primaryLocation.landing_page_url) } : {}),
    ...(optionalString(primaryLocation.pdf_url) ? { pdfUrl: optionalString(primaryLocation.pdf_url) } : {}),
    provenance: {
      provider: 'openalex',
      externalRecordId,
      canonicalUrl,
      retrievedAt,
      providerRank,
      queryFingerprint,
      verificationStatus: 'observed',
    },
  };
  return result;
}

function strongNormalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function dedupKey(result: AcademicSearchResult): string[] {
  const keys = [`identity:${result.provider}\u0000${result.externalRecordId}`];
  const doi = normalizeDoi(result.doi);
  if (doi) keys.push(`doi:${doi}`);
  const firstAuthor = result.authors[0]?.name ? strongNormalize(result.authors[0].name) : '';
  if (result.publicationYear !== undefined && firstAuthor) {
    keys.push(`strong:${strongNormalize(result.title)}\u0000${result.publicationYear}\u0000${firstAuthor}`);
  }
  return keys;
}

export function deduplicateAcademicResults(results: AcademicSearchResult[]): AcademicSearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const keys = dedupKey(result);
    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
}
