import { Inject, Injectable } from '@nestjs/common';
import {
  EMBEDDING_CONFIG,
} from '../indexing/embedding.config';
import {
  EMBEDDING_PROVIDER,
  type EmbeddingProvider,
} from '../indexing/embedding.provider';
import type { EmbeddingConfig } from '../indexing/embedding.types';
import { createQueryEmbeddingRuntime } from './query-embedding';
import { createRetrievalConfig, normalizeRetrievalPolicy, RETRIEVAL_CONFIG } from './retrieval.config';
import type {
  RetrievalConfig,
  RetrievalFilters,
  RetrievalPolicy,
  RetrievalVersionSelection,
} from './retrieval.types';
import {
  KnowledgeRetrievalRepository,
  type KnowledgeRetrievalRepositoryPort,
  type RetrievedChunkRow,
} from './knowledge-retrieval.repository';
import { selectVersionScope } from './version-selection';

export interface KnowledgeRetrievalInput {
  userId: string;
  queryText: string;
  selection?: RetrievalVersionSelection;
  filters?: RetrievalFilters;
  policy?: Partial<RetrievalPolicy>;
}

export interface RetrievalDiagnostic {
  code: 'profile-unavailable' | 'materialization-unavailable' | 'threshold-excluded';
  documentVersionId?: string;
}

export interface RetrievalResultItem extends RetrievedChunkRow {
  rank: number;
  retrievalScore: number;
}

export interface RetrievalResult {
  status: 'complete' | 'partial' | 'empty';
  selectedVersionIds: string[];
  items: RetrievalResultItem[];
  diagnostics: RetrievalDiagnostic[];
  profile?: {
    provider: string;
    model: string;
    modelRevision?: string;
    dimensions: number;
    embeddingProfileFingerprint: string;
    distanceMetric: 'cosine' | 'inner-product' | 'l2';
  };
}

@Injectable()
export class KnowledgeRetrievalService {
  private readonly retrievalConfig: RetrievalConfig;

  constructor(
    @Inject(KnowledgeRetrievalRepository)
    private readonly repository: KnowledgeRetrievalRepositoryPort,
    @Inject(EMBEDDING_PROVIDER) private readonly provider: EmbeddingProvider,
    @Inject(EMBEDDING_CONFIG) private readonly embeddingConfig: EmbeddingConfig,
    @Inject(RETRIEVAL_CONFIG) retrievalConfig: RetrievalConfig = createRetrievalConfig(),
  ) {
    this.retrievalConfig = retrievalConfig;
  }

  async retrieve(input: KnowledgeRetrievalInput): Promise<RetrievalResult> {
    const selection = input.selection ?? { mode: 'active' as const };
    const candidates =
      selection.mode === 'active'
        ? await this.repository.resolveActiveCandidates({
            userId: input.userId,
            filters: input.filters,
          })
        : await this.repository.resolveExplicitCandidates({
            userId: input.userId,
            documentVersionIds: selection.documentVersionIds,
            filters: input.filters,
          });
    const scope = selectVersionScope(selection, candidates);
    if (scope.length === 0) {
      return {
        status: 'empty',
        selectedVersionIds: [],
        items: [],
        diagnostics: [],
      };
    }
    const policy = normalizeRetrievalPolicy(input.policy ?? {}, this.retrievalConfig);
    const runtime = await createQueryEmbeddingRuntime({
      queryText: input.queryText,
      provider: this.provider,
      embeddingConfig: this.embeddingConfig,
      retrievalConfig: this.retrievalConfig,
      policy,
    });
    const search = await this.repository.searchIndexedChunks({
      userId: input.userId,
      versionIds: scope.map((item) => item.version.id),
      vector: runtime.vector,
      identity: runtime.identity,
      embeddingProfileFingerprint: runtime.embeddingProfileFingerprint,
      distanceMetric: runtime.distanceMetric,
      candidateLimit: runtime.policy.candidateLimit,
    });
    const diagnostics: RetrievalDiagnostic[] = search.profileUnavailableVersionIds.map(
      (documentVersionId) => ({ code: 'profile-unavailable', documentVersionId }),
    );
    diagnostics.push(
      ...search.unavailableVersionIds.map((documentVersionId) => ({
        code: 'materialization-unavailable' as const,
        documentVersionId,
      })),
    );
    const filtered = search.items.filter((item) => {
      const score = scoreDistance(runtime.distanceMetric, item.rawDistance);
      return runtime.policy.minRetrievalScore === undefined || score >= runtime.policy.minRetrievalScore;
    });
    if (filtered.length !== search.items.length) diagnostics.push({ code: 'threshold-excluded' });
    const items = filtered.slice(0, runtime.policy.topK).map((item, index) => ({
      ...item,
      rank: index + 1,
      retrievalScore: scoreDistance(runtime.distanceMetric, item.rawDistance),
    }));
    const hasAvailabilityDiagnostic = diagnostics.some(
      (diagnostic) =>
        diagnostic.code === 'profile-unavailable' ||
        diagnostic.code === 'materialization-unavailable',
    );
    const status =
      items.length === 0
        ? hasAvailabilityDiagnostic
          ? 'partial'
          : 'empty'
        : hasAvailabilityDiagnostic || diagnostics.length > 0 || items.length < runtime.policy.topK
          ? 'partial'
          : 'complete';
    return {
      status,
      selectedVersionIds: scope.map((item) => item.version.id),
      items,
      diagnostics,
      profile: {
        provider: runtime.identity.provider,
        model: runtime.identity.model,
        ...(runtime.identity.modelRevision === undefined ? {} : { modelRevision: runtime.identity.modelRevision }),
        dimensions: runtime.identity.dimensions,
        embeddingProfileFingerprint: runtime.embeddingProfileFingerprint,
        distanceMetric: runtime.distanceMetric,
      },
    };
  }
}

function scoreDistance(metric: 'cosine' | 'inner-product' | 'l2', distance: number): number {
  return metric === 'cosine' ? 1 - distance : -distance;
}

export type { KnowledgeRetrievalRepositoryPort } from './knowledge-retrieval.repository';
