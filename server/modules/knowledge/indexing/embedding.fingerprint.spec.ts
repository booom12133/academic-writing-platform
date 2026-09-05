import {
  computeChunkInputFingerprint,
  computeEmbeddingProfileFingerprint,
  computeIndexFingerprint,
} from './embedding.fingerprint';
import type {
  EmbeddingModelIdentity,
  EmbeddingProfile,
} from './embedding.types';

const identity: EmbeddingModelIdentity = {
  provider: 'deterministic-fake',
  model: 'fake-embedding-v1',
  modelRevision: 'fake-revision-1',
  dimensions: 8,
};

const profile: EmbeddingProfile = {
  name: 'e2-embedding-v1',
  version: '1',
  inputEncoding: 'utf8',
  normalization: { name: 'e2-utf8-exact-v1', version: '1' },
  truncation: {
    name: 'e2-reject-over-limit-v1',
    version: '1',
    maxInputCodePoints: 10_000,
  },
  adapterVersion: '1',
};

describe('embedding fingerprints', () => {
  const chunkIdentity = {
    userId: 'user-1',
    documentVersionId: 'version-1',
    knowledgeChunkId: 'chunk-1',
    ordinal: 0,
    e1IndexInputFingerprint: 'a'.repeat(64),
    textHash: 'b'.repeat(64),
  };

  it('is stable for object key reordering and exact Unicode input', () => {
    expect(computeEmbeddingProfileFingerprint(identity, profile)).toBe(
      computeEmbeddingProfileFingerprint(
        { ...identity },
        {
          ...profile,
          truncation: { ...profile.truncation },
          normalization: { ...profile.normalization },
        },
      ),
    );

    expect(computeChunkInputFingerprint(chunkIdentity)).toBe(
      computeChunkInputFingerprint({
        textHash: 'b'.repeat(64),
        e1IndexInputFingerprint: 'a'.repeat(64),
        ordinal: 0,
        knowledgeChunkId: 'chunk-1',
        documentVersionId: 'version-1',
        userId: 'user-1',
      }),
    );
  });

  it('changes when any chunk semantic identity changes', () => {
    const base = computeEmbeddingProfileFingerprint(identity, profile);
    expect(
      computeEmbeddingProfileFingerprint(
        { ...identity, modelRevision: 'revision-2' },
        profile,
      ),
    ).not.toBe(base);
    expect(
      computeEmbeddingProfileFingerprint(
        { ...identity, dimensions: 16 },
        profile,
      ),
    ).not.toBe(base);
    expect(
      computeEmbeddingProfileFingerprint(identity, {
        ...profile,
        truncation: { ...profile.truncation, maxInputCodePoints: 20_000 },
      }),
    ).not.toBe(base);
    for (const change of [
      { knowledgeChunkId: 'chunk-2' },
      { ordinal: 1 },
      { textHash: 'c'.repeat(64) },
      { e1IndexInputFingerprint: 'c'.repeat(64) },
      { documentVersionId: 'version-2' },
      { userId: 'user-2' },
    ]) {
      expect(
        computeChunkInputFingerprint({ ...chunkIdentity, ...change }),
      ).not.toBe(computeChunkInputFingerprint(chunkIdentity));
    }
  });

  it('does not include execution policy or distance metric inputs', () => {
    const base = computeIndexFingerprint({
      userId: 'user-1',
      documentVersionId: 'version-1',
      e1IndexInputFingerprint: 'a'.repeat(64),
      profileFingerprint: 'b'.repeat(64),
      orderedChunkInputFingerprints: ['c'.repeat(64), 'd'.repeat(64)],
    });
    const withExecutionOnlyChanges = computeIndexFingerprint({
      userId: 'user-1',
      documentVersionId: 'version-1',
      e1IndexInputFingerprint: 'a'.repeat(64),
      profileFingerprint: 'b'.repeat(64),
      orderedChunkInputFingerprints: ['c'.repeat(64), 'd'.repeat(64)],
      executionPolicy: {
        batchSize: 64,
        maxAttempts: 8,
        backoffBaseMs: 900,
        backoffMaxMs: 9_000,
        leaseDurationMs: 300_000,
      },
      distanceMetric: 'cosine',
    });

    expect(withExecutionOnlyChanges).toBe(base);
    expect(
      computeIndexFingerprint({
        userId: 'user-2',
        documentVersionId: 'version-1',
        e1IndexInputFingerprint: 'a'.repeat(64),
        profileFingerprint: 'b'.repeat(64),
        orderedChunkInputFingerprints: ['c'.repeat(64), 'd'.repeat(64)],
      }),
    ).not.toBe(base);
    expect(
      computeIndexFingerprint({
        userId: 'user-1',
        documentVersionId: 'version-1',
        e1IndexInputFingerprint: 'a'.repeat(64),
        profileFingerprint: 'b'.repeat(64),
        orderedChunkInputFingerprints: ['d'.repeat(64), 'c'.repeat(64)],
      }),
    ).not.toBe(base);
  });
});
