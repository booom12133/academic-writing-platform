export interface EmbeddingModelIdentity {
  provider: string;
  model: string;
  modelRevision?: string;
  dimensions: number;
}

export interface EmbeddingRequestItem {
  inputFingerprint: string;
  text: string;
}

export interface EmbeddingRequest {
  items: EmbeddingRequestItem[];
}

export interface EmbeddingResultItem {
  inputFingerprint: string;
  vector: number[];
}

export interface EmbeddingUsage {
  inputItems?: number;
  inputCodePoints?: number;
}

export interface EmbeddingResult {
  identity: EmbeddingModelIdentity;
  items: EmbeddingResultItem[];
  usage?: EmbeddingUsage;
}

export interface EmbeddingHealth {
  configured: boolean;
  provider: string;
  reachable: boolean;
  model: string;
  dimensions: number;
  error?: string;
}

export type EmbeddingProviderErrorKind =
  | 'transient'
  | 'rate-limited'
  | 'invalid-input'
  | 'unsupported-configuration'
  | 'permanent';

export class EmbeddingProviderError extends Error {
  constructor(
    public readonly kind: EmbeddingProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'EmbeddingProviderError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface EmbeddingProfile {
  name: string;
  version: string;
  inputEncoding: 'utf8';
  normalization: { name: string; version: string };
  truncation: { name: string; version: string; maxInputCodePoints: number };
  adapterVersion: string;
}

export interface EmbeddingExecutionPolicy {
  batchSize: number;
  maxAttempts: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
  leaseDurationMs: number;
}

export interface EmbeddingConfig {
  profile: EmbeddingProfile;
  execution: EmbeddingExecutionPolicy;
}
