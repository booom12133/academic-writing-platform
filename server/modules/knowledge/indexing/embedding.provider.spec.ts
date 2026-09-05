import {
  EMBEDDING_PROVIDER,
  type EmbeddingProvider,
} from './embedding.provider';
import { TEXT_GENERATION_PROVIDER } from '../../ai-tools/llm/text-generation.provider';
import { DeterministicEmbeddingProvider } from './embedding.fake';

describe('EmbeddingProvider boundary', () => {
  it('uses an independent token and contract from text generation', () => {
    expect(EMBEDDING_PROVIDER).not.toBe(TEXT_GENERATION_PROVIDER);

    const provider: EmbeddingProvider = new DeterministicEmbeddingProvider();
    expect(provider.embed).toBeInstanceOf(Function);
    expect(provider.getIdentity).toBeInstanceOf(Function);
    expect(provider.checkHealth).toBeInstanceOf(Function);
    expect(provider).not.toHaveProperty('generate');
  });

  it('returns deterministic vectors in the exact input order', async () => {
    const provider = new DeterministicEmbeddingProvider({
      provider: 'deterministic-fake',
      model: 'fake-embedding-v1',
      modelRevision: 'fake-revision-1',
      dimensions: 4,
    });
    const request = {
      items: [
        { inputFingerprint: 'a'.repeat(64), text: '中文 😀\r\n文本' },
        { inputFingerprint: 'b'.repeat(64), text: 'second' },
      ],
    };

    const first = await provider.embed(request);
    const second = await provider.embed(request);

    expect(first).toEqual(second);
    expect(first.identity).toMatchObject({
      provider: 'deterministic-fake',
      model: 'fake-embedding-v1',
      modelRevision: 'fake-revision-1',
      dimensions: 4,
    });
    expect(first.items.map((item) => item.inputFingerprint)).toEqual([
      'a'.repeat(64),
      'b'.repeat(64),
    ]);
    expect(first.items.every((item) => item.vector.length === 4)).toBe(true);
    expect(first.items.flatMap((item) => item.vector).every(Number.isFinite)).toBe(true);
  });
});
