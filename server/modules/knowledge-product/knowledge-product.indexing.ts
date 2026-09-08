import { Inject, Injectable } from '@nestjs/common';

import type { KnowledgeRepositoryPort } from '../knowledge/knowledge.repository';
import {
  KnowledgeIndexRepository,
  type KnowledgeIndexRepositoryPort,
} from '../knowledge/indexing/knowledge-index.repository';
import type { KnowledgeEmbeddingIndex } from '../knowledge/indexing/knowledge-indexing.types';
import { KnowledgeIndexingService } from '../knowledge/indexing/knowledge-indexing.service';
import { KnowledgeRepository } from '../knowledge/knowledge.repository';
import { KnowledgeProductError } from './knowledge-product.errors';

type ProductKnowledgeRepository = Required<
  Pick<KnowledgeRepositoryPort, 'getDocument' | 'getVersion'>
>;

type ProductIndexRepository = Pick<
  KnowledgeIndexRepositoryPort,
  'getIndex' | 'getLatestIndexForVersion'
>;

type ProductIndexingService = Pick<
  KnowledgeIndexingService,
  'indexVersion' | 'retryIndex'
>;

@Injectable()
export class KnowledgeProductIndexingService {
  constructor(
    @Inject(KnowledgeRepository)
    private readonly knowledge: ProductKnowledgeRepository,
    @Inject(KnowledgeIndexRepository)
    private readonly indexes: ProductIndexRepository,
    @Inject(KnowledgeIndexingService)
    private readonly indexing: ProductIndexingService,
  ) {}

  async indexActiveVersion(
    userId: string,
    documentId: string,
  ): Promise<KnowledgeEmbeddingIndex> {
    const version = await this.requireIndexableVersion(userId, documentId);
    const existing = await this.indexes.getLatestIndexForVersion(userId, version.id);
    if (existing) return existing;

    try {
      return await this.indexing.indexVersion({
        userId,
        documentVersionId: version.id,
      });
    } catch (error) {
      throw this.mapIndexingError(error);
    }
  }

  async getIndexStatus(
    userId: string,
    documentId: string,
  ): Promise<KnowledgeEmbeddingIndex | null> {
    const document = await this.knowledge.getDocument(userId, documentId);
    if (!document || document.userId !== userId || document.lifecycleStatus !== 'active') {
      throw this.notFound();
    }
    if (!document.activeVersionId) return null;
    const version = await this.knowledge.getVersion(userId, document.activeVersionId);
    if (
      !version ||
      version.userId !== userId ||
      version.documentId !== document.id ||
      version.lifecycleStatus !== 'active' ||
      version.readinessStatus !== 'content-ready-for-indexing'
    ) {
      return null;
    }
    return this.indexes.getLatestIndexForVersion(userId, version.id);
  }

  async retryIndex(userId: string, indexId: string): Promise<KnowledgeEmbeddingIndex> {
    const existing = await this.indexes.getIndex(userId, indexId);
    if (!existing) {
      throw new KnowledgeProductError(
        'KNOWLEDGE_PRODUCT_INDEX_NOT_FOUND',
        'The embedding index was not found.',
        404,
      );
    }
    if (existing.status !== 'failed' && existing.status !== 'stale') {
      throw new KnowledgeProductError(
        'KNOWLEDGE_PRODUCT_INDEX_NOT_RETRYABLE',
        'The embedding index cannot be retried from its current state.',
        409,
      );
    }
    try {
      return await this.indexing.retryIndex({ userId, indexId });
    } catch (error) {
      throw this.mapIndexingError(error);
    }
  }

  private async requireIndexableVersion(
    userId: string,
    documentId: string,
  ) {
    const document = await this.knowledge.getDocument(userId, documentId);
    if (!document || document.userId !== userId || document.lifecycleStatus !== 'active') {
      throw this.notFound();
    }
    if (!document.activeVersionId) {
      throw new KnowledgeProductError(
        'KNOWLEDGE_PRODUCT_NO_ACTIVE_VERSION',
        'The workspace document has no active version.',
        409,
      );
    }
    const version = await this.knowledge.getVersion(userId, document.activeVersionId);
    if (
      !version ||
      version.userId !== userId ||
      version.documentId !== document.id
    ) {
      throw new KnowledgeProductError(
        'KNOWLEDGE_PRODUCT_NO_ACTIVE_VERSION',
        'The workspace document active version is unavailable.',
        409,
      );
    }
    if (
      version.lifecycleStatus !== 'active' ||
      version.readinessStatus !== 'content-ready-for-indexing'
    ) {
      throw new KnowledgeProductError(
        'KNOWLEDGE_PRODUCT_NOT_READY',
        'The workspace document is not ready for indexing.',
        409,
      );
    }
    return version;
  }

  private notFound(): KnowledgeProductError {
    return new KnowledgeProductError(
      'KNOWLEDGE_PRODUCT_NOT_FOUND',
      'The workspace document was not found.',
      404,
    );
  }

  private mapIndexingError(error: unknown): KnowledgeProductError {
    if (error instanceof KnowledgeProductError) return error;
    return new KnowledgeProductError(
      'KNOWLEDGE_PRODUCT_UNAVAILABLE',
      'Knowledge indexing is unavailable or failed.',
      503,
    );
  }
}
