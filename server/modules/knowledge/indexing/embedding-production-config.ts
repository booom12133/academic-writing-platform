export interface EmbeddingProductionConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  modelRevision?: string;
  dimensions: number;
  timeoutMs: number;
}

export const APPROVED_EMBEDDING_BASE_URL = 'https://api.siliconflow.cn/v1';
export const APPROVED_EMBEDDING_MODEL = 'BAAI/bge-m3';
export const APPROVED_EMBEDDING_DIMENSIONS = 1024;

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required for production embedding.`);
  return value;
}

function boundedInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  minimum: number,
  maximum: number,
): number {
  const value = Number(required(env, name));
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

export function resolveEmbeddingProductionConfig(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingProductionConfig {
  const rawBaseUrl = required(env, 'EMBEDDING_BASE_URL').replace(/\/+$/u, '');
  let parsed: URL;
  try {
    parsed = new URL(rawBaseUrl);
  } catch {
    throw new Error('EMBEDDING_BASE_URL must be a valid HTTPS URL.');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('EMBEDDING_BASE_URL must use HTTPS in production.');
  }
  if (rawBaseUrl !== APPROVED_EMBEDDING_BASE_URL) {
    throw new Error(
      `EMBEDDING_BASE_URL must be ${APPROVED_EMBEDDING_BASE_URL} in production.`,
    );
  }

  const model = required(env, 'EMBEDDING_MODEL');
  if (model !== APPROVED_EMBEDDING_MODEL) {
    throw new Error(
      `EMBEDDING_MODEL must be ${APPROVED_EMBEDDING_MODEL} in production.`,
    );
  }
  const dimensions = boundedInteger(env, 'EMBEDDING_DIMENSIONS', 1, 8192);
  if (dimensions !== APPROVED_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `EMBEDDING_DIMENSIONS must be ${APPROVED_EMBEDDING_DIMENSIONS} in production.`,
    );
  }

  return {
    baseUrl: rawBaseUrl,
    apiKey: required(env, 'EMBEDDING_API_KEY'),
    model,
    ...(env.EMBEDDING_MODEL_REVISION?.trim()
      ? { modelRevision: env.EMBEDDING_MODEL_REVISION.trim() }
      : {}),
    dimensions,
    timeoutMs: boundedInteger(env, 'EMBEDDING_TIMEOUT_MS', 100, 120_000),
  };
}
