import type { RetrievalConfig, RetrievalDistanceMetric, RetrievalPolicy } from './retrieval.types';

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
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function optionalFiniteNumber(env: NodeJS.ProcessEnv, name: string): number | undefined {
  const raw = env[name];
  if (raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number.`);
  return value;
}

function distanceMetric(value: string | undefined): RetrievalDistanceMetric {
  if (value === undefined || value === 'cosine') return 'cosine';
  if (value === 'inner-product' || value === 'l2') return value;
  throw new Error('RETRIEVAL_DISTANCE_METRIC must be cosine, inner-product, or l2.');
}

export function createRetrievalConfig(env: NodeJS.ProcessEnv = process.env): RetrievalConfig {
  return {
    distanceMetric: distanceMetric(env.RETRIEVAL_DISTANCE_METRIC),
    defaultTopK: boundedInteger(env, 'RETRIEVAL_DEFAULT_TOP_K', 8, 1, 50),
    defaultCandidateLimit: boundedInteger(
      env,
      'RETRIEVAL_DEFAULT_CANDIDATE_LIMIT',
      32,
      1,
      200,
    ),
    maxTopK: boundedInteger(env, 'RETRIEVAL_MAX_TOP_K', 50, 1, 200),
    maxCandidateLimit: boundedInteger(
      env,
      'RETRIEVAL_MAX_CANDIDATE_LIMIT',
      200,
      1,
      1_000,
    ),
    ...(optionalFiniteNumber(env, 'RETRIEVAL_MIN_SCORE') === undefined
      ? {}
      : { minRetrievalScore: optionalFiniteNumber(env, 'RETRIEVAL_MIN_SCORE') }),
  };
}

export function normalizeRetrievalPolicy(
  input: Partial<RetrievalPolicy>,
  config: RetrievalConfig,
): RetrievalPolicy {
  const topK = input.topK ?? config.defaultTopK;
  const candidateLimit = input.candidateLimit ?? config.defaultCandidateLimit;
  if (!Number.isInteger(topK) || topK < 1 || topK > config.maxTopK) {
    throw new Error(`topK must be an integer between 1 and ${config.maxTopK}.`);
  }
  if (
    !Number.isInteger(candidateLimit) ||
    candidateLimit < topK ||
    candidateLimit > config.maxCandidateLimit
  ) {
    throw new Error(
      `candidateLimit must be an integer between topK and ${config.maxCandidateLimit}.`,
    );
  }
  const minRetrievalScore = input.minRetrievalScore ?? config.minRetrievalScore;
  return {
    topK,
    candidateLimit,
    ...(minRetrievalScore === undefined ? {} : { minRetrievalScore }),
  };
}
