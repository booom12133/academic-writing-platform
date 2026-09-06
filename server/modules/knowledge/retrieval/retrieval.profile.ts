import {
  computeEmbeddingProfileFingerprint,
} from '../indexing/embedding.fingerprint';
import type {
  EmbeddingConfig,
  EmbeddingModelIdentity,
} from '../indexing/embedding.types';
import type {
  RetrievalConfig,
  RetrievalDistanceMetric,
  RetrievalProfile,
} from './retrieval.types';

export function resolveRetrievalProfile(
  identity: EmbeddingModelIdentity,
  embeddingConfig: EmbeddingConfig,
  retrievalConfig: RetrievalConfig,
): RetrievalProfile {
  if (!Number.isInteger(identity.dimensions) || identity.dimensions <= 0) {
    throw new Error('Embedding identity dimensions must be a positive integer.');
  }
  return {
    identity,
    embeddingProfile: embeddingConfig.profile,
    embeddingProfileFingerprint: computeEmbeddingProfileFingerprint(
      identity,
      embeddingConfig.profile,
    ),
    distanceMetric: retrievalConfig.distanceMetric,
    policy: {
      topK: retrievalConfig.defaultTopK,
      candidateLimit: retrievalConfig.defaultCandidateLimit,
      ...(retrievalConfig.minRetrievalScore === undefined
        ? {}
        : { minRetrievalScore: retrievalConfig.minRetrievalScore }),
    },
  };
}

export function distanceOperator(metric: RetrievalDistanceMetric): '<=>' | '<#>' | '<->' {
  if (metric === 'cosine') return '<=>';
  if (metric === 'inner-product') return '<#>';
  return '<->';
}

export function scoreDistance(metric: RetrievalDistanceMetric, distance: number): number {
  return metric === 'cosine' ? 1 - distance : -distance;
}
