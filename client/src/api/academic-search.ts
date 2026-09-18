import type {
  AcademicDiscoverySet,
  AcademicSearchRequest,
  AcademicSearchImportRequest,
} from '@shared/academic-search.interface';
import type { AcademicSearchImportResult } from '@shared/knowledge-product.interface';
import { productHttpClient } from './http';
import { normalizeProductIntegrationError } from './integration-error';

export async function search(request: AcademicSearchRequest): Promise<AcademicDiscoverySet> {
  const payload: AcademicSearchRequest = { q: request.q.trim() };
  if (request.fromPublicationDate !== undefined) payload.fromPublicationDate = request.fromPublicationDate;
  if (request.toPublicationDate !== undefined) payload.toPublicationDate = request.toPublicationDate;
  if (request.publicationYear !== undefined) payload.publicationYear = request.publicationYear;
  if (request.workType !== undefined) payload.workType = request.workType;
  if (request.isOpenAccess !== undefined) payload.isOpenAccess = request.isOpenAccess;
  if (request.pageSize !== undefined) payload.pageSize = request.pageSize;
  if (request.cursor !== undefined) payload.cursor = request.cursor;

  try {
    const response = await productHttpClient.post<AcademicDiscoverySet>(
      '/api/academic-search/search',
      payload,
    );
    return response.data;
  } catch (error) {
    throw normalizeProductIntegrationError(error, 'academic-search');
  }
}

export async function importToWorkspace(request: AcademicSearchImportRequest): Promise<AcademicSearchImportResult> {
  try {
    const response = await productHttpClient.post<AcademicSearchImportResult>('/api/academic-search/import', request);
    return response.data;
  } catch (error) {
    throw normalizeProductIntegrationError(error, 'academic-search');
  }
}

export type {
  AcademicDiscoverySet,
  AcademicSearchRequest,
  AcademicSearchResult,
  AcademicSearchImportRequest,
} from '@shared/academic-search.interface';
export type { AcademicSearchImportResult } from '@shared/knowledge-product.interface';
