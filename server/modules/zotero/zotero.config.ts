import { ZoteroCredentialCrypto } from './zotero-crypto';
import { ZoteroError } from './zotero.errors';
import type { ZoteroConfig } from './zotero.types';

export const ZOTERO_CRYPTO = Symbol('ZOTERO_CRYPTO');
export const ZOTERO_CONFIG = Symbol('ZOTERO_CONFIG');

export function resolveZoteroConfig(env: NodeJS.ProcessEnv = process.env): ZoteroConfig {
  const positive = (name: string, fallback: number) => {
    const value = Number(env[name]);
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  };
  return {
    baseUrl: env.ZOTERO_API_BASE_URL?.replace(/\/$/u, '') || 'https://api.zotero.org',
    apiVersion: '3', timeoutMs: positive('ZOTERO_TIMEOUT_MS', 10_000),
    maxRetries: Math.min(positive('ZOTERO_MAX_RETRIES', 2), 4),
    maxConcurrency: Math.min(positive('ZOTERO_MAX_CONCURRENCY', 4), 4),
    maxFileBytes: 20 * 1024 * 1024,
  };
}

export class EnvironmentZoteroCredentialCrypto {
  private resolve(): ZoteroCredentialCrypto {
    const encoded = process.env.ZOTERO_CREDENTIAL_ENCRYPTION_KEY;
    const version = process.env.ZOTERO_CREDENTIAL_ENCRYPTION_KEY_VERSION;
    if (!encoded || !version) throw new ZoteroError('ZOTERO_UPSTREAM_FAILED', 'Zotero credential encryption is unavailable.');
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32) throw new ZoteroError('ZOTERO_UPSTREAM_FAILED', 'Zotero credential encryption is unavailable.');
    return new ZoteroCredentialCrypto(key, version);
  }

  encrypt(value: string) { return this.resolve().encrypt(value); }
  decrypt(value: Parameters<ZoteroCredentialCrypto['decrypt']>[0]) { return this.resolve().decrypt(value); }
}
