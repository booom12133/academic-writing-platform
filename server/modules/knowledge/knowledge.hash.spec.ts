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
});
