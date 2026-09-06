import { createEmbeddingConfig } from '../indexing/embedding.config';
import {
  computeEmbeddingProfileFingerprint,
} from '../indexing/embedding.fingerprint';
import {
  distanceOperator,
  resolveRetrievalProfile,
  scoreDistance,
} from './retrieval.profile';
import { createRetrievalConfig } from './retrieval.config';

describe('retrieval profile', () => {
  const identity = {
    provider: 'provider-a',
    model: 'model-a',
    modelRevision: 'revision-a',
    dimensions: 3,
  };

  it('resolves one exact embedding runtime/profile for a request', () => {
    const embeddingConfig = createEmbeddingConfig({});
    const retrievalConfig = createRetrievalConfig({});

    const profile = resolveRetrievalProfile(identity, embeddingConfig, retrievalConfig);

    expect(profile.identity).toEqual(identity);
    expect(profile.embeddingProfile).toEqual(embeddingConfig.profile);
    expect(profile.embeddingProfileFingerprint).toBe(
      computeEmbeddingProfileFingerprint(identity, embeddingConfig.profile),
    );
    expect(profile.distanceMetric).toBe('cosine');
  });

  it.each([
    ['cosine', '<=>', 0.25],
    ['inner-product', '<#>', -0.75],
    ['l2', '<->', -0.75],
  ] as const)('maps %s to one deterministic operator and score', (metric, operator, score) => {
    expect(distanceOperator(metric)).toBe(operator);
    expect(scoreDistance(metric, 0.75)).toBe(score);
  });

  it('rejects an invalid provider dimension', () => {
    expect(() =>
      resolveRetrievalProfile(
        { ...identity, dimensions: 0 },
        createEmbeddingConfig({}),
        createRetrievalConfig({}),
      ),
    ).toThrow('dimensions');
  });
});
