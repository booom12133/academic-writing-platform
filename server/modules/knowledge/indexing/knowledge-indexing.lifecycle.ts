import type { KnowledgeEmbeddingIndexStatus } from './knowledge-indexing.types';

const transitions: ReadonlySet<string> = new Set([
  'indexing:indexed',
  'indexing:failed',
  'failed:indexing',
  'indexed:stale',
]);

export function canTransitionIndexStatus(
  from: KnowledgeEmbeddingIndexStatus,
  to: KnowledgeEmbeddingIndexStatus,
): boolean {
  return transitions.has(`${from}:${to}`);
}

export function transitionIndexStatus(
  from: KnowledgeEmbeddingIndexStatus,
  to: KnowledgeEmbeddingIndexStatus,
): KnowledgeEmbeddingIndexStatus {
  if (!canTransitionIndexStatus(from, to)) {
    throw new Error(`Invalid embedding index lifecycle transition: ${from} -> ${to}`);
  }
  return to;
}
