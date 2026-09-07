import {
  EmbeddingProviderError,
} from './embedding.types';
import { OpenAiCompatibleEmbeddingProvider } from './openai-compatible-embedding.provider';

const config = {
  baseUrl: 'https://embedding.example.com',
  apiKey: 'secret-key',
  model: 'text-embedding-3-small',
  modelRevision: '2026-01',
  dimensions: 3,
  timeoutMs: 500,
};

const request = {
  items: [
    { inputFingerprint: 'a'.repeat(64), text: 'first text' },
    { inputFingerprint: 'b'.repeat(64), text: 'second text' },
  ],
};

describe('OpenAiCompatibleEmbeddingProvider', () => {
  it('sends the compatible payload and restores request fingerprint order', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      model: config.model,
      data: [
        { index: 1, embedding: [0.1, 0.2, 0.3] },
        { index: 0, embedding: [0.4, 0.5, 0.6] },
      ],
      usage: { prompt_tokens: 2, total_tokens: 2 },
    }), { status: 200 }));
    const provider = new OpenAiCompatibleEmbeddingProvider(config, fetchImpl);

    await expect(provider.embed(request)).resolves.toMatchObject({
      identity: {
        provider: 'openai-compatible-embedding',
        model: config.model,
        modelRevision: config.modelRevision,
        dimensions: 3,
      },
      items: [
        { inputFingerprint: 'a'.repeat(64), vector: [0.4, 0.5, 0.6] },
        { inputFingerprint: 'b'.repeat(64), vector: [0.1, 0.2, 0.3] },
      ],
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://embedding.example.com/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer secret-key' }),
        body: JSON.stringify({ model: config.model, input: ['first text', 'second text'] }),
      }),
    );
  });

  it('rejects a response with the wrong vector dimension', async () => {
    const provider = new OpenAiCompatibleEmbeddingProvider(config, jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ index: 0, embedding: [0.1] }, { index: 1, embedding: [0.1, 0.2, 0.3] }] }), { status: 200 }),
    ));

    await expect(provider.embed(request)).rejects.toMatchObject({
      constructor: EmbeddingProviderError,
      kind: 'permanent',
    });
  });

  it.each([
    [429, 'rate-limited'],
    [500, 'transient'],
    [408, 'transient'],
  ])('maps upstream status %s to %s', async (status, kind) => {
    const provider = new OpenAiCompatibleEmbeddingProvider(config, jest.fn().mockResolvedValue(
      new Response('{}', { status }),
    ));

    await expect(provider.embed(request)).rejects.toMatchObject({ kind });
  });

  it('reports an unavailable provider as degraded health without throwing', async () => {
    const provider = new OpenAiCompatibleEmbeddingProvider(config, jest.fn().mockResolvedValue(
      new Response('{}', { status: 503 }),
    ));

    await expect(provider.checkHealth()).resolves.toEqual({
      configured: true,
      provider: 'openai-compatible-embedding',
      reachable: false,
      model: config.model,
      dimensions: config.dimensions,
      error: 'embedding_provider_unreachable',
    });
  });
});
