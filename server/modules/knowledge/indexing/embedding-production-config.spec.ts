import { resolveEmbeddingProductionConfig } from './embedding-production-config';

describe('production embedding configuration', () => {
  it('rejects an incomplete production configuration', () => {
    expect(() => resolveEmbeddingProductionConfig({ NODE_ENV: 'production' })).toThrow(
      /EMBEDDING_BASE_URL/,
    );
  });

  it('requires HTTPS and returns the frozen SiliconFlow provider contract', () => {
    expect(() => resolveEmbeddingProductionConfig({
      NODE_ENV: 'production',
      EMBEDDING_BASE_URL: 'http://embedding.example.com',
      EMBEDDING_API_KEY: 'secret',
      EMBEDDING_MODEL: 'BAAI/bge-m3',
      EMBEDDING_DIMENSIONS: '1024',
      EMBEDDING_TIMEOUT_MS: '5000',
    })).toThrow(/HTTPS/);

    expect(resolveEmbeddingProductionConfig({
      NODE_ENV: 'production',
      EMBEDDING_BASE_URL: 'https://api.siliconflow.cn/v1/',
      EMBEDDING_API_KEY: 'secret',
      EMBEDDING_MODEL: 'BAAI/bge-m3',
      EMBEDDING_DIMENSIONS: '1024',
      EMBEDDING_TIMEOUT_MS: '5000',
    })).toEqual({
      baseUrl: 'https://api.siliconflow.cn/v1',
      apiKey: 'secret',
      model: 'BAAI/bge-m3',
      dimensions: 1024,
      timeoutMs: 5000,
    });
  });

  it.each([
    ['EMBEDDING_BASE_URL', { EMBEDDING_BASE_URL: 'https://embedding.example.com/v1' }],
    ['EMBEDDING_MODEL', { EMBEDDING_MODEL: 'text-embedding-3-small' }],
    ['EMBEDDING_DIMENSIONS', { EMBEDDING_DIMENSIONS: '1536' }],
  ])('rejects a non-approved production %s', (_name, override) => {
    expect(() => resolveEmbeddingProductionConfig({
      NODE_ENV: 'production',
      EMBEDDING_BASE_URL: 'https://api.siliconflow.cn/v1',
      EMBEDDING_API_KEY: 'secret',
      EMBEDDING_MODEL: 'BAAI/bge-m3',
      EMBEDDING_DIMENSIONS: '1024',
      EMBEDDING_TIMEOUT_MS: '5000',
      ...override,
    })).toThrow();
  });
});
