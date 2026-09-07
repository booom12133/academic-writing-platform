import { resolve } from 'node:path';

import { parseRuntimeProfile, type RuntimeProfile } from './runtime-profile';
import { validateRuntimeConfig } from './config-validation';
import type { StandaloneAuthConfiguration } from '../auth/standalone-auth.types';

export type RuntimeAuthMode = 'local-fixed' | 'platform' | 'standalone-jwt';
export type RuntimeDatabaseMode = 'local-memory' | 'platform' | 'postgres';
export type RuntimeStorageMode =
  | 'local-filesystem'
  | 'platform'
  | 'persistent-filesystem';

export interface RuntimeRateLimitConfig {
  windowMs: number;
  maxRequests: number;
  expensiveMaxRequests: number;
}

export interface RuntimeSecurityConfig {
  corsAllowedOrigins: readonly string[];
  bodySizeLimit: string;
  rateLimit: RuntimeRateLimitConfig;
}

export interface RuntimeConfig {
  nodeEnv: string;
  profile: RuntimeProfile;
  auth: { mode: RuntimeAuthMode; standalone?: StandaloneAuthConfiguration };
  database: { mode: RuntimeDatabaseMode; url?: string };
  storage: { mode: RuntimeStorageMode; root?: string };
  security: RuntimeSecurityConfig;
}

function configuredValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value || undefined;
}

function configuredNumber(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const value = configuredValue(env, name);
  if (!value) return fallback;
  const parsed = Number(value);
  return parsed;
}

function configuredList(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: readonly string[],
): readonly string[] {
  const value = configuredValue(env, name);
  if (!value) return fallback;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function configuredText(env: NodeJS.ProcessEnv, name: string, fallback: string): string {
  return configuredValue(env, name) || fallback;
}

export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  const nodeEnv = configuredValue(env, 'NODE_ENV') || 'development';
  const profile = parseRuntimeProfile(env);
  const databaseUrl = configuredValue(env, 'DATABASE_URL');
  const storageRoot = configuredValue(env, 'DOCUMENT_STORAGE_ROOT');
  const security: RuntimeSecurityConfig = {
    corsAllowedOrigins: configuredList(env, 'CORS_ALLOWED_ORIGINS', []),
    bodySizeLimit: configuredText(env, 'BODY_SIZE_LIMIT', '1mb'),
    rateLimit: {
      windowMs: configuredNumber(env, 'RATE_LIMIT_WINDOW_MS', 60_000),
      maxRequests: configuredNumber(env, 'RATE_LIMIT_MAX_REQUESTS', 120),
      expensiveMaxRequests: configuredNumber(env, 'RATE_LIMIT_EXPENSIVE_MAX_REQUESTS', 30),
    },
  };

  let config: RuntimeConfig;
  switch (profile) {
    case 'local':
      config = {
        nodeEnv,
        profile,
        auth: { mode: 'local-fixed' },
        database: { mode: 'local-memory' },
        storage: {
          mode: 'local-filesystem',
          root: storageRoot || resolve(process.cwd(), '.local-data', 'documents'),
        },
        security,
      };
      break;
    case 'platform':
      config = {
        nodeEnv,
        profile,
        auth: { mode: 'platform' },
        database: { mode: 'platform' },
        storage: { mode: 'platform' },
        security,
      };
      break;
    case 'standalone':
      config = {
        nodeEnv,
        profile,
        auth: {
          mode: 'standalone-jwt',
          standalone: {
            issuer: configuredValue(env, 'OIDC_ISSUER_URL') || '',
            audience: configuredValue(env, 'OIDC_AUDIENCE') || '',
            jwksUrl: configuredValue(env, 'OIDC_JWKS_URL') || '',
            userIdClaim: configuredValue(env, 'OIDC_USER_ID_CLAIM') || 'sub',
            allowedAlgorithms: configuredList(env, 'OIDC_ALLOWED_ALGORITHMS', ['RS256']),
            timeoutMs: configuredNumber(env, 'OIDC_TIMEOUT_MS', 3000),
          },
        },
        database: { mode: 'postgres', url: databaseUrl },
        storage: { mode: 'persistent-filesystem', root: storageRoot },
        security,
      };
      break;
  }

  validateRuntimeConfig(config, env);
  return config;
}
