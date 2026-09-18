import { resolveEmbeddingProductionConfig } from '../modules/knowledge/indexing/embedding-production-config';

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required in production.`);
  return value;
}

function requireHttps(env: NodeJS.ProcessEnv, name: string, fallback: string): void {
  const value = (env[name]?.trim() || fallback).replace(/\/+$/u, '');
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL.`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`${name} must use HTTPS in production.`);
}

export function validateProductionExternalProviderConfig(
  env: NodeJS.ProcessEnv,
): void {
  required(env, 'DEEPSEEK_API_KEY');
  requireHttps(env, 'DEEPSEEK_BASE_URL', 'https://api.deepseek.com');
  required(env, 'DEEPSEEK_DEFAULT_MODEL');

  resolveEmbeddingProductionConfig(env);

  requireHttps(env, 'OPENALEX_API_BASE_URL', 'https://api.openalex.org');
  required(env, 'ACADEMIC_SEARCH_CURSOR_SECRET');

  requireHttps(env, 'ZOTERO_API_BASE_URL', 'https://api.zotero.org');
  const encryptionKey = required(env, 'ZOTERO_CREDENTIAL_ENCRYPTION_KEY');
  required(env, 'ZOTERO_CREDENTIAL_ENCRYPTION_KEY_VERSION');
  if (Buffer.from(encryptionKey, 'base64').length !== 32) {
    throw new Error('ZOTERO_CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes.');
  }
}
