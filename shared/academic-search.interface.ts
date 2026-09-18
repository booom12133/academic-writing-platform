export type AcademicSearchCursor = string;

export interface AcademicSearchRequest {
  q: string;
  fromPublicationDate?: string;
  toPublicationDate?: string;
  publicationYear?: number;
  workType?: string;
  isOpenAccess?: boolean;
  pageSize?: number;
  cursor?: AcademicSearchCursor;
}

export interface AcademicSearchResult {
  provider: 'openalex';
  externalRecordId: string;
  title: string;
  authors: Array<{ name: string; orcid?: string; externalId?: string }>;
  publicationDate?: string;
  publicationYear?: number;
  venue?: string;
  doi?: string;
  abstract?: string;
  workType?: string;
  citedByCount?: number;
  isOpenAccess?: boolean;
  landingPageUrl?: string;
  pdfUrl?: string;
  provenance: {
    provider: 'openalex';
    externalRecordId: string;
    canonicalUrl: string;
    retrievedAt: string;
    providerRank: number;
    queryFingerprint: string;
    verificationStatus: 'observed';
  };
}

export interface AcademicDiscoverySet {
  provider: 'openalex';
  status: 'complete' | 'partial' | 'empty';
  items: AcademicSearchResult[];
  totalCount?: number;
  nextCursor?: AcademicSearchCursor;
  diagnostics: Array<{
    code: 'invalid-result-skipped' | 'duplicate-result-removed';
    externalRecordId?: string;
  }>;
  provenance: {
    provider: 'openalex';
    queryFingerprint: string;
    retrievedAt: string;
  };
}

export interface AcademicSearchImportRequest {
  provider: 'openalex';
  externalRecordId: string;
}
