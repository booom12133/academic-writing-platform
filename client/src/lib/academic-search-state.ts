import type { AcademicDiscoverySet } from '@shared/academic-search.interface';

export type AcademicSearchViewState = 'loading' | 'error' | 'empty' | 'partial' | 'results';

export const ACADEMIC_SEARCH_RESULT_SEMANTICS = {
  isDiscoveryMetadata: true,
  isIndexed: false,
  isGroundedEvidence: false,
} as const;

export function getAcademicSearchViewState(input: {
  loading: boolean;
  error: string | null;
  result: AcademicDiscoverySet | null;
}): AcademicSearchViewState {
  if (input.loading && !input.result) return 'loading';
  if (input.error && !input.result) return 'error';
  if (!input.result || input.result.items.length === 0 || input.result.status === 'empty') return 'empty';
  if (input.error || input.result.status === 'partial') return 'partial';
  return 'results';
}
