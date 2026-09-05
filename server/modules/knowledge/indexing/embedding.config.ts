import type {
  EmbeddingConfig,
  EmbeddingExecutionPolicy,
} from './embedding.types';

export const EMBEDDING_CONFIG = Symbol('EMBEDDING_CONFIG');

function boundedInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
  return value;
}

export function createEmbeddingConfig(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingConfig {
  const execution: EmbeddingExecutionPolicy = {
    batchSize: boundedInteger(env, 'EMBEDDING_BATCH_SIZE', 16, 1, 256),
    maxAttempts: boundedInteger(env, 'EMBEDDING_MAX_ATTEMPTS', 3, 1, 10),
    backoffBaseMs: boundedInteger(
      env,
      'EMBEDDING_BACKOFF_BASE_MS',
      100,
      0,
      60_000,
    ),
    backoffMaxMs: boundedInteger(
      env,
      'EMBEDDING_BACKOFF_MAX_MS',
      2_000,
      1,
      120_000,
    ),
    leaseDurationMs: boundedInteger(
      env,
      'EMBEDDING_LEASE_DURATION_MS',
      60_000,
      1_000,
      600_000,
    ),
  };

  return {
    profile: {
      name: 'e2-embedding-v1',
      version: '1',
      inputEncoding: 'utf8',
      normalization: { name: 'e2-utf8-exact-v1', version: '1' },
      truncation: {
        name: 'e2-reject-over-limit-v1',
        version: '1',
        maxInputCodePoints: boundedInteger(
          env,
          'EMBEDDING_MAX_INPUT_CODE_POINTS',
          10_000,
          1,
          1_000_000,
        ),
      },
      adapterVersion: '1',
    },
    execution,
  };
}
