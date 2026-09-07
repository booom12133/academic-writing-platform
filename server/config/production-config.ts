import { resolve } from 'node:path';

import { parseRuntimeProfile, type RuntimeProfile } from './runtime-profile';
import { validateRuntimeConfig } from './config-validation';

export type RuntimeAuthMode = 'local-fixed' | 'platform' | 'standalone-jwt';
export type RuntimeDatabaseMode = 'local-memory' | 'platform' | 'postgres';
export type RuntimeStorageMode =
  | 'local-filesystem'
  | 'platform'
  | 'persistent-filesystem';

export interface RuntimeConfig {
  nodeEnv: string;
  profile: RuntimeProfile;
  auth: { mode: RuntimeAuthMode };
  database: { mode: RuntimeDatabaseMode; url?: string };
  storage: { mode: RuntimeStorageMode; root?: string };
}

function configuredValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value || undefined;
}

export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  const nodeEnv = configuredValue(env, 'NODE_ENV') || 'development';
  const profile = parseRuntimeProfile(env);
  const databaseUrl = configuredValue(env, 'DATABASE_URL');
  const storageRoot = configuredValue(env, 'DOCUMENT_STORAGE_ROOT');

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
      };
      break;
    case 'platform':
      config = {
        nodeEnv,
        profile,
        auth: { mode: 'platform' },
        database: { mode: 'platform' },
        storage: { mode: 'platform' },
      };
      break;
    case 'standalone':
      config = {
        nodeEnv,
        profile,
        auth: { mode: 'standalone-jwt' },
        database: { mode: 'postgres', url: databaseUrl },
        storage: { mode: 'persistent-filesystem', root: storageRoot },
      };
      break;
  }

  validateRuntimeConfig(config, env);
  return config;
}
