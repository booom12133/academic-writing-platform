import { createHash } from 'node:crypto';
import type { EmbeddingProvider } from './embedding.provider';
import type {
  EmbeddingHealth,
  EmbeddingModelIdentity,
  EmbeddingRequest,
  EmbeddingResult,
} from './embedding.types';

const DEFAULT_IDENTITY: EmbeddingModelIdentity = {
  provider: 'deterministic-fake',
  model: 'fake-embedding-v1',
  modelRevision: 'fake-revision-1',
  dimensions: 8,
};

export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  private readonly identity: EmbeddingModelIdentity;

  constructor(identity: EmbeddingModelIdentity = DEFAULT_IDENTITY) {
    this.identity = { ...identity };
  }

  async getIdentity(): Promise<EmbeddingModelIdentity> {
    return { ...this.identity };
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    return {
      identity: await this.getIdentity(),
      items: request.items.map((item) => ({
        inputFingerprint: item.inputFingerprint,
        vector: this.vectorFor(item.inputFingerprint, item.text),
      })),
      usage: {
        inputItems: request.items.length,
        inputCodePoints: request.items.reduce((sum, item) => sum + Array.from(item.text).length, 0),
      },
    };
  }

  async checkHealth(): Promise<EmbeddingHealth> {
    return {
      configured: true,
      provider: this.identity.provider,
      reachable: true,
      model: this.identity.model,
      dimensions: this.identity.dimensions,
    };
  }

  private vectorFor(inputFingerprint: string, text: string): number[] {
    const digest = createHash('sha256')
      .update(inputFingerprint, 'utf8')
      .update('\0', 'utf8')
      .update(text, 'utf8')
      .digest();
    return Array.from({ length: this.identity.dimensions }, (_, index) =>
      (digest[index % digest.length] / 127.5) - 1,
    );
  }
}
