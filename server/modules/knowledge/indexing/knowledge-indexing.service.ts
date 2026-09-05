import { Inject, Injectable } from '@nestjs/common';
import {
  computeChunkInputFingerprint,
  computeEmbeddingProfileFingerprint,
  computeIndexFingerprint,
} from './embedding.fingerprint';
import {
  EmbeddingProviderError,
  type EmbeddingConfig,
  type EmbeddingModelIdentity,
} from './embedding.types';
import {
  EMBEDDING_PROVIDER,
  type EmbeddingProvider,
} from './embedding.provider';
import {
  KnowledgeRepository,
  type KnowledgeRepositoryPort,
} from '../knowledge.repository';
import { computeChunkTextHash } from '../knowledge.hash';
import type {
  ClaimedEmbeddingBatch,
  EmbeddingSuccessItem,
  KnowledgeChunkEmbeddingManifestItem,
  KnowledgeEmbeddingIndex,
} from './knowledge-indexing.types';
import type {
  KnowledgeChunk,
  KnowledgeDocumentVersion,
} from '../knowledge.types';
import {
  KnowledgeIndexRepository,
  type KnowledgeIndexRepositoryPort,
} from './knowledge-index.repository';
import { EMBEDDING_CONFIG } from './embedding.config';

interface IndexVersionInput {
  userId: string;
  documentVersionId: string;
}

export interface KnowledgeIndexingResult extends KnowledgeEmbeddingIndex {}

type Sleep = (milliseconds: number) => Promise<void>;

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function sameIdentity(
  left: EmbeddingModelIdentity,
  right: EmbeddingModelIdentity,
): boolean {
  return (
    left.provider === right.provider &&
    left.model === right.model &&
    left.modelRevision === right.modelRevision &&
    left.dimensions === right.dimensions
  );
}

function errorDetails(error: unknown): {
  code: string;
  message: string;
  retryable: boolean;
} {
  if (error instanceof EmbeddingProviderError) {
    return {
      code: error.kind,
      message: error.message.slice(0, 512),
      retryable: error.kind === 'transient' || error.kind === 'rate-limited',
    };
  }
  return {
    code: 'permanent',
    message:
      error instanceof Error
        ? error.message.slice(0, 512)
        : 'Embedding provider failed.',
    retryable: false,
  };
}

@Injectable()
export class KnowledgeIndexingService {
  constructor(
    @Inject(KnowledgeRepository)
    private readonly knowledge: KnowledgeRepositoryPort,
    @Inject(KnowledgeIndexRepository)
    private readonly repository: KnowledgeIndexRepositoryPort,
    @Inject(EMBEDDING_PROVIDER) private readonly provider: EmbeddingProvider,
    @Inject(EMBEDDING_CONFIG) private readonly config: EmbeddingConfig,
    private readonly sleep: Sleep = defaultSleep,
  ) {}

  async indexVersion(
    input: IndexVersionInput,
  ): Promise<KnowledgeIndexingResult> {
    const context = await this.loadContext(input);
    const identity = await this.provider.getIdentity();
    const fingerprints = this.computeFingerprints(
      identity,
      context.chunks,
      context.version,
    );
    const result = await this.repository.createOrGetIndex({
      userId: input.userId,
      documentVersionId: context.version.id,
      e1IndexInputFingerprint: context.version.indexInputFingerprint,
      embeddingProfileFingerprint: fingerprints.profileFingerprint,
      indexFingerprint: fingerprints.indexFingerprint,
      embeddingModelIdentity: identity,
      totalChunks: context.chunks.length,
    });

    if (result.index.status === 'indexed') return result.index;
    if (result.index.status === 'stale') {
      throw new Error(
        'Embedding index is stale; use a new embedding profile or model configuration.',
      );
    }
    if (result.index.status === 'failed') {
      await this.repository.reopenFailedIndex(input.userId, result.index.id);
    } else if (result.created || result.index.status === 'indexing') {
      await this.repository.createChunkManifest(
        result.index.id,
        input.userId,
        fingerprints.manifest,
      );
    }

    return this.runIndex({
      index: result.index,
      userId: input.userId,
      version: context.version,
      chunks: context.chunks,
      identity,
      replacement: result.replacement === true,
    });
  }

  async reindexVersion(
    input: IndexVersionInput,
  ): Promise<KnowledgeIndexingResult> {
    return this.indexVersion(input);
  }

  async retryIndex(input: {
    userId: string;
    indexId: string;
  }): Promise<KnowledgeIndexingResult> {
    const index = await this.repository.getIndex(input.userId, input.indexId);
    if (!index) throw new Error('Embedding index not found.');
    if (index.status !== 'failed') {
      if (index.status === 'indexed') return index;
      throw new Error(
        `Embedding index cannot be retried from ${index.status}.`,
      );
    }

    const context = await this.loadContext({
      userId: input.userId,
      documentVersionId: index.documentVersionId,
    });
    const identity = await this.provider.getIdentity();
    const fingerprints = this.computeFingerprints(
      identity,
      context.chunks,
      context.version,
    );
    if (
      fingerprints.profileFingerprint !== index.embeddingProfileFingerprint ||
      fingerprints.indexFingerprint !== index.indexFingerprint
    ) {
      throw new Error(
        'Embedding index inputs no longer match the persisted materialization.',
      );
    }
    await this.repository.reopenFailedIndex(input.userId, index.id);
    return this.runIndex({
      index,
      userId: input.userId,
      version: context.version,
      chunks: context.chunks,
      identity,
      replacement: false,
    });
  }

  private async loadContext(
    input: IndexVersionInput,
  ): Promise<{ version: KnowledgeDocumentVersion; chunks: KnowledgeChunk[] }> {
    if (
      !this.knowledge.getVersion ||
      !this.knowledge.getChunks ||
      !this.knowledge.getDocument
    ) {
      throw new Error(
        'Knowledge persistence does not expose the E1 indexing inputs.',
      );
    }
    const version = await this.knowledge.getVersion(
      input.userId,
      input.documentVersionId,
    );
    if (
      !version ||
      version.userId !== input.userId ||
      version.id !== input.documentVersionId
    )
      throw new Error('Knowledge document version not found.');
    const document = await this.knowledge.getDocument(
      input.userId,
      version.documentId,
    );
    if (!document || document.userId !== input.userId)
      throw new Error('Knowledge document not found.');
    if (
      version.lifecycleStatus !== 'active' ||
      version.readinessStatus !== 'content-ready-for-indexing' ||
      document.lifecycleStatus !== 'active'
    ) {
      throw new Error('Knowledge document version is not indexable.');
    }
    const chunks = await this.knowledge.getChunks(input.userId, version.id);
    const ordered = [...chunks].sort(
      (left, right) => left.ordinal - right.ordinal,
    );
    if (
      ordered.some(
        (chunk, index) =>
          chunk.userId !== input.userId ||
          chunk.documentVersionId !== version.id ||
          chunk.ordinal !== index ||
          computeChunkTextHash(chunk.text) !== chunk.textHash,
      )
    ) {
      throw new Error(
        'Persisted E1 knowledge chunks are invalid for embedding.',
      );
    }
    return { version, chunks: ordered };
  }

  private computeFingerprints(
    identity: EmbeddingModelIdentity,
    chunks: KnowledgeChunk[],
    version: KnowledgeDocumentVersion,
  ): {
    profileFingerprint: string;
    indexFingerprint: string;
    manifest: KnowledgeChunkEmbeddingManifestItem[];
  } {
    if (!Number.isInteger(identity.dimensions) || identity.dimensions <= 0)
      throw new Error(
        'Embedding provider dimensions must be a positive integer.',
      );
    const profileFingerprint = computeEmbeddingProfileFingerprint(
      identity,
      this.config.profile,
    );
    const manifest = chunks.map((chunk) => ({
      knowledgeChunkId: chunk.id,
      inputFingerprint: computeChunkInputFingerprint({
        e1IndexInputFingerprint: version.indexInputFingerprint,
        textHash: chunk.textHash,
      }),
      embeddingProfileFingerprint: profileFingerprint,
      dimensions: identity.dimensions,
      ordinal: chunk.ordinal,
    }));
    return {
      profileFingerprint,
      indexFingerprint: computeIndexFingerprint({
        e1IndexInputFingerprint: version.indexInputFingerprint,
        profileFingerprint,
        orderedChunkInputFingerprints: manifest.map(
          (item) => item.inputFingerprint,
        ),
      }),
      manifest,
    };
  }

  private async runIndex(input: {
    index: KnowledgeEmbeddingIndex;
    userId: string;
    version: KnowledgeDocumentVersion;
    chunks: KnowledgeChunk[];
    identity: EmbeddingModelIdentity;
    replacement: boolean;
  }): Promise<KnowledgeIndexingResult> {
    const chunksById = new Map(input.chunks.map((chunk) => [chunk.id, chunk]));
    while (true) {
      const batch = await this.repository.claimNextBatch(
        input.userId,
        input.index.id,
        this.config.execution.batchSize,
        this.config.execution.leaseDurationMs,
      );
      if (!batch) break;
      const successes = await this.embedBatch(
        input.userId,
        input.index.id,
        batch,
        chunksById,
        input.identity,
      );
      if (!successes) {
        const result = await this.repository.finalizeIndex(
          input.userId,
          input.index.id,
        );
        return result;
      }
      await this.repository.recordBatchIndexed(
        input.userId,
        input.index.id,
        batch.leaseOwner,
        successes,
      );
    }
    const result = await this.repository.finalizeIndex(
      input.userId,
      input.index.id,
    );
    if (result.status === 'indexed' && input.replacement) {
      await this.repository.markSameVersionReplacementStale(
        input.userId,
        input.version.id,
        result.id,
      );
    }
    return result;
  }

  private async embedBatch(
    userId: string,
    indexId: string,
    batch: ClaimedEmbeddingBatch,
    chunksById: Map<string, KnowledgeChunk>,
    identity: EmbeddingModelIdentity,
  ): Promise<EmbeddingSuccessItem[] | null> {
    const items = batch.items.map((item) => {
      const chunk = chunksById.get(item.knowledgeChunkId);
      if (!chunk) {
        throw new Error(
          'Embedding batch references an unknown E1 knowledge chunk.',
        );
      }
      return { inputFingerprint: item.inputFingerprint, text: chunk.text };
    });
    let lastError:
      | { code: string; message: string; retryable: boolean }
      | undefined;
    for (
      let attempt = 1;
      attempt <= this.config.execution.maxAttempts;
      attempt += 1
    ) {
      try {
        const result = await this.provider.embed({ items });
        if (!sameIdentity(result.identity, identity))
          throw new EmbeddingProviderError(
            'permanent',
            'Embedding provider identity changed during indexing.',
          );
        if (
          result.items.length !== batch.items.length ||
          result.items.some(
            (item, index) =>
              item.inputFingerprint !== batch.items[index].inputFingerprint ||
              item.vector.length !== identity.dimensions ||
              item.vector.some((value) => !Number.isFinite(value)),
          )
        ) {
          throw new EmbeddingProviderError(
            'permanent',
            'Embedding provider returned an invalid batch.',
          );
        }
        return result.items.map((item, index) => ({
          knowledgeChunkId: batch.items[index].knowledgeChunkId,
          inputFingerprint: item.inputFingerprint,
          vector: item.vector,
        }));
      } catch (error) {
        lastError = errorDetails(error);
        if (
          !lastError.retryable ||
          attempt === this.config.execution.maxAttempts
        )
          break;
        const delay = Math.min(
          this.config.execution.backoffMaxMs,
          this.config.execution.backoffBaseMs * 2 ** (attempt - 1),
        );
        if (delay > 0) await this.sleep(delay);
      }
    }
    await this.repository.recordBatchFailed(
      userId,
      indexId,
      batch.leaseOwner,
      batch.items.map((item) => item.knowledgeChunkId),
      lastError?.code ?? 'permanent',
      lastError?.message ?? 'Embedding provider failed.',
    );
    return null;
  }
}
