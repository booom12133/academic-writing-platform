import { isAbsolute } from 'node:path';

import type { RuntimeConfig } from './production-config';
import { RuntimeProfileConfigurationError } from './runtime-profile';

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

  if (config.profile !== 'standalone') return;

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
}
