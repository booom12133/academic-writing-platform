import {
  ACADEMIC_SEARCH_RESULT_SEMANTICS,
  getAcademicSearchViewState,
} from '../../client/src/lib/academic-search-state';

const result = {
  provider: 'openalex' as const,
  status: 'complete' as const,
  items: [{
    provider: 'openalex' as const,
    externalRecordId: 'W1',
    title: 'A paper',
    authors: [],
    provenance: {
      provider: 'openalex' as const,
      externalRecordId: 'W1',
      canonicalUrl: 'https://openalex.org/W1',
      retrievedAt: '2026-09-08T00:00:00.000Z',
      providerRank: 1,
      queryFingerprint: 'fp',
      verificationStatus: 'observed' as const,
    },
  }],
  diagnostics: [],
  provenance: {
    provider: 'openalex' as const,
    queryFingerprint: 'fp',
    retrievedAt: '2026-09-08T00:00:00.000Z',
  },
};

describe('academic search presentation semantics', () => {
  it.each([
    ['loading', { loading: true, error: null, result: null }],
    ['error', { loading: false, error: 'safe error', result: null }],
    ['empty', { loading: false, error: null, result: { ...result, status: 'empty', items: [] } }],
    ['partial', { loading: false, error: null, result: { ...result, status: 'partial' } }],
    ['results', { loading: false, error: null, result }],
  ] as const)('returns distinct %s state', (expected, input) => {
    expect(getAcademicSearchViewState(input)).toBe(expected);
  });

  it('keeps discovery metadata separate from indexed evidence', () => {
    expect(ACADEMIC_SEARCH_RESULT_SEMANTICS).toEqual({
      isDiscoveryMetadata: true,
      isIndexed: false,
      isGroundedEvidence: false,
    });
  });
});
