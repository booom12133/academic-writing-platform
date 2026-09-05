import {
  canTransitionIndexStatus,
  transitionIndexStatus,
} from './knowledge-indexing.lifecycle';
import type { KnowledgeEmbeddingIndexStatus } from './knowledge-indexing.types';

describe('knowledge embedding index lifecycle', () => {
  it.each([
    ['indexing', 'indexed'],
    ['indexing', 'failed'],
    ['failed', 'indexing'],
    ['indexed', 'stale'],
    ['indexing', 'stale'],
    ['stale', 'indexing'],
  ] as Array<[KnowledgeEmbeddingIndexStatus, KnowledgeEmbeddingIndexStatus]>)(
    'allows %s to %s',
    (from, to) => {
      expect(canTransitionIndexStatus(from, to)).toBe(true);
      expect(transitionIndexStatus(from, to)).toBe(to);
    },
  );

  it.each([
    ['indexed', 'indexing'],
    ['stale', 'indexed'],
    ['failed', 'stale'],
  ] as Array<[KnowledgeEmbeddingIndexStatus, KnowledgeEmbeddingIndexStatus]>)(
    'rejects %s to %s',
    (from, to) => {
      expect(canTransitionIndexStatus(from, to)).toBe(false);
      expect(() => transitionIndexStatus(from, to)).toThrow(
        'Invalid embedding index lifecycle transition',
      );
    },
  );
});
