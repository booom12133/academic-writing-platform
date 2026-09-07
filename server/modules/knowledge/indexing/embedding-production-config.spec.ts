import { resolveEmbeddingProductionConfig } from './embedding-production-config';

describe('production embedding configuration', () => {
  it('rejects an incomplete production configuration', () => {
    expect(() => resolveEmbeddingProductionConfig({ NODE_ENV: 'production' })).toThrow(
      /EMBEDDING_BASE_URL/,
    );
  });

  it('requires HTTPS and returns the bounded provider contract', () => {
    expect(() => resolveEmbeddingProductionConfig({
      NODE_ENV: 'production',
      EMBEDDING_BASE_URL: 'http://embedding.example.com',
      EMBEDDING_API_KEY: 'secret',
      EMBEDDING_MODEL: 'text-embedding-3-small',
      EMBEDDING_DIMENSIONS: '1536',
      EMBEDDING_TIMEOUT_MS: '5000',
    })).toThrow(/HTTPS/);

    expect(resolveEmbeddingProductionConfig({
      NODE_ENV: 'production',
      EMBEDDING_BASE_URL: 'https://embedding.example.com/',
      EMBEDDING_API_KEY: 'secret',
      EMBEDDING_MODEL: 'text-embedding-3-small',
      EMBEDDING_MODEL_REVISION: '2026-01',
      EMBEDDING_DIMENSIONS: '1536',
      EMBEDDING_TIMEOUT_MS: '5000',
    })).toEqual({
      baseUrl: 'https://embedding.example.com',
      apiKey: 'secret',
      model: 'text-embedding-3-small',
      modelRevision: '2026-01',
      dimensions: 1536,
      timeoutMs: 5000,
    });
  });
});
