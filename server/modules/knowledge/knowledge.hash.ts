import { createHash } from 'node:crypto';

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }
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

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hashTextInputExact(text: string): string {
  return sha256(Buffer.from(text, 'utf8'));
}

export function computeChunkTextHash(text: string): string {
  return hashTextInputExact(text);
}

export function computeDerivationFingerprint(input: {
  originalContentHash: string;
  normalizedContentHash?: string;
  parserProfile: { name: string; version: string };
  normalizationProfile?: { name: string; version: string };
  chunkingProfile: { name: string; version: string; parameters: { maxSize: number } };
}): string {
  return sha256(stableSerialize(input));
}
