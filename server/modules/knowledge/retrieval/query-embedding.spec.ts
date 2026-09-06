import { createEmbeddingConfig } from '../indexing/embedding.config';
import type { EmbeddingProvider } from '../indexing/embedding.provider';
import { createRetrievalConfig } from './retrieval.config';
import { RetrievalError } from './retrieval.errors';
import { createQueryEmbeddingRuntime } from './query-embedding';

describe('query embedding runtime', () => {
  const identity = {
    provider: 'provider-a',
    model: 'model-a',
    modelRevision: 'revision-a',
    dimensions: 3,
  };

  function provider(overrides: Partial<EmbeddingProvider> = {}): EmbeddingProvider {
    return {
      getIdentity: jest.fn(async () => identity),
      embed: jest.fn(async (request) => ({
        identity,
        items: request.items.map((item) => ({
          inputFingerprint: item.inputFingerprint,
          vector: [1, 2, 3],
        })),
      })),
      checkHealth: jest.fn(),
      ...overrides,
    };
  }

  it('creates one runtime with exact identity, profile fingerprint, and vector dimensions', async () => {
    const embeddingProvider = provider();
    const runtime = await createQueryEmbeddingRuntime({
      queryText: 'query',
      provider: embeddingProvider,
      embeddingConfig: createEmbeddingConfig({}),
      retrievalConfig: createRetrievalConfig({}),
    });

    expect(runtime.identity).toEqual(identity);
    expect(runtime.embeddingProfileFingerprint).toHaveLength(64);
    expect(runtime.vector).toEqual([1, 2, 3]);
    expect(runtime.queryInputFingerprint).toHaveLength(64);
    expect(embeddingProvider.getIdentity).toHaveBeenCalledTimes(1);
    expect(embeddingProvider.embed).toHaveBeenCalledTimes(1);
  });

  it('rejects an over-limit query before provider invocation', async () => {
    const embeddingProvider = provider();
    const embeddingConfig = createEmbeddingConfig({
      EMBEDDING_MAX_INPUT_CODE_POINTS: '2',
    });

    await expect(
      createQueryEmbeddingRuntime({
        queryText: 'abc',
        provider: embeddingProvider,
        embeddingConfig,
        retrievalConfig: createRetrievalConfig({}),
      }),
    ).rejects.toMatchObject<Partial<RetrievalError>>({
      code: 'RETRIEVAL_INVALID_QUERY',
    });
    expect(embeddingProvider.getIdentity).not.toHaveBeenCalled();
    expect(embeddingProvider.embed).not.toHaveBeenCalled();
  });

  it('rejects provider identity, fingerprint, and dimension mismatches', async () => {
    const mismatchedIdentity = { ...identity, modelRevision: 'other' };
    const wrongIdentityProvider = provider({
      embed: jest.fn(async (request) => ({
        identity: mismatchedIdentity,
        items: request.items.map((item) => ({
          inputFingerprint: item.inputFingerprint,
          vector: [1, 2, 3],
        })),
      })),
    });
    await expect(
      createQueryEmbeddingRuntime({
        queryText: 'query',
        provider: wrongIdentityProvider,
        embeddingConfig: createEmbeddingConfig({}),
        retrievalConfig: createRetrievalConfig({}),
      }),
    ).rejects.toMatchObject({ code: 'RETRIEVAL_QUERY_EMBEDDING_FAILED' });

    const wrongVectorProvider = provider({
      embed: jest.fn(async (request) => ({
        identity,
        items: request.items.map((item) => ({
          inputFingerprint: item.inputFingerprint,
          vector: [1, 2],
        })),
      })),
    });
    await expect(
      createQueryEmbeddingRuntime({
        queryText: 'query',
        provider: wrongVectorProvider,
        embeddingConfig: createEmbeddingConfig({}),
        retrievalConfig: createRetrievalConfig({}),
      }),
    ).rejects.toMatchObject({ code: 'RETRIEVAL_QUERY_EMBEDDING_FAILED' });
  });

  it('maps provider failures to retrieval errors instead of empty results', async () => {
    const embeddingProvider = provider({
      embed: jest.fn().mockRejectedValue(new Error('provider unavailable')),
    });

    await expect(
      createQueryEmbeddingRuntime({
        queryText: 'query',
        provider: embeddingProvider,
        embeddingConfig: createEmbeddingConfig({}),
        retrievalConfig: createRetrievalConfig({}),
      }),
    ).rejects.toMatchObject<Partial<RetrievalError>>({
      code: 'RETRIEVAL_QUERY_EMBEDDING_FAILED',
    });
  });
});
