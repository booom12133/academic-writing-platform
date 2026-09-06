import type {
  EmbeddingHealth,
  EmbeddingRequest,
  EmbeddingResult,
  EmbeddingModelIdentity,
} from './embedding.types';

export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');

export interface EmbeddingProvider {
  getIdentity(): Promise<EmbeddingModelIdentity>;
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;
  checkHealth(): Promise<EmbeddingHealth>;
}
