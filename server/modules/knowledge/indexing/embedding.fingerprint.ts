import { createHash } from 'node:crypto';
import type {
  EmbeddingModelIdentity,
  EmbeddingProfile,
} from './embedding.types';

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function computeEmbeddingProfileFingerprint(
  identity: EmbeddingModelIdentity,
  profile: EmbeddingProfile,
): string {
  return sha256(stableSerialize({ identity, profile }));
}

export function computeChunkInputFingerprint(input: {
  userId: string;
  documentVersionId: string;
  knowledgeChunkId: string;
  ordinal: number;
  e1IndexInputFingerprint: string;
  textHash: string;
}): string {
  return sha256(stableSerialize(input));
}

export function computeIndexFingerprint(input: {
  userId: string;
  documentVersionId: string;
  e1IndexInputFingerprint: string;
  profileFingerprint: string;
  orderedChunkInputFingerprints: string[];
  [key: string]: unknown;
}): string {
  return sha256(
    stableSerialize({
      userId: input.userId,
      documentVersionId: input.documentVersionId,
      e1IndexInputFingerprint: input.e1IndexInputFingerprint,
      profileFingerprint: input.profileFingerprint,
      orderedChunkInputFingerprints: input.orderedChunkInputFingerprints,
    }),
  );
}
