import type {
  EmbeddingModelIdentity,
  EmbeddingProfile,
} from '../indexing/embedding.types';

export type RetrievalDistanceMetric = 'cosine' | 'inner-product' | 'l2';

export type RetrievalVersionSelection =
  | { mode: 'active' }
  | { mode: 'explicit'; documentVersionIds: string[] };

export interface RetrievalFilters {
  documentIds?: string[];
  sourceRecordIds?: string[];
  sourceKinds?: Array<'user-declared' | 'scholarly-work' | 'reference-library-item'>;
  originKinds?: Array<'user-upload' | 'generated-artifact' | 'external-attachment'>;
  sourceTypes?: Array<'docx' | 'pdf' | 'txt' | 'markdown'>;
}

export interface RetrievalPolicy {
  topK: number;
  candidateLimit: number;
  minRetrievalScore?: number;
}

export interface RetrievalConfig {
  distanceMetric: RetrievalDistanceMetric;
  defaultTopK: number;
  defaultCandidateLimit: number;
  maxTopK: number;
  maxCandidateLimit: number;
  minRetrievalScore?: number;
}

export interface RetrievalProfile {
  identity: EmbeddingModelIdentity;
  embeddingProfile: EmbeddingProfile;
  embeddingProfileFingerprint: string;
  distanceMetric: RetrievalDistanceMetric;
  policy: RetrievalPolicy;
}

export interface QueryEmbeddingRuntime extends RetrievalProfile {
  queryInputFingerprint: string;
  vector: number[];
}
