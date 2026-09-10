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
  EMBEDDING_BASE_URL: 'https://api.siliconflow.cn/v1',
  EMBEDDING_API_KEY: 'test-embedding-key',
  EMBEDDING_MODEL: 'BAAI/bge-m3',
  EMBEDDING_DIMENSIONS: '1024',
  EMBEDDING_TIMEOUT_MS: '10000',
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
    expect(config.security.trustProxyHops).toBe(0);
  });

  it.each(['LOG_REQUEST_BODY', 'LOG_RESPONSE_BODY'])('%s cannot be enabled in production', (key) => {
    expect(() => loadRuntimeConfig({
      ...validProductionEnv,
      [key]: 'true',
    })).toThrow(/body logging must be disabled in production/i);
  });

  it('accepts explicit disabled body logging in production', () => {
    expect(() => loadRuntimeConfig({
      ...validProductionEnv,
      LOG_REQUEST_BODY: 'false',
      LOG_RESPONSE_BODY: 'false',
    })).not.toThrow();
  });

  it('parses an explicit bounded proxy trust hop count', () => {
    const config = loadRuntimeConfig({ ...validProductionEnv, TRUST_PROXY_HOPS: '1' });

    expect(config.security.trustProxyHops).toBe(1);
  });

  it.each(['-1', '1.5', 'NaN', '11'])('rejects an unsafe proxy trust hop count: %s', (hops) => {
    expect(() => loadRuntimeConfig({ ...validProductionEnv, TRUST_PROXY_HOPS: hops }))
      .toThrow(/TRUST_PROXY_HOPS/);
  });

  it.each(['http://issuer.example.com', 'HTTP://issuer.example.com', 'ftp://issuer.example.com', 'not a url', '/relative'])
    ('rejects an invalid OIDC issuer URL: %s', (issuer) => {
      expect(() => loadRuntimeConfig({ ...validProductionEnv, OIDC_ISSUER_URL: issuer }))
        .toThrow(/OIDC_ISSUER_URL must be a valid HTTPS URL/i);
    });

  it.each(['http://issuer.example.com/jwks', 'HTTP://issuer.example.com/jwks', 'ftp://issuer.example.com/jwks', 'not a url', '/relative'])
    ('rejects an invalid OIDC JWKS URL: %s', (jwksUrl) => {
      expect(() => loadRuntimeConfig({ ...validProductionEnv, OIDC_JWKS_URL: jwksUrl }))
        .toThrow(/OIDC_JWKS_URL must be a valid HTTPS URL/i);
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
