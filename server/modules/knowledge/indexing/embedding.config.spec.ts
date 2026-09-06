import { createEmbeddingConfig } from './embedding.config';

describe('embedding configuration', () => {
  it('uses stable semantic profile defaults and separate execution policy defaults', () => {
    expect(createEmbeddingConfig({})).toEqual({
      profile: {
        name: 'e2-embedding-v1',
        version: '1',
        inputEncoding: 'utf8',
        normalization: { name: 'e2-utf8-exact-v1', version: '1' },
        truncation: { name: 'e2-reject-over-limit-v1', version: '1', maxInputCodePoints: 10_000 },
        adapterVersion: '1',
      },
      execution: {
        batchSize: 16,
        maxAttempts: 3,
        backoffBaseMs: 100,
        backoffMaxMs: 2_000,
        leaseDurationMs: 60_000,
      },
    });
  });

  it('parses bounded execution settings without changing semantic profile', () => {
    const config = createEmbeddingConfig({
      EMBEDDING_BATCH_SIZE: '8',
      EMBEDDING_MAX_ATTEMPTS: '4',
      EMBEDDING_BACKOFF_BASE_MS: '50',
      EMBEDDING_BACKOFF_MAX_MS: '500',
      EMBEDDING_LEASE_DURATION_MS: '30000',
      EMBEDDING_MAX_INPUT_CODE_POINTS: '5000',
    });

    expect(config.profile.truncation.maxInputCodePoints).toBe(5000);
    expect(config.execution).toEqual({
      batchSize: 8,
      maxAttempts: 4,
      backoffBaseMs: 50,
      backoffMaxMs: 500,
      leaseDurationMs: 30_000,
    });
  });

  it.each([
    ['EMBEDDING_BATCH_SIZE', '0'],
    ['EMBEDDING_MAX_ATTEMPTS', '11'],
    ['EMBEDDING_BACKOFF_BASE_MS', '-1'],
    ['EMBEDDING_BACKOFF_MAX_MS', '0'],
    ['EMBEDDING_LEASE_DURATION_MS', '999'],
    ['EMBEDDING_MAX_INPUT_CODE_POINTS', '0'],
  ])('rejects invalid %s', (name, value) => {
    expect(() => createEmbeddingConfig({ [name]: value })).toThrow(name);
  });
});
