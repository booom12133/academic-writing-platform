import { DeterministicEmbeddingProvider } from './embedding.fake';
import { OpenAiCompatibleEmbeddingProvider } from './openai-compatible-embedding.provider';

let createEmbeddingProvider: typeof import('./knowledge-indexing.module').createEmbeddingProvider;
const productionExternalEnv = {
  DEEPSEEK_API_KEY: 'deepseek-secret',
  DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
  DEEPSEEK_DEFAULT_MODEL: 'deepseek-v4-flash',
  OPENALEX_API_BASE_URL: 'https://api.openalex.org',
  ACADEMIC_SEARCH_CURSOR_SECRET: 'cursor-secret',
  ZOTERO_API_BASE_URL: 'https://api.zotero.org',
  ZOTERO_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  ZOTERO_CREDENTIAL_ENCRYPTION_KEY_VERSION: 'v1',
};
beforeAll(() => {
  process.env.RUNTIME_PROFILE = 'local';
  // Require after the explicit profile is selected because KnowledgeModule resolves storage at definition time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ({ createEmbeddingProvider } = require('./knowledge-indexing.module'));
});

describe('knowledge indexing provider runtime boundary', () => {
  it('keeps deterministic embeddings in the explicit local profile', () => {
    expect(createEmbeddingProvider({
      NODE_ENV: 'development',
      RUNTIME_PROFILE: 'local',
    })).toBeInstanceOf(DeterministicEmbeddingProvider);
  });

  it('uses the real HTTP adapter for production platform runtime', () => {
    expect(createEmbeddingProvider({
      NODE_ENV: 'production',
      RUNTIME_PROFILE: 'platform',
      ...productionExternalEnv,
      EMBEDDING_BASE_URL: 'https://embedding.example.com',
      EMBEDDING_API_KEY: 'secret',
      EMBEDDING_MODEL: 'text-embedding-3-small',
      EMBEDDING_DIMENSIONS: '1536',
      EMBEDDING_TIMEOUT_MS: '5000',
    })).toBeInstanceOf(OpenAiCompatibleEmbeddingProvider);
  });

  it('fails production bootstrap rather than falling back to deterministic vectors', () => {
    expect(() => createEmbeddingProvider({
      NODE_ENV: 'production',
      RUNTIME_PROFILE: 'platform',
      ...productionExternalEnv,
    })).toThrow(/EMBEDDING_BASE_URL/);
    expect(() => createEmbeddingProvider({
      NODE_ENV: 'production',
      RUNTIME_PROFILE: 'local',
    })).toThrow(/RUNTIME_PROFILE=local/);
  });
});
