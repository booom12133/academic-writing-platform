import {
  createRetrievalConfig,
  normalizeRetrievalPolicy,
} from './retrieval.config';

describe('retrieval configuration', () => {
  it('uses bounded defaults for the retrieval policy', () => {
    const config = createRetrievalConfig({});

    expect(config).toMatchObject({
      distanceMetric: 'cosine',
      defaultTopK: 8,
      defaultCandidateLimit: 32,
      maxTopK: 50,
      maxCandidateLimit: 200,
    });
    expect(normalizeRetrievalPolicy({}, config)).toEqual({
      topK: 8,
      candidateLimit: 32,
    });
  });

  it.each(['cosine', 'inner-product', 'l2'] as const)(
    'accepts the supported distance metric %s',
    (distanceMetric) => {
      expect(createRetrievalConfig({ RETRIEVAL_DISTANCE_METRIC: distanceMetric }).distanceMetric).toBe(
        distanceMetric,
      );
    },
  );

  it('rejects unsupported metric and invalid policy bounds', () => {
    expect(() => createRetrievalConfig({ RETRIEVAL_DISTANCE_METRIC: 'dot' })).toThrow(
      'RETRIEVAL_DISTANCE_METRIC',
    );

    const config = createRetrievalConfig({});
    expect(() => normalizeRetrievalPolicy({ topK: 0 }, config)).toThrow('topK');
    expect(() => normalizeRetrievalPolicy({ topK: 51 }, config)).toThrow('topK');
    expect(() => normalizeRetrievalPolicy({ candidateLimit: 201 }, config)).toThrow(
      'candidateLimit',
    );
    expect(() => normalizeRetrievalPolicy({ topK: 10, candidateLimit: 9 }, config)).toThrow(
      'candidateLimit',
    );
  });

  it('preserves a configured metric-specific score threshold', () => {
    const config = createRetrievalConfig({
      RETRIEVAL_MIN_SCORE: '-0.25',
    });

    expect(normalizeRetrievalPolicy({ topK: 4, candidateLimit: 12 }, config)).toEqual({
      topK: 4,
      candidateLimit: 12,
      minRetrievalScore: -0.25,
    });
  });
});
