import { Injectable } from '@nestjs/common';

import type { EmbeddingProvider } from './embedding.provider';
import type {
  EmbeddingHealth,
  EmbeddingModelIdentity,
  EmbeddingRequest,
  EmbeddingResult,
} from './embedding.types';
import { EmbeddingProviderError } from './embedding.types';
import type { EmbeddingProductionConfig } from './embedding-production-config';

interface EmbeddingResponseItem {
  index?: unknown;
  embedding?: unknown;
}

interface EmbeddingResponse {
  data?: unknown;
  usage?: { prompt_tokens?: unknown; total_tokens?: unknown };
}

@Injectable()
// eslint-disable-next-line @darraghor/nestjs-typed/injectable-should-be-provided -- registered through EMBEDDING_PROVIDER.
export class OpenAiCompatibleEmbeddingProvider implements EmbeddingProvider {
  private readonly identity: EmbeddingModelIdentity;
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly config: EmbeddingProductionConfig,
    fetchImpl: typeof fetch = fetch,
  ) {
    this.fetchImpl = fetchImpl;
    this.identity = {
      provider: 'openai-compatible-embedding',
      model: config.model,
      ...(config.modelRevision ? { modelRevision: config.modelRevision } : {}),
      dimensions: config.dimensions,
    };
  }

  async getIdentity(): Promise<EmbeddingModelIdentity> {
    return { ...this.identity };
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    if (!request || !Array.isArray(request.items)) {
      throw new EmbeddingProviderError('invalid-input', 'Embedding request is invalid.');
    }
    if (request.items.length === 0) {
      return { identity: await this.getIdentity(), items: [] };
    }

    let response: Response;
    try {
      response = await this.request('/embeddings', {
        method: 'POST',
        body: JSON.stringify({
          model: this.config.model,
          input: request.items.map((item) => item.text),
        }),
      });
    } catch (error) {
      throw this.mapRequestError(error);
    }

    if (!response.ok) throw this.mapStatusError(response.status);
    let body: EmbeddingResponse;
    try {
      body = (await response.json()) as EmbeddingResponse;
    } catch {
      throw new EmbeddingProviderError('permanent', 'Embedding provider response was invalid.');
    }
    return {
      identity: await this.getIdentity(),
      items: this.mapResponse(request, body),
      usage: {
        inputItems: request.items.length,
        inputCodePoints: request.items.reduce(
          (total, item) => total + Array.from(item.text).length,
          0,
        ),
      },
    };
  }

  async checkHealth(): Promise<EmbeddingHealth> {
    try {
      const response = await this.request('/models', { method: 'GET' });
      if (!response.ok) {
        return this.degradedHealth();
      }
      return {
        configured: true,
        provider: this.identity.provider,
        reachable: true,
        model: this.identity.model,
        dimensions: this.identity.dimensions,
      };
    } catch {
      return this.degradedHealth();
    }
  }

  private async request(path: string, options: { method: string; body?: string }): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      return await this.fetchImpl(`${this.config.baseUrl}${path}`, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        ...(options.body === undefined ? {} : { body: options.body }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapResponse(request: EmbeddingRequest, body: EmbeddingResponse) {
    if (!Array.isArray(body.data) || body.data.length !== request.items.length) {
      throw new EmbeddingProviderError('permanent', 'Embedding provider response was invalid.');
    }
    const mapped = new Array<{ inputFingerprint: string; vector: number[] }>(request.items.length);
    for (const [position, raw] of body.data.entries()) {
      const item = raw as EmbeddingResponseItem;
      const index = item.index === undefined ? position : item.index;
      if (!Number.isInteger(index) || Number(index) < 0 || Number(index) >= request.items.length || mapped[Number(index)]) {
        throw new EmbeddingProviderError('permanent', 'Embedding provider response was invalid.');
      }
      if (!Array.isArray(item.embedding) || item.embedding.length !== this.config.dimensions || !item.embedding.every((value) => typeof value === 'number' && Number.isFinite(value))) {
        throw new EmbeddingProviderError('permanent', 'Embedding vector dimensions were invalid.');
      }
      mapped[Number(index)] = {
        inputFingerprint: request.items[Number(index)].inputFingerprint,
        vector: item.embedding as number[],
      };
    }
    if (mapped.some((item) => item === undefined)) {
      throw new EmbeddingProviderError('permanent', 'Embedding provider response was invalid.');
    }
    return mapped;
  }

  private mapRequestError(error: unknown): EmbeddingProviderError {
    if (error instanceof EmbeddingProviderError) return error;
    if ((error as { name?: string })?.name === 'AbortError') {
      return new EmbeddingProviderError('transient', 'Embedding provider request timed out.');
    }
    return new EmbeddingProviderError('transient', 'Embedding provider request failed.');
  }

  private mapStatusError(status: number): EmbeddingProviderError {
    if (status === 429) return new EmbeddingProviderError('rate-limited', 'Embedding provider rate limit reached.');
    if (status === 408 || status >= 500) return new EmbeddingProviderError('transient', 'Embedding provider is temporarily unavailable.');
    if (status === 400 || status === 422) return new EmbeddingProviderError('invalid-input', 'Embedding provider rejected the request.');
    return new EmbeddingProviderError('permanent', 'Embedding provider request failed.');
  }

  private degradedHealth(): EmbeddingHealth {
    return {
      configured: true,
      provider: this.identity.provider,
      reachable: false,
      model: this.identity.model,
      dimensions: this.identity.dimensions,
      error: 'embedding_provider_unreachable',
    };
  }

  private numeric(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }
}
