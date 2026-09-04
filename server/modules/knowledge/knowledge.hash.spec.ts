import { createHash } from 'node:crypto';

import {
  computeChunkTextHash,
  computeDerivationFingerprint,
  hashTextInputExact,
} from './knowledge.hash';

describe('knowledge hashing', () => {
  it.each(['', 'ASCII text', '中文文本', 'emoji 😀', 'a\r\nb', ' trailing  '])(
    'hashes exact UTF-8 text without normalization: %j',
    (text) => {
      const expected = createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
      expect(hashTextInputExact(text)).toBe(expected);
      expect(computeChunkTextHash(text)).toBe(expected);
    },
  );

  it('keeps composed and decomposed Unicode distinct', () => {
    expect(hashTextInputExact('é')).not.toBe(hashTextInputExact('e\u0301'));
  });

  it('computes a stable fingerprint and omits absent optional profiles', () => {
    const base = {
      originalContentHash: 'a'.repeat(64),
      parserProfile: { name: 'c1-document-parser-v1', version: '1' },
      chunkingProfile: {
        name: 'c3-default',
        version: '1',
        parameters: { maxSize: 100 },
      },
    };
    const reordered = {
      chunkingProfile: base.chunkingProfile,
      parserProfile: base.parserProfile,
      originalContentHash: base.originalContentHash,
    };

    expect(computeDerivationFingerprint(base)).toBe(computeDerivationFingerprint(reordered));
    expect(computeDerivationFingerprint(base)).not.toBe(
      computeDerivationFingerprint({
        ...base,
        normalizedContentHash: 'b'.repeat(64),
      }),
    );
  });

  it('uses only derivation inputs, so request metadata cannot change the fingerprint', () => {
    const request = {
      displayName: 'Draft A',
      idempotencyKey: 'request-a',
      storageReference: 'storage-a',
      originalContentHash: 'a'.repeat(64),
      parserProfile: { name: 'c1-document-parser-v1', version: '1' },
      chunkingProfile: { name: 'c3-default', version: '1', parameters: { maxSize: 100 } },
    };
    const derive = (input: typeof request) => computeDerivationFingerprint({
      originalContentHash: input.originalContentHash,
      parserProfile: input.parserProfile,
      chunkingProfile: input.chunkingProfile,
    });

    expect(derive(request)).toBe(derive({ ...request, displayName: 'Draft B', idempotencyKey: 'request-b', storageReference: 'storage-b' }));
  });

  it.each([
    ['content hash', { originalContentHash: 'b'.repeat(64) }],
    ['parser profile', { parserProfile: { name: 'c1-document-parser-v1', version: '2' } }],
    ['chunking profile', { chunkingProfile: { name: 'c3-default', version: '1', parameters: { maxSize: 200 } } }],
  ])('changes when %s changes', (_label, change) => {
    const base = {
      originalContentHash: 'a'.repeat(64),
      parserProfile: { name: 'c1-document-parser-v1', version: '1' },
      chunkingProfile: { name: 'c3-default', version: '1', parameters: { maxSize: 100 } },
    };
    expect(computeDerivationFingerprint(base)).not.toBe(computeDerivationFingerprint({ ...base, ...change }));
  });
});
