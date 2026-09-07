import { resolve } from 'node:path';

import { loadRuntimeConfig } from '../../server/config/production-config';

const validProductionEnv = {
  NODE_ENV: 'production',
  RUNTIME_PROFILE: 'standalone',
  DATABASE_URL:
    'postgresql://postgres:postgres@127.0.0.1:5432/academic_writing_test',
  DOCUMENT_STORAGE_ROOT: resolve('academic-writing-documents'),
  OIDC_ISSUER_URL: 'https://issuer.example.com',
  OIDC_AUDIENCE: 'academic-writing-platform',
  OIDC_JWKS_URL: 'https://issuer.example.com/.well-known/jwks.json',
  CORS_ALLOWED_ORIGINS: 'https://app.example.com',
  DEEPSEEK_API_KEY: 'test-deepseek-key',
  DEEPSEEK_DEFAULT_MODEL: 'deepseek-v4-flash',
  OPENALEX_API_BASE_URL: 'https://api.openalex.org',
  ACADEMIC_SEARCH_CURSOR_SECRET: 'test-cursor-secret',
  ZOTERO_API_BASE_URL: 'https://api.zotero.org',
  ZOTERO_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'),
  ZOTERO_CREDENTIAL_ENCRYPTION_KEY_VERSION: 'v1',
};

describe('production configuration gate', () => {
  it('accepts a complete standalone production boundary', () => {
    const config = loadRuntimeConfig(validProductionEnv);

    expect(config.profile).toBe('standalone');
    expect(config.database.mode).toBe('postgres');
    expect(config.auth.mode).toBe('standalone-jwt');
    expect(config.storage.mode).toBe('persistent-filesystem');
  });

  it.each([
    [
      { ...validProductionEnv, RUNTIME_PROFILE: 'local' },
      /RUNTIME_PROFILE=local/,
    ],
    [{ ...validProductionEnv, DATABASE_URL: undefined }, /DATABASE_URL/],
    [
      { ...validProductionEnv, CORS_ALLOWED_ORIGINS: '*' },
      /CORS_ALLOWED_ORIGINS/,
    ],
  ])('rejects an invalid production boundary', (environment, message) => {
    expect(() => loadRuntimeConfig(environment)).toThrow(message);
  });
});
