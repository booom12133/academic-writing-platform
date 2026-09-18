import { validateProductionExternalProviderConfig } from './external-provider-validation';

const validEnv = {
  DEEPSEEK_API_KEY: 'deepseek-secret',
  DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
  DEEPSEEK_DEFAULT_MODEL: 'deepseek-v4-flash',
  EMBEDDING_BASE_URL: 'https://api.siliconflow.cn/v1',
  EMBEDDING_API_KEY: 'embedding-secret',
  EMBEDDING_MODEL: 'BAAI/bge-m3',
  EMBEDDING_DIMENSIONS: '1024',
  EMBEDDING_TIMEOUT_MS: '10000',
  OPENALEX_API_BASE_URL: 'https://api.openalex.org',
  ACADEMIC_SEARCH_CURSOR_SECRET: 'cursor-secret',
  ZOTERO_API_BASE_URL: 'https://api.zotero.org',
  ZOTERO_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  ZOTERO_CREDENTIAL_ENCRYPTION_KEY_VERSION: 'v1',
};

describe('production external provider configuration', () => {
  it('accepts complete provider configuration without logging secret values', () => {
    expect(() => validateProductionExternalProviderConfig(validEnv)).not.toThrow();
  });

  it.each([
    ['DEEPSEEK_API_KEY', { DEEPSEEK_API_KEY: undefined }],
    ['EMBEDDING_API_KEY', { EMBEDDING_API_KEY: undefined }],
    ['ACADEMIC_SEARCH_CURSOR_SECRET', { ACADEMIC_SEARCH_CURSOR_SECRET: undefined }],
    ['ZOTERO_CREDENTIAL_ENCRYPTION_KEY', { ZOTERO_CREDENTIAL_ENCRYPTION_KEY: 'not-base64-32-bytes' }],
  ])('rejects invalid %s', (_name, override) => {
    expect(() => validateProductionExternalProviderConfig({ ...validEnv, ...override })).toThrow();
  });

  it('rejects non-HTTPS provider endpoints', () => {
    expect(() => validateProductionExternalProviderConfig({
      ...validEnv,
      DEEPSEEK_BASE_URL: 'http://api.deepseek.com',
    })).toThrow(/HTTPS/);
  });
});
