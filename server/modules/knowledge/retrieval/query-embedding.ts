import { createHash } from 'node:crypto';
import type { EmbeddingProvider } from '../indexing/embedding.provider';
import type {
  EmbeddingConfig,
  EmbeddingModelIdentity,
} from '../indexing/embedding.types';
import {
  createRetrievalConfig,
  normalizeRetrievalPolicy,
} from './retrieval.config';
import { RetrievalError } from './retrieval.errors';
import { resolveRetrievalProfile } from './retrieval.profile';
import type {
  QueryEmbeddingRuntime,
  RetrievalConfig,
  RetrievalPolicy,
} from './retrieval.types';

export interface CreateQueryEmbeddingRuntimeInput {
  queryText: string;
  provider: EmbeddingProvider;
  embeddingConfig: EmbeddingConfig;
  retrievalConfig?: RetrievalConfig;
  policy?: Partial<RetrievalPolicy>;
}

function sameIdentity(
  left: EmbeddingModelIdentity,
  right: EmbeddingModelIdentity,
): boolean {
  return (
    left.provider === right.provider &&
    left.model === right.model &&
    left.modelRevision === right.modelRevision &&
    left.dimensions === right.dimensions
  );
}

function queryFingerprint(queryText: string, profileFingerprint: string): string {
  return createHash('sha256')
    .update('e3-query-v1\0', 'utf8')
    .update(profileFingerprint, 'utf8')
    .update('\0', 'utf8')
    .update(queryText, 'utf8')
    .digest('hex');
}

export async function createQueryEmbeddingRuntime(
  input: CreateQueryEmbeddingRuntimeInput,
): Promise<QueryEmbeddingRuntime> {
  if (!input.queryText || Array.from(input.queryText).length === 0) {
    throw new RetrievalError('RETRIEVAL_INVALID_QUERY', 'Query text is required.');
  }
  if (
    Array.from(input.queryText).length >
    input.embeddingConfig.profile.truncation.maxInputCodePoints
  ) {
    throw new RetrievalError(
      'RETRIEVAL_INVALID_QUERY',
      'Query text exceeds the embedding profile input limit.',
    );
  }

  const retrievalConfig = input.retrievalConfig ?? createRetrievalConfig({});
  const policy = normalizeRetrievalPolicy(input.policy ?? {}, retrievalConfig);
  let identity: EmbeddingModelIdentity;
  try {
    identity = await input.provider.getIdentity();
  } catch (error) {
    throw new RetrievalError(
      'RETRIEVAL_QUERY_EMBEDDING_FAILED',
      error instanceof Error ? error.message : 'Embedding provider identity failed.',
    );
  }

  const profile = resolveRetrievalProfile(
    identity,
    input.embeddingConfig,
    retrievalConfig,
  );
  const inputFingerprint = queryFingerprint(
    input.queryText,
    profile.embeddingProfileFingerprint,
  );
  let result;
  try {
    result = await input.provider.embed({
      items: [{ inputFingerprint, text: input.queryText }],
    });
  } catch (error) {
    throw new RetrievalError(
      'RETRIEVAL_QUERY_EMBEDDING_FAILED',
      error instanceof Error ? error.message : 'Embedding provider failed.',
    );
  }

  const item = result.items[0];
  if (
    !sameIdentity(result.identity, identity) ||
    result.items.length !== 1 ||
    !item ||
    item.inputFingerprint !== inputFingerprint ||
    item.vector.length !== identity.dimensions ||
    item.vector.some((value) => !Number.isFinite(value))
  ) {
    throw new RetrievalError(
      'RETRIEVAL_QUERY_EMBEDDING_FAILED',
      'Embedding provider returned an incompatible query vector.',
    );
  }

  return {
    ...profile,
    policy,
    queryInputFingerprint: inputFingerprint,
    vector: item.vector,
  };
}
