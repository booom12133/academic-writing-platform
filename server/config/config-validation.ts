import { isAbsolute } from 'node:path';

import type { RuntimeConfig } from './production-config';
import { RuntimeProfileConfigurationError } from './runtime-profile';
import { validateProductionExternalProviderConfig } from './external-provider-validation';

const SUPPORTED_JWT_ALGORITHMS = new Set(['RS256', 'RS384', 'RS512']);

function requireConfiguredValue(value: string | undefined, name: string): string {
  if (!value) {
    throw new RuntimeProfileConfigurationError(
      `${name} is required for the standalone runtime profile.`,
    );
  }
  return value;
}

export function validateRuntimeConfig(
  config: RuntimeConfig,
  _env: NodeJS.ProcessEnv = process.env,
): void {
  if (config.nodeEnv === 'production' && config.profile === 'local') {
    throw new RuntimeProfileConfigurationError(
      'RUNTIME_PROFILE=local cannot be used when NODE_ENV=production.',
    );
  }

  if (config.nodeEnv === 'production' && config.auth.mode === 'local-fixed') {
    throw new RuntimeProfileConfigurationError(
      'local-fixed authentication cannot be used when NODE_ENV=production.',
    );
  }

  if (config.nodeEnv === 'production' && config.database.mode === 'local-memory') {
    throw new RuntimeProfileConfigurationError(
      'local-memory database cannot be used when NODE_ENV=production.',
    );
  }

  if (config.nodeEnv === 'production' && config.security.corsAllowedOrigins.includes('*')) {
    throw new RuntimeProfileConfigurationError(
      'CORS_ALLOWED_ORIGINS cannot contain * in production.',
    );
  }
  if (
    !Number.isFinite(config.security.rateLimit.windowMs) ||
    !Number.isFinite(config.security.rateLimit.maxRequests) ||
    !Number.isFinite(config.security.rateLimit.expensiveMaxRequests) ||
    config.security.rateLimit.windowMs <= 0 ||
    config.security.rateLimit.maxRequests <= 0 ||
    config.security.rateLimit.expensiveMaxRequests <= 0
  ) {
    throw new RuntimeProfileConfigurationError(
      'Production rate-limit settings must be positive numbers.',
    );
  }

  if (config.profile !== 'standalone') {
    validateExternalConfigInProduction(config.nodeEnv, _env);
    return;
  }

  if (config.nodeEnv !== 'production') {
    throw new RuntimeProfileConfigurationError(
      'RUNTIME_PROFILE=standalone requires NODE_ENV=production.',
    );
  }

  requireConfiguredValue(config.database.url, 'DATABASE_URL');
  const storageRoot = requireConfiguredValue(
    config.storage.root,
    'DOCUMENT_STORAGE_ROOT',
  );
  if (!isAbsolute(storageRoot)) {
    throw new RuntimeProfileConfigurationError(
      'DOCUMENT_STORAGE_ROOT must be an absolute path for the standalone runtime profile.',
    );
  }

  const auth = config.auth.standalone;
  if (!auth) {
    throw new RuntimeProfileConfigurationError(
      'Standalone JWT authentication configuration is required.',
    );
  }
  requireConfiguredValue(auth.issuer, 'OIDC_ISSUER_URL');
  requireConfiguredValue(auth.audience, 'OIDC_AUDIENCE');
  requireConfiguredValue(auth.jwksUrl, 'OIDC_JWKS_URL');
  if (config.security.corsAllowedOrigins.length === 0) {
    throw new RuntimeProfileConfigurationError(
      'CORS_ALLOWED_ORIGINS is required for the standalone runtime profile.',
    );
  }
  requireConfiguredValue(auth.userIdClaim, 'OIDC_USER_ID_CLAIM');
  if (auth.allowedAlgorithms.length === 0 || auth.allowedAlgorithms.some((algorithm) => !SUPPORTED_JWT_ALGORITHMS.has(algorithm))) {
    throw new RuntimeProfileConfigurationError(
      'OIDC_ALLOWED_ALGORITHMS must contain only RS256, RS384, or RS512.',
    );
  }
  if (!Number.isFinite(auth.timeoutMs) || auth.timeoutMs <= 0) {
    throw new RuntimeProfileConfigurationError(
      'OIDC_TIMEOUT_MS must be a positive number.',
    );
  }
  if (auth.issuer.startsWith('http://') || auth.jwksUrl.startsWith('http://')) {
    throw new RuntimeProfileConfigurationError(
      'OIDC_ISSUER_URL and OIDC_JWKS_URL must use HTTPS for the standalone runtime profile.',
    );
  }
  validateExternalConfigInProduction(config.nodeEnv, _env);
}

function validateExternalConfigInProduction(
  nodeEnv: string,
  env: NodeJS.ProcessEnv,
): void {
  if (nodeEnv !== 'production') return;
  try {
    validateProductionExternalProviderConfig(env);
  } catch (error) {
    throw new RuntimeProfileConfigurationError(
      error instanceof Error ? error.message : 'Production provider configuration is invalid.',
    );
  }
}
