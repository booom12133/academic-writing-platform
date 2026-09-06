import type { AcademicDiscoverySet, AcademicSearchQuery } from './academic-search.types';

export const ACADEMIC_SEARCH_PROVIDER = Symbol('ACADEMIC_SEARCH_PROVIDER');

export interface AcademicSearchProvider {
  search(input: { query: AcademicSearchQuery; queryFingerprint: string }): Promise<AcademicDiscoverySet>;
}
