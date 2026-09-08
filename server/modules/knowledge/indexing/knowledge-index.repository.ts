import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import {
  DRIZZLE_DATABASE,
  type AppDatabase,
} from '../../../database/database.types';
import {
  knowledgeChunkEmbeddings,
  knowledgeChunks,
  knowledgeEmbeddingIndexes,
} from '../../../database/schema';
import type { EmbeddingModelIdentity } from './embedding.types';
import type {
  ClaimedEmbeddingBatch,
  EmbeddingSuccessItem,
  KnowledgeChunkEmbeddingManifestItem,
  KnowledgeEmbeddingIndex,
} from './knowledge-indexing.types';
import { transitionIndexStatus } from './knowledge-indexing.lifecycle';

export interface CreateEmbeddingIndexInput {
  userId: string;
  documentVersionId: string;
  e1IndexInputFingerprint: string;
  embeddingProfileFingerprint: string;
  indexFingerprint: string;
  embeddingModelIdentity: EmbeddingModelIdentity;
  totalChunks: number;
}

export interface KnowledgeIndexRepositoryPort {
  createOrGetIndex(input: CreateEmbeddingIndexInput): Promise<{
    index: KnowledgeEmbeddingIndex;
    created: boolean;
  }>;
  createChunkManifest(
    indexId: string,
    userId: string,
    items: KnowledgeChunkEmbeddingManifestItem[],
  ): Promise<void>;
  getIndex(
    userId: string,
    indexId: string,
  ): Promise<KnowledgeEmbeddingIndex | null>;
  getLatestIndexForVersion(
    userId: string,
    documentVersionId: string,
  ): Promise<KnowledgeEmbeddingIndex | null>;
  claimNextBatch(
    userId: string,
    indexId: string,
    batchSize: number,
    leaseDurationMs: number,
  ): Promise<ClaimedEmbeddingBatch | null>;
  recordBatchIndexed(
    userId: string,
    indexId: string,
    leaseOwner: string,
    items: EmbeddingSuccessItem[],
  ): Promise<void>;
  recordBatchFailed(
    userId: string,
    indexId: string,
    leaseOwner: string,
    chunkIds: string[],
    code: string,
    message: string,
  ): Promise<void>;
  finalizeIndex(
    userId: string,
    indexId: string,
  ): Promise<KnowledgeEmbeddingIndex>;
  reopenFailedIndex(
    userId: string,
    indexId: string,
  ): Promise<KnowledgeEmbeddingIndex>;
  reopenStaleIndex(
    userId: string,
    indexId: string,
  ): Promise<KnowledgeEmbeddingIndex>;
}

type EmbeddingIndexRow = typeof knowledgeEmbeddingIndexes.$inferSelect;
type EmbeddingDatabase = AppDatabase;

function toIndex(row: EmbeddingIndexRow): KnowledgeEmbeddingIndex {
  return {
    id: row.id,
    userId: row.userId,
    documentVersionId: row.documentVersionId,
    e1IndexInputFingerprint: row.e1IndexInputFingerprint,
    embeddingProfileFingerprint: row.embeddingProfileFingerprint,
    indexFingerprint: row.indexFingerprint,
    embeddingModelIdentity:
      row.embeddingModelIdentity as EmbeddingModelIdentity,
    status: row.status as KnowledgeEmbeddingIndex['status'],
    totalChunks: row.totalChunks,
    indexedChunks: row.indexedChunks,
    failedChunks: row.failedChunks,
    attemptCount: row.attemptCount,
    ...(row.lastErrorCode === null ? {} : { lastErrorCode: row.lastErrorCode }),
    ...(row.lastErrorMessage === null
      ? {}
      : { lastErrorMessage: row.lastErrorMessage }),
    ...(row.leaseOwner === null ? {} : { leaseOwner: row.leaseOwner }),
    ...(row.leaseExpiresAt === null
      ? {}
      : { leaseExpiresAt: row.leaseExpiresAt.toISOString() }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.indexedAt === null
      ? {}
      : { indexedAt: row.indexedAt.toISOString() }),
  };
}

@Injectable()
export class KnowledgeIndexRepository implements KnowledgeIndexRepositoryPort {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: EmbeddingDatabase,
  ) {}

  async createOrGetIndex(input: CreateEmbeddingIndexInput): Promise<{
    index: KnowledgeEmbeddingIndex;
    created: boolean;
  }> {
    const inserted = await this.db
      .insert(knowledgeEmbeddingIndexes)
      .values({
        userId: input.userId,
        documentVersionId: input.documentVersionId,
        e1IndexInputFingerprint: input.e1IndexInputFingerprint,
        embeddingProfileFingerprint: input.embeddingProfileFingerprint,
        indexFingerprint: input.indexFingerprint,
        embeddingModelIdentity: input.embeddingModelIdentity,
        status: 'indexing',
        totalChunks: input.totalChunks,
      })
      .onConflictDoNothing({
        target: [
          knowledgeEmbeddingIndexes.userId,
          knowledgeEmbeddingIndexes.documentVersionId,
          knowledgeEmbeddingIndexes.e1IndexInputFingerprint,
          knowledgeEmbeddingIndexes.embeddingProfileFingerprint,
        ],
      })
      .returning();
    const row =
      inserted[0] ??
      (
        await this.db
          .select()
          .from(knowledgeEmbeddingIndexes)
          .where(
            and(
              eq(knowledgeEmbeddingIndexes.userId, input.userId),
              eq(
                knowledgeEmbeddingIndexes.documentVersionId,
                input.documentVersionId,
              ),
              eq(
                knowledgeEmbeddingIndexes.e1IndexInputFingerprint,
                input.e1IndexInputFingerprint,
              ),
              eq(
                knowledgeEmbeddingIndexes.embeddingProfileFingerprint,
                input.embeddingProfileFingerprint,
              ),
            ),
          )
          .limit(1)
      )[0];
    if (!row)
      throw new Error('Embedding index could not be created or loaded.');

    return { index: toIndex(row), created: inserted.length > 0 };
  }

  async createChunkManifest(
    indexId: string,
    userId: string,
    items: KnowledgeChunkEmbeddingManifestItem[],
  ): Promise<void> {
    if (items.length === 0) return;
    await this.db
      .insert(knowledgeChunkEmbeddings)
      .values(
        items.map((item) => ({
          userId,
          knowledgeEmbeddingIndexId: indexId,
          knowledgeChunkId: item.knowledgeChunkId,
          inputFingerprint: item.inputFingerprint,
          embeddingProfileFingerprint: item.embeddingProfileFingerprint,
          dimensions: item.dimensions,
          status: 'indexing' as const,
        })),
      )
      .onConflictDoNothing();
  }

  async getIndex(
    userId: string,
    indexId: string,
  ): Promise<KnowledgeEmbeddingIndex | null> {
    const rows = await this.db
      .select()
      .from(knowledgeEmbeddingIndexes)
      .where(
        and(
          eq(knowledgeEmbeddingIndexes.id, indexId),
          eq(knowledgeEmbeddingIndexes.userId, userId),
        ),
      )
      .limit(1);
    return rows[0] ? toIndex(rows[0]) : null;
  }

  async getLatestIndexForVersion(
    userId: string,
    documentVersionId: string,
  ): Promise<KnowledgeEmbeddingIndex | null> {
    const rows = await this.db
      .select()
      .from(knowledgeEmbeddingIndexes)
      .where(
        and(
          eq(knowledgeEmbeddingIndexes.userId, userId),
          eq(knowledgeEmbeddingIndexes.documentVersionId, documentVersionId),
        ),
      )
      .orderBy(desc(knowledgeEmbeddingIndexes.updatedAt))
      .limit(1);
    return rows[0] ? toIndex(rows[0]) : null;
  }

  async claimNextBatch(
    userId: string,
    indexId: string,
    batchSize: number,
    leaseDurationMs: number,
  ): Promise<ClaimedEmbeddingBatch | null> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const leaseOwner = `embedding-worker-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
      const leased = await tx
        .update(knowledgeEmbeddingIndexes)
        .set({
          leaseOwner,
          leaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
          attemptCount: sql`${knowledgeEmbeddingIndexes.attemptCount} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(knowledgeEmbeddingIndexes.id, indexId),
            eq(knowledgeEmbeddingIndexes.userId, userId),
            eq(knowledgeEmbeddingIndexes.status, 'indexing'),
            or(
              isNull(knowledgeEmbeddingIndexes.leaseExpiresAt),
              lt(knowledgeEmbeddingIndexes.leaseExpiresAt, now),
            ),
          ),
        )
        .returning({ id: knowledgeEmbeddingIndexes.id });
      if (leased.length === 0) return null;

      const rows = await tx
        .select({
          embedding: knowledgeChunkEmbeddings,
          ordinal: knowledgeChunks.ordinal,
        })
        .from(knowledgeChunkEmbeddings)
        .innerJoin(
          knowledgeChunks,
          and(
            eq(knowledgeChunks.id, knowledgeChunkEmbeddings.knowledgeChunkId),
            eq(knowledgeChunks.userId, knowledgeChunkEmbeddings.userId),
          ),
        )
        .where(
          and(
            eq(knowledgeChunkEmbeddings.userId, userId),
            eq(knowledgeChunkEmbeddings.knowledgeEmbeddingIndexId, indexId),
            eq(knowledgeChunkEmbeddings.status, 'indexing'),
          ),
        )
        .orderBy(asc(knowledgeChunks.ordinal))
        .limit(batchSize)
        .for('update');
      if (rows.length === 0) {
        await tx
          .update(knowledgeEmbeddingIndexes)
          .set({ leaseOwner: null, leaseExpiresAt: null, updatedAt: now })
          .where(
            and(
              eq(knowledgeEmbeddingIndexes.id, indexId),
              eq(knowledgeEmbeddingIndexes.userId, userId),
              eq(knowledgeEmbeddingIndexes.leaseOwner, leaseOwner),
            ),
          );
        return null;
      }
      await tx
        .update(knowledgeChunkEmbeddings)
        .set({
          attemptCount: sql`${knowledgeChunkEmbeddings.attemptCount} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(knowledgeChunkEmbeddings.userId, userId),
            eq(knowledgeChunkEmbeddings.knowledgeEmbeddingIndexId, indexId),
            eq(knowledgeChunkEmbeddings.status, 'indexing'),
            inArray(
              knowledgeChunkEmbeddings.id,
              rows.map((row) => row.embedding.id),
            ),
          ),
        );
      return {
        leaseOwner,
        items: rows.map((row) => ({
          knowledgeChunkId: row.embedding.knowledgeChunkId,
          inputFingerprint: row.embedding.inputFingerprint,
          embeddingProfileFingerprint:
            row.embedding.embeddingProfileFingerprint,
          dimensions: row.embedding.dimensions,
          ordinal: row.ordinal,
        })),
      };
    });
  }

  async recordBatchIndexed(
    userId: string,
    indexId: string,
    leaseOwner: string,
    items: EmbeddingSuccessItem[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const now = new Date();
      const index = await tx
        .select({
          leaseOwner: knowledgeEmbeddingIndexes.leaseOwner,
          status: knowledgeEmbeddingIndexes.status,
        })
        .from(knowledgeEmbeddingIndexes)
        .where(
          and(
            eq(knowledgeEmbeddingIndexes.id, indexId),
            eq(knowledgeEmbeddingIndexes.userId, userId),
          ),
        )
        .limit(1);
      if (index.length === 0)
        throw new Error('Embedding index lease is no longer valid.');
      if (index[0].status === 'stale') return;
      if (index[0].leaseOwner !== leaseOwner)
        throw new Error('Embedding index lease is no longer valid.');
      for (const item of items) {
        const updated = await tx
          .update(knowledgeChunkEmbeddings)
          .set({
            embedding: item.vector,
            status: 'indexed',
            indexedAt: now,
            lastErrorCode: null,
            lastErrorMessage: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(knowledgeChunkEmbeddings.userId, userId),
              eq(knowledgeChunkEmbeddings.knowledgeEmbeddingIndexId, indexId),
              eq(
                knowledgeChunkEmbeddings.knowledgeChunkId,
                item.knowledgeChunkId,
              ),
              eq(
                knowledgeChunkEmbeddings.inputFingerprint,
                item.inputFingerprint,
              ),
              eq(knowledgeChunkEmbeddings.status, 'indexing'),
            ),
          )
          .returning({ id: knowledgeChunkEmbeddings.id });
        if (updated.length !== 1)
          throw new Error(
            'Embedding batch item no longer matches its manifest.',
          );
      }
      await tx
        .update(knowledgeEmbeddingIndexes)
        .set({ leaseOwner: null, leaseExpiresAt: null, updatedAt: now })
        .where(
          and(
            eq(knowledgeEmbeddingIndexes.id, indexId),
            eq(knowledgeEmbeddingIndexes.userId, userId),
            eq(knowledgeEmbeddingIndexes.leaseOwner, leaseOwner),
          ),
        );
    });
  }

  async recordBatchFailed(
    userId: string,
    indexId: string,
    leaseOwner: string,
    chunkIds: string[],
    code: string,
    message: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const now = new Date();
      const index = await tx
        .select({
          leaseOwner: knowledgeEmbeddingIndexes.leaseOwner,
          status: knowledgeEmbeddingIndexes.status,
        })
        .from(knowledgeEmbeddingIndexes)
        .where(
          and(
            eq(knowledgeEmbeddingIndexes.id, indexId),
            eq(knowledgeEmbeddingIndexes.userId, userId),
          ),
        )
        .limit(1);
      if (index.length === 0)
        throw new Error('Embedding index lease is no longer valid.');
      if (index[0].status === 'stale') return;
      if (index[0].leaseOwner !== leaseOwner)
        throw new Error('Embedding index lease is no longer valid.');
      for (const chunkId of chunkIds) {
        await tx
          .update(knowledgeChunkEmbeddings)
          .set({
            status: 'failed',
            lastErrorCode: code.slice(0, 64),
            lastErrorMessage: message.slice(0, 512),
            updatedAt: now,
          })
          .where(
            and(
              eq(knowledgeChunkEmbeddings.userId, userId),
              eq(knowledgeChunkEmbeddings.knowledgeEmbeddingIndexId, indexId),
              eq(knowledgeChunkEmbeddings.knowledgeChunkId, chunkId),
              eq(knowledgeChunkEmbeddings.status, 'indexing'),
            ),
          );
      }
      await tx
        .update(knowledgeEmbeddingIndexes)
        .set({
          leaseOwner: null,
          leaseExpiresAt: null,
          lastErrorCode: code.slice(0, 64),
          lastErrorMessage: message.slice(0, 512),
          updatedAt: now,
        })
        .where(
          and(
            eq(knowledgeEmbeddingIndexes.id, indexId),
            eq(knowledgeEmbeddingIndexes.userId, userId),
            eq(knowledgeEmbeddingIndexes.leaseOwner, leaseOwner),
          ),
        );
    });
  }

  async finalizeIndex(
    userId: string,
    indexId: string,
  ): Promise<KnowledgeEmbeddingIndex> {
    return this.db.transaction(async (tx) => {
      const targetRows = await tx
        .select({
          documentVersionId: knowledgeEmbeddingIndexes.documentVersionId,
        })
        .from(knowledgeEmbeddingIndexes)
        .where(
          and(
            eq(knowledgeEmbeddingIndexes.id, indexId),
            eq(knowledgeEmbeddingIndexes.userId, userId),
          ),
        )
        .limit(1);
      if (targetRows.length === 0)
        throw new Error('Embedding index not found.');
      const indexRows = await tx
        .select()
        .from(knowledgeEmbeddingIndexes)
        .where(
          and(
            eq(knowledgeEmbeddingIndexes.userId, userId),
            eq(
              knowledgeEmbeddingIndexes.documentVersionId,
              targetRows[0].documentVersionId,
            ),
          ),
        )
        .orderBy(asc(knowledgeEmbeddingIndexes.id))
        .for('update');
      const index = indexRows.find((row) => row.id === indexId);
      if (!index) throw new Error('Embedding index not found.');
      if (index.status === 'stale') return toIndex(index);
      if (index.status !== 'indexing') return toIndex(index);
      const rows = await tx
        .select({ status: knowledgeChunkEmbeddings.status })
        .from(knowledgeChunkEmbeddings)
        .where(
          and(
            eq(knowledgeChunkEmbeddings.userId, userId),
            eq(knowledgeChunkEmbeddings.knowledgeEmbeddingIndexId, index.id),
          ),
        );
      const indexedChunks = rows.filter(
        (row) => row.status === 'indexed',
      ).length;
      const failedChunks = rows.filter((row) => row.status === 'failed').length;
      const status =
        failedChunks > 0
          ? 'failed'
          : indexedChunks === index.totalChunks
            ? 'indexed'
            : 'indexing';
      if (status === 'indexing') return toIndex(index);
      const now = new Date();
      const updated = await tx
        .update(knowledgeEmbeddingIndexes)
        .set({
          status: transitionIndexStatus(
            index.status as KnowledgeEmbeddingIndex['status'],
            status as KnowledgeEmbeddingIndex['status'],
          ),
          indexedChunks,
          failedChunks,
          leaseOwner: null,
          leaseExpiresAt: null,
          indexedAt: status === 'indexed' ? now : null,
          updatedAt: now,
        })
        .where(
          and(
            eq(knowledgeEmbeddingIndexes.id, index.id),
            eq(knowledgeEmbeddingIndexes.userId, userId),
          ),
        )
        .returning();
      const finalized = updated[0];
      if (status === 'indexed') {
        const replaced = indexRows.filter(
          (row) =>
            row.id !== index.id &&
            (row.status === 'indexed' || row.status === 'indexing'),
        );
        for (const oldIndex of replaced) {
          await tx
            .update(knowledgeEmbeddingIndexes)
            .set({
              status: transitionIndexStatus(
                oldIndex.status as KnowledgeEmbeddingIndex['status'],
                'stale',
              ),
              leaseOwner: null,
              leaseExpiresAt: null,
              indexedAt: null,
              updatedAt: now,
            })
            .where(
              and(
                eq(knowledgeEmbeddingIndexes.id, oldIndex.id),
                eq(knowledgeEmbeddingIndexes.userId, userId),
                eq(knowledgeEmbeddingIndexes.status, oldIndex.status),
              ),
            );
          await tx
            .update(knowledgeChunkEmbeddings)
            .set({ status: 'stale', updatedAt: now })
            .where(
              and(
                eq(knowledgeChunkEmbeddings.userId, userId),
                eq(
                  knowledgeChunkEmbeddings.knowledgeEmbeddingIndexId,
                  oldIndex.id,
                ),
                inArray(knowledgeChunkEmbeddings.status, [
                  'indexing',
                  'indexed',
                ]),
              ),
            );
        }
      }
      return toIndex(finalized);
    });
  }

  async reopenFailedIndex(
    userId: string,
    indexId: string,
  ): Promise<KnowledgeEmbeddingIndex> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const current = await tx
        .select()
        .from(knowledgeEmbeddingIndexes)
        .where(
          and(
            eq(knowledgeEmbeddingIndexes.id, indexId),
            eq(knowledgeEmbeddingIndexes.userId, userId),
          ),
        )
        .limit(1)
        .for('update');
      if (current.length !== 1 || current[0].status !== 'failed')
        throw new Error('Only failed embedding indexes can be reopened.');
      transitionIndexStatus(
        current[0].status as KnowledgeEmbeddingIndex['status'],
        'indexing',
      );
      const updated = await tx
        .update(knowledgeEmbeddingIndexes)
        .set({
          status: 'indexing',
          indexedChunks: 0,
          failedChunks: 0,
          lastErrorCode: null,
          lastErrorMessage: null,
          leaseOwner: null,
          leaseExpiresAt: null,
          indexedAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(knowledgeEmbeddingIndexes.id, indexId),
            eq(knowledgeEmbeddingIndexes.userId, userId),
            eq(knowledgeEmbeddingIndexes.status, 'failed'),
          ),
        )
        .returning();
      if (updated.length !== 1)
        throw new Error('Only failed embedding indexes can be reopened.');
      await tx
        .update(knowledgeChunkEmbeddings)
        .set({
          status: 'indexing',
          embedding: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          indexedAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(knowledgeChunkEmbeddings.userId, userId),
            eq(knowledgeChunkEmbeddings.knowledgeEmbeddingIndexId, indexId),
            eq(knowledgeChunkEmbeddings.status, 'failed'),
          ),
        );
      return toIndex(updated[0]);
    });
  }

  async reopenStaleIndex(
    userId: string,
    indexId: string,
  ): Promise<KnowledgeEmbeddingIndex> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const current = await tx
        .select()
        .from(knowledgeEmbeddingIndexes)
        .where(
          and(
            eq(knowledgeEmbeddingIndexes.id, indexId),
            eq(knowledgeEmbeddingIndexes.userId, userId),
          ),
        )
        .limit(1)
        .for('update');
      if (current.length !== 1 || current[0].status !== 'stale')
        throw new Error('Only stale embedding indexes can be reopened.');
      transitionIndexStatus(
        current[0].status as KnowledgeEmbeddingIndex['status'],
        'indexing',
      );
      const updated = await tx
        .update(knowledgeEmbeddingIndexes)
        .set({
          status: 'indexing',
          indexedChunks: 0,
          failedChunks: 0,
          lastErrorCode: null,
          lastErrorMessage: null,
          leaseOwner: null,
          leaseExpiresAt: null,
          indexedAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(knowledgeEmbeddingIndexes.id, indexId),
            eq(knowledgeEmbeddingIndexes.userId, userId),
            eq(knowledgeEmbeddingIndexes.status, 'stale'),
          ),
        )
        .returning();
      await tx
        .update(knowledgeChunkEmbeddings)
        .set({
          status: 'indexing',
          embedding: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          indexedAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(knowledgeChunkEmbeddings.userId, userId),
            eq(knowledgeChunkEmbeddings.knowledgeEmbeddingIndexId, indexId),
            inArray(knowledgeChunkEmbeddings.status, [
              'stale',
              'indexed',
              'failed',
            ]),
          ),
        );
      return toIndex(updated[0]);
    });
  }
}
