import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  DRIZZLE_DATABASE,
  type AppDatabase,
} from '../../../database/database.types';
import {
  knowledgeChunkEmbeddings,
  knowledgeChunks,
  knowledgeDocumentVersions,
  knowledgeDocuments,
  knowledgeEmbeddingIndexes,
  knowledgeSourceRecords,
} from '../../../database/schema';
import type {
  EmbeddingModelIdentity,
} from '../indexing/embedding.types';
import type {
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeDocumentVersion,
} from '../knowledge.types';
import { distanceOperator } from './retrieval.profile';
import type {
  RetrievalDistanceMetric,
  RetrievalFilters,
} from './retrieval.types';
import type { RetrievalVersionCandidate } from './version-selection';

export interface RetrievedChunkRow {
  chunk: KnowledgeChunk;
  document: KnowledgeDocument;
  version: KnowledgeDocumentVersion;
  indexId: string;
  indexFingerprint: string;
  embeddingProfileFingerprint: string;
  embeddingModelIdentity: EmbeddingModelIdentity;
  rawDistance: number;
}

export interface RetrievalSearchResult {
  items: RetrievedChunkRow[];
  profileUnavailableVersionIds: string[];
  unavailableVersionIds: string[];
}

export interface KnowledgeRetrievalRepositoryPort {
  resolveActiveCandidates(input: {
    userId: string;
    filters?: RetrievalFilters;
  }): Promise<RetrievalVersionCandidate[]>;
  resolveExplicitCandidates(input: {
    userId: string;
    documentVersionIds: string[];
    filters?: RetrievalFilters;
  }): Promise<RetrievalVersionCandidate[]>;
  searchIndexedChunks(input: {
    userId: string;
    versionIds: string[];
    vector: number[];
    identity: EmbeddingModelIdentity;
    embeddingProfileFingerprint: string;
    distanceMetric: RetrievalDistanceMetric;
    candidateLimit: number;
  }): Promise<RetrievalSearchResult>;
}

type Database = AppDatabase;

function toDocument(row: typeof knowledgeDocuments.$inferSelect): KnowledgeDocument {
  return {
    id: row.id,
    userId: row.userId,
    ...(row.sourceRecordId === null ? {} : { sourceRecordId: row.sourceRecordId }),
    originKind: row.originKind as KnowledgeDocument['originKind'],
    displayName: row.displayName,
    sourceType: row.sourceType as KnowledgeDocument['sourceType'],
    ...(row.activeVersionId === null ? {} : { activeVersionId: row.activeVersionId }),
    lifecycleStatus: row.lifecycleStatus as KnowledgeDocument['lifecycleStatus'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toVersion(row: typeof knowledgeDocumentVersions.$inferSelect): KnowledgeDocumentVersion {
  return {
    id: row.id,
    userId: row.userId,
    documentId: row.documentId,
    versionNumber: row.versionNumber,
    originalContentHash: row.originalContentHash,
    ...(row.normalizedContentHash === null ? {} : { normalizedContentHash: row.normalizedContentHash }),
    ...(row.normalizationProfile === null ? {} : { normalizationProfile: row.normalizationProfile as KnowledgeDocumentVersion['normalizationProfile'] }),
    parserProfile: row.parserProfile as KnowledgeDocumentVersion['parserProfile'],
    chunkingProfile: row.chunkingProfile as KnowledgeDocumentVersion['chunkingProfile'],
    ...(row.sourceText === null ? {} : { sourceText: row.sourceText }),
    ...(row.sourceArtifactRef === null ? {} : { sourceArtifactRef: row.sourceArtifactRef as KnowledgeDocumentVersion['sourceArtifactRef'] }),
    ...(row.supersedesVersionId === null ? {} : { supersedesVersionId: row.supersedesVersionId }),
    lifecycleStatus: row.lifecycleStatus as KnowledgeDocumentVersion['lifecycleStatus'],
    readinessStatus: row.readinessStatus as KnowledgeDocumentVersion['readinessStatus'],
    indexInputFingerprint: row.indexInputFingerprint,
    createdAt: row.createdAt.toISOString(),
  };
}

function toChunk(row: typeof knowledgeChunks.$inferSelect): KnowledgeChunk {
  return {
    id: row.id,
    userId: row.userId,
    documentVersionId: row.documentVersionId,
    ordinal: row.ordinal,
    text: row.text,
    textHash: row.textHash,
    provenance: row.provenance as KnowledgeChunk['provenance'],
    citationLocator: row.citationLocator as KnowledgeChunk['citationLocator'],
  };
}

function filterConditions(filters: RetrievalFilters | undefined) {
  if (!filters) return [];
  return [
    ...(filters.documentIds?.length
      ? [inArray(knowledgeDocuments.id, filters.documentIds)]
      : []),
    ...(filters.sourceRecordIds?.length
      ? [inArray(knowledgeDocuments.sourceRecordId, filters.sourceRecordIds)]
      : []),
    ...(filters.sourceKinds?.length
      ? [inArray(knowledgeSourceRecords.kind, filters.sourceKinds)]
      : []),
    ...(filters.originKinds?.length
      ? [inArray(knowledgeDocuments.originKind, filters.originKinds)]
      : []),
    ...(filters.sourceTypes?.length
      ? [inArray(knowledgeDocuments.sourceType, filters.sourceTypes)]
      : []),
  ];
}

function identityConditions(identity: EmbeddingModelIdentity) {
  return [
    sql`${knowledgeEmbeddingIndexes.embeddingModelIdentity}->>'provider' = ${identity.provider}`,
    sql`${knowledgeEmbeddingIndexes.embeddingModelIdentity}->>'model' = ${identity.model}`,
    identity.modelRevision === undefined
      ? isNull(sql`${knowledgeEmbeddingIndexes.embeddingModelIdentity}->>'modelRevision'`)
      : sql`${knowledgeEmbeddingIndexes.embeddingModelIdentity}->>'modelRevision' = ${identity.modelRevision}`,
    sql`${knowledgeEmbeddingIndexes.embeddingModelIdentity}->>'dimensions' = ${String(identity.dimensions)}`,
    eq(knowledgeChunkEmbeddings.dimensions, identity.dimensions),
  ];
}

export function buildRetrievalOperator(metric: RetrievalDistanceMetric): '<=>' | '<#>' | '<->' {
  return distanceOperator(metric);
}

@Injectable()
export class KnowledgeRetrievalRepository implements KnowledgeRetrievalRepositoryPort {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  async resolveActiveCandidates(input: {
    userId: string;
    filters?: RetrievalFilters;
  }): Promise<RetrievalVersionCandidate[]> {
    const rows = await this.db
      .select({ document: knowledgeDocuments, version: knowledgeDocumentVersions })
      .from(knowledgeDocuments)
      .innerJoin(
        knowledgeDocumentVersions,
        and(
          eq(knowledgeDocumentVersions.id, knowledgeDocuments.activeVersionId),
          eq(knowledgeDocumentVersions.userId, knowledgeDocuments.userId),
        ),
      )
      .leftJoin(
        knowledgeSourceRecords,
        and(
          eq(knowledgeSourceRecords.id, knowledgeDocuments.sourceRecordId),
          eq(knowledgeSourceRecords.userId, knowledgeDocuments.userId),
        ),
      )
      .where(
        and(
          eq(knowledgeDocuments.userId, input.userId),
          eq(knowledgeDocuments.lifecycleStatus, 'active'),
          eq(knowledgeDocumentVersions.lifecycleStatus, 'active'),
          eq(knowledgeDocumentVersions.readinessStatus, 'content-ready-for-indexing'),
          ...filterConditions(input.filters),
        ),
      );
    return rows.map((row) => ({ document: toDocument(row.document), version: toVersion(row.version) }));
  }

  async resolveExplicitCandidates(input: {
    userId: string;
    documentVersionIds: string[];
    filters?: RetrievalFilters;
  }): Promise<RetrievalVersionCandidate[]> {
    if (input.documentVersionIds.length === 0) return [];
    const rows = await this.db
      .select({ document: knowledgeDocuments, version: knowledgeDocumentVersions })
      .from(knowledgeDocumentVersions)
      .innerJoin(
        knowledgeDocuments,
        and(
          eq(knowledgeDocuments.id, knowledgeDocumentVersions.documentId),
          eq(knowledgeDocuments.userId, knowledgeDocumentVersions.userId),
        ),
      )
      .leftJoin(
        knowledgeSourceRecords,
        and(
          eq(knowledgeSourceRecords.id, knowledgeDocuments.sourceRecordId),
          eq(knowledgeSourceRecords.userId, knowledgeDocuments.userId),
        ),
      )
      .where(
        and(
          eq(knowledgeDocumentVersions.userId, input.userId),
          inArray(knowledgeDocumentVersions.id, input.documentVersionIds),
          eq(knowledgeDocuments.lifecycleStatus, 'active'),
          eq(knowledgeDocumentVersions.lifecycleStatus, 'active'),
          eq(knowledgeDocumentVersions.readinessStatus, 'content-ready-for-indexing'),
          ...filterConditions(input.filters),
        ),
      );
    return rows.map((row) => ({ document: toDocument(row.document), version: toVersion(row.version) }));
  }

  async searchIndexedChunks(input: {
    userId: string;
    versionIds: string[];
    vector: number[];
    identity: EmbeddingModelIdentity;
    embeddingProfileFingerprint: string;
    distanceMetric: RetrievalDistanceMetric;
    candidateLimit: number;
  }): Promise<RetrievalSearchResult> {
    if (input.versionIds.length === 0) {
      return {
        items: [],
        profileUnavailableVersionIds: [],
        unavailableVersionIds: [],
      };
    }
    const vectorLiteral = `[${input.vector.join(',')}]`;
    const operator = buildRetrievalOperator(input.distanceMetric);
    const distance =
      operator === '<=>'
        ? sql`${knowledgeChunkEmbeddings.embedding} <=> ${vectorLiteral}::vector`
        : operator === '<#>'
          ? sql`${knowledgeChunkEmbeddings.embedding} <#> ${vectorLiteral}::vector`
          : sql`${knowledgeChunkEmbeddings.embedding} <-> ${vectorLiteral}::vector`;
    const compatible = and(
      eq(knowledgeEmbeddingIndexes.userId, input.userId),
      inArray(knowledgeEmbeddingIndexes.documentVersionId, input.versionIds),
      eq(knowledgeEmbeddingIndexes.status, 'indexed'),
      eq(knowledgeChunkEmbeddings.userId, input.userId),
      eq(knowledgeChunkEmbeddings.status, 'indexed'),
      eq(knowledgeChunkEmbeddings.embeddingProfileFingerprint, input.embeddingProfileFingerprint),
      eq(knowledgeEmbeddingIndexes.embeddingProfileFingerprint, input.embeddingProfileFingerprint),
      sql`${knowledgeChunkEmbeddings.embedding} IS NOT NULL`,
      ...identityConditions(input.identity),
    );
    const rows = await this.db
      .select({
        chunk: knowledgeChunks,
        document: knowledgeDocuments,
        version: knowledgeDocumentVersions,
        indexId: knowledgeEmbeddingIndexes.id,
        indexFingerprint: knowledgeEmbeddingIndexes.indexFingerprint,
        embeddingProfileFingerprint: knowledgeEmbeddingIndexes.embeddingProfileFingerprint,
        embeddingModelIdentity: knowledgeEmbeddingIndexes.embeddingModelIdentity,
        rawDistance: distance,
      })
      .from(knowledgeChunkEmbeddings)
      .innerJoin(
        knowledgeEmbeddingIndexes,
        and(
          eq(knowledgeEmbeddingIndexes.id, knowledgeChunkEmbeddings.knowledgeEmbeddingIndexId),
          eq(knowledgeEmbeddingIndexes.userId, knowledgeChunkEmbeddings.userId),
        ),
      )
      .innerJoin(
        knowledgeChunks,
        and(
          eq(knowledgeChunks.id, knowledgeChunkEmbeddings.knowledgeChunkId),
          eq(knowledgeChunks.userId, knowledgeChunkEmbeddings.userId),
        ),
      )
      .innerJoin(
        knowledgeDocumentVersions,
        and(
          eq(knowledgeDocumentVersions.id, knowledgeEmbeddingIndexes.documentVersionId),
          eq(knowledgeDocumentVersions.userId, knowledgeEmbeddingIndexes.userId),
          eq(knowledgeDocumentVersions.lifecycleStatus, 'active'),
          eq(knowledgeDocumentVersions.readinessStatus, 'content-ready-for-indexing'),
        ),
      )
      .innerJoin(
        knowledgeDocuments,
        and(
          eq(knowledgeDocuments.id, knowledgeDocumentVersions.documentId),
          eq(knowledgeDocuments.userId, knowledgeDocumentVersions.userId),
          eq(knowledgeDocuments.lifecycleStatus, 'active'),
        ),
      )
      .where(compatible)
      .orderBy(
        asc(distance),
        asc(knowledgeDocumentVersions.id),
        asc(knowledgeChunks.ordinal),
        asc(knowledgeChunks.id),
      )
      .limit(input.candidateLimit);

    const profileRows = await this.db
      .select({
        versionId: knowledgeEmbeddingIndexes.documentVersionId,
        profileFingerprint: knowledgeEmbeddingIndexes.embeddingProfileFingerprint,
        identity: knowledgeEmbeddingIndexes.embeddingModelIdentity,
        dimensions: knowledgeChunkEmbeddings.dimensions,
      })
      .from(knowledgeEmbeddingIndexes)
      .innerJoin(
        knowledgeChunkEmbeddings,
        and(
          eq(knowledgeChunkEmbeddings.knowledgeEmbeddingIndexId, knowledgeEmbeddingIndexes.id),
          eq(knowledgeChunkEmbeddings.userId, knowledgeEmbeddingIndexes.userId),
          eq(knowledgeChunkEmbeddings.status, 'indexed'),
        ),
      )
      .where(
        and(
          eq(knowledgeEmbeddingIndexes.userId, input.userId),
          inArray(knowledgeEmbeddingIndexes.documentVersionId, input.versionIds),
          eq(knowledgeEmbeddingIndexes.status, 'indexed'),
        ),
      );
    const compatibleVersionIds = new Set(
      profileRows
        .filter(
          (row) =>
            row.profileFingerprint === input.embeddingProfileFingerprint &&
            row.dimensions === input.identity.dimensions &&
            samePersistedIdentity(row.identity, input.identity),
        )
        .map((row) => row.versionId),
    );
    const profileUnavailableVersionIds = [...new Set(
      profileRows
        .filter(
          (row) =>
            row.profileFingerprint !== input.embeddingProfileFingerprint ||
            row.dimensions !== input.identity.dimensions ||
            !samePersistedIdentity(row.identity, input.identity),
        )
        .map((row) => row.versionId),
    )].filter((versionId) => !compatibleVersionIds.has(versionId));
    const unavailableVersionIds = input.versionIds.filter(
      (versionId) =>
        !compatibleVersionIds.has(versionId) &&
        !profileUnavailableVersionIds.includes(versionId),
    );

    return {
      items: rows.map((row) => ({
        chunk: toChunk(row.chunk),
        document: toDocument(row.document),
        version: toVersion(row.version),
        indexId: row.indexId,
        indexFingerprint: row.indexFingerprint,
        embeddingProfileFingerprint: row.embeddingProfileFingerprint,
        embeddingModelIdentity: row.embeddingModelIdentity as EmbeddingModelIdentity,
        rawDistance: Number(row.rawDistance),
      })),
      profileUnavailableVersionIds,
      unavailableVersionIds,
    };
  }
}

function samePersistedIdentity(
  value: unknown,
  expected: EmbeddingModelIdentity,
): boolean {
  if (!value || typeof value !== 'object') return false;
  const identity = value as Partial<EmbeddingModelIdentity>;
  return (
    identity.provider === expected.provider &&
    identity.model === expected.model &&
    identity.modelRevision === expected.modelRevision &&
    identity.dimensions === expected.dimensions
  );
}
