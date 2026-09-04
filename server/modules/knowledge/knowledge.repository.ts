import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type AppDatabase } from '../../database/database.types';
import {
  knowledgeChunks,
  knowledgeDocumentVersions,
  knowledgeDocuments,
  knowledgeImports,
  knowledgeMetadataAssertions,
  knowledgeSourceExternalLinks,
  knowledgeSourceRecords,
} from '../../database/schema';
import { createHash, randomUUID } from 'node:crypto';
import { KnowledgeError } from './knowledge.errors';
import type {
  CanonicalFieldInput,
  CanonicalSourceMetadata,
  CreateSourceRecordInput,
  ExternalProvenance,
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeDocumentVersion,
  MetadataAssertion,
  MetadataAssertionInput,
  MetadataField,
  SourceRecord,
} from './knowledge.types';

type SourceRow = typeof knowledgeSourceRecords.$inferSelect;
type AssertionRow = typeof knowledgeMetadataAssertions.$inferSelect;
type ExternalLinkRow = typeof knowledgeSourceExternalLinks.$inferSelect;
type DocumentRow = typeof knowledgeDocuments.$inferSelect;
type VersionRow = typeof knowledgeDocumentVersions.$inferSelect;
type ChunkRow = typeof knowledgeChunks.$inferSelect;
type KnowledgeTransaction = Parameters<Parameters<AppDatabase['transaction']>[0]>[0];
type KnowledgeDatabase = AppDatabase | KnowledgeTransaction;

export interface KnowledgeRepositoryPort {
  createSourceRecord(input: CreateSourceRecordInput): Promise<SourceRecord>;
  createExternalLinks(input: { userId: string; sourceRecordId: string; links: ExternalProvenance[] }): Promise<void>;
  getSourceRecord(userId: string, sourceRecordId: string): Promise<SourceRecord | null>;
  createDocument(input: { userId: string; sourceRecordId?: string; originKind: KnowledgeDocument['originKind']; displayName: string; sourceType: KnowledgeDocument['sourceType'] }): Promise<KnowledgeDocument>;
  createVersion(input: Omit<KnowledgeDocumentVersion, 'id' | 'createdAt'>): Promise<KnowledgeDocumentVersion>;
  createChunks(input: KnowledgeChunk[]): Promise<KnowledgeChunk[]>;
  findImport(userId: string, idempotencyKey: string): Promise<{ id: string; requestFingerprint: string; documentId?: string; documentVersionId?: string; status: string } | null>;
  createImportMarker(input: { userId: string; idempotencyKey: string; requestFingerprint: string }): Promise<string>;
  claimImportMarker?(input: { userId: string; idempotencyKey: string; requestFingerprint: string }): Promise<{ id: string; created: boolean }>;
  getDocument?(userId: string, documentId: string): Promise<KnowledgeDocument | null>;
  getVersion?(userId: string, versionId: string): Promise<KnowledgeDocumentVersion | null>;
  getChunks?(userId: string, versionId: string): Promise<KnowledgeChunk[]>;
  getLatestVersion?(userId: string, documentId: string): Promise<KnowledgeDocumentVersion | null>;
  completeImport(userId: string, importId: string, documentId: string, documentVersionId: string): Promise<void>;
  activateVersion(userId: string, documentId: string, versionId: string): Promise<void>;
  tombstoneDocument(userId: string, documentId: string): Promise<void>;
  withTransaction?<T>(work: (repository: KnowledgeRepositoryPort) => Promise<T>): Promise<T>;
}

function invalid(message: string): never {
  throw new KnowledgeError('INVALID_KNOWLEDGE_INPUT', message);
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function assertionHash(input: MetadataAssertionInput): string {
  return createHash('sha256').update(stableSerialize({
    field: input.field,
    value: input.value,
    providerKind: input.providerKind,
    provider: input.provider,
    externalRecordId: input.externalRecordId,
    observedAt: input.observedAt,
    verificationStatus: input.verificationStatus,
  })).digest('hex');
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string; detail?: string; constraint?: string; cause?: unknown };
  const evidence = [candidate.code, candidate.message, candidate.detail, candidate.constraint].filter(Boolean).join(' ');
  return candidate.code === '23505' || /unique|duplicate|23505|identity_key/i.test(evidence) || isUniqueViolation(candidate.cause);
}

function dateString(value: Date | null | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

function toExternalProvenance(row: ExternalLinkRow): ExternalProvenance {
  return {
    connectorKind: row.connectorKind,
    provider: row.provider,
    externalRecordId: row.externalRecordId,
    ...(row.externalVersion === null ? {} : { externalVersion: row.externalVersion }),
    ...(row.canonicalUrl === null ? {} : { canonicalUrl: row.canonicalUrl }),
    ...(row.retrievedAt === null ? {} : { retrievedAt: dateString(row.retrievedAt) }),
    ...(row.licenseOrAccessNote === null ? {} : { licenseOrAccessNote: row.licenseOrAccessNote }),
    verificationStatus: row.verificationStatus as ExternalProvenance['verificationStatus'],
  };
}

function toMetadataAssertion(row: AssertionRow): MetadataAssertion {
  return {
    id: row.id,
    sourceRecordId: row.sourceRecordId,
    field: row.field as MetadataField,
    value: row.value as MetadataAssertion['value'],
    providerKind: row.providerKind,
    provider: row.provider,
    externalRecordId: row.externalRecordId,
    ...(row.observedAt === null ? {} : { observedAt: dateString(row.observedAt) }),
    verificationStatus: row.verificationStatus as MetadataAssertion['verificationStatus'],
    assertionHash: row.assertionHash,
  };
}

function toSourceRecord(row: SourceRow, links: ExternalLinkRow[]): SourceRecord {
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind as SourceRecord['kind'],
    canonicalMetadata: row.canonicalMetadata as CanonicalSourceMetadata,
    externalProvenance: links.map(toExternalProvenance),
    status: row.status as SourceRecord['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDocument(row: DocumentRow): KnowledgeDocument {
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

function toVersion(row: VersionRow): KnowledgeDocumentVersion {
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

function toChunk(row: ChunkRow): KnowledgeChunk {
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

function valuesEqual(left: unknown, right: unknown): boolean {
  return stableSerialize(left) === stableSerialize(right);
}

function validateCanonicalField(field: MetadataField, canonical: CanonicalFieldInput<unknown>, byKey: Map<string, MetadataAssertion>): { value: unknown; assertionIds: string[]; resolutionStatus: CanonicalFieldInput<unknown>['resolutionStatus'] } {
  if (!canonical || !Array.isArray(canonical.assertionKeys) || canonical.assertionKeys.length === 0) {
    invalid(`Canonical ${field} must reference at least one assertion.`);
  }
  const assertions = canonical.assertionKeys.map((key) => {
    const assertion = byKey.get(key);
    if (!assertion) invalid(`Canonical ${field} references an unknown assertion.`);
    if (assertion.field !== field) invalid(`Canonical ${field} references an assertion for ${assertion.field}.`);
    return assertion;
  });
  if (!assertions.some((assertion) => valuesEqual(assertion.value, canonical.value))) {
    invalid(`Canonical ${field} is not supported by its assertions.`);
  }
  if (canonical.resolutionStatus === 'resolved' && !assertions.every((assertion) => valuesEqual(assertion.value, canonical.value))) {
    invalid(`Resolved canonical ${field} requires all assertions to agree.`);
  }
  if (canonical.resolutionStatus === 'conflicting' && !assertions.some((assertion) => valuesEqual(assertion.value, canonical.value))) {
    invalid(`Conflicting canonical ${field} must select a real assertion value.`);
  }
  return {
    value: canonical.value,
    assertionIds: assertions.map((assertion) => assertion.id),
    resolutionStatus: canonical.resolutionStatus,
  };
}

function validateCanonicalMetadata(input: CreateSourceRecordInput, rows: MetadataAssertion[]): CanonicalSourceMetadata {
  const byKey = new Map(rows.map((row, index) => [input.metadataAssertions?.[index].localKey ?? '', row]));
  const result: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(input.canonicalMetadata ?? {})) {
    result[field] = validateCanonicalField(field as MetadataField, value as CanonicalFieldInput<unknown>, byKey);
  }
  return result as CanonicalSourceMetadata;
}

@Injectable()
export class KnowledgeRepository {
  private transactional = false;

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: KnowledgeDatabase) {}

  private static forTransaction(db: KnowledgeTransaction): KnowledgeRepository {
    const repository = new KnowledgeRepository(db);
    repository.transactional = true;
    return repository;
  }

  async withTransaction<T>(work: (repository: KnowledgeRepositoryPort) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(KnowledgeRepository.forTransaction(tx)));
  }

  async createSourceRecord(input: CreateSourceRecordInput): Promise<SourceRecord> {
    if (!input.userId || !input.kind) invalid('Source record user and kind are required.');
    const assertions = input.metadataAssertions ?? [];
    const localKeys = new Set<string>();
    if (assertions.some((item) => !item.localKey || localKeys.has(item.localKey) || (localKeys.add(item.localKey), false))) {
      invalid('Metadata assertion localKey values must be unique and non-empty.');
    }
    let sourceId: string;
    try {
      const execute = async (db: KnowledgeDatabase): Promise<string> => {
        const [source] = await db.insert(knowledgeSourceRecords).values({
          userId: input.userId,
          kind: input.kind,
          canonicalMetadata: {},
          status: 'active',
        }).returning({ id: knowledgeSourceRecords.id });
        if (!source) throw new KnowledgeError('KNOWLEDGE_METADATA_CONFLICT', 'Source record was not created.');

        const insertedAssertions = assertions.length === 0 ? [] : await db.insert(knowledgeMetadataAssertions).values(
          assertions.map((item) => ({
            userId: input.userId,
            sourceRecordId: source.id,
            field: item.field,
            value: item.value,
            providerKind: item.providerKind,
            provider: item.provider,
            externalRecordId: item.externalRecordId,
            ...(item.observedAt === undefined ? {} : { observedAt: new Date(item.observedAt) }),
            verificationStatus: item.verificationStatus,
            assertionHash: assertionHash(item),
          })),
        ).returning();
        const canonicalMetadata = validateCanonicalMetadata(input, insertedAssertions.map(toMetadataAssertion));
        if (input.externalProvenance?.length) {
          await db.insert(knowledgeSourceExternalLinks).values(input.externalProvenance.map((link) => ({
            userId: input.userId,
            sourceRecordId: source.id,
            connectorKind: link.connectorKind,
            provider: link.provider,
            externalRecordId: link.externalRecordId,
            ...(link.externalVersion === undefined ? {} : { externalVersion: link.externalVersion }),
            ...(link.canonicalUrl === undefined ? {} : { canonicalUrl: link.canonicalUrl }),
            ...(link.retrievedAt === undefined ? {} : { retrievedAt: new Date(link.retrievedAt) }),
            ...(link.licenseOrAccessNote === undefined ? {} : { licenseOrAccessNote: link.licenseOrAccessNote }),
            verificationStatus: link.verificationStatus,
          })));
        }
        await db.update(knowledgeSourceRecords).set({ canonicalMetadata: canonicalMetadata as unknown as Record<string, unknown> }).where(eq(knowledgeSourceRecords.id, source.id));
        return source.id;
      };
      sourceId = this.transactional ? await execute(this.db) : await this.db.transaction(execute);
    } catch (error) {
      if (error instanceof KnowledgeError) throw error;
      if (isUniqueViolation(error)) throw new KnowledgeError('KNOWLEDGE_METADATA_CONFLICT', 'Source metadata conflicts with existing evidence.');
      throw error;
    }
    const result = await this.getSourceRecord(input.userId, sourceId);
    if (!result) throw new KnowledgeError('KNOWLEDGE_NOT_FOUND', 'Source record was not found after creation.');
    return result;
  }

  async createExternalLinks(input: { userId: string; sourceRecordId: string; links: ExternalProvenance[] }): Promise<void> {
    const source = await this.getSourceRecord(input.userId, input.sourceRecordId);
    if (!source) throw new KnowledgeError('KNOWLEDGE_NOT_FOUND', 'Source record was not found.');
    try {
      await this.db.insert(knowledgeSourceExternalLinks).values(input.links.map((link) => ({
        userId: input.userId,
        sourceRecordId: input.sourceRecordId,
        connectorKind: link.connectorKind,
        provider: link.provider,
        externalRecordId: link.externalRecordId,
        ...(link.externalVersion === undefined ? {} : { externalVersion: link.externalVersion }),
        ...(link.canonicalUrl === undefined ? {} : { canonicalUrl: link.canonicalUrl }),
        ...(link.retrievedAt === undefined ? {} : { retrievedAt: new Date(link.retrievedAt) }),
        ...(link.licenseOrAccessNote === undefined ? {} : { licenseOrAccessNote: link.licenseOrAccessNote }),
        verificationStatus: link.verificationStatus,
      })));
    } catch (error) {
      if (isUniqueViolation(error)) throw new KnowledgeError('KNOWLEDGE_METADATA_CONFLICT', 'External identity already exists for this user.');
      throw error;
    }
  }

  async getSourceRecord(userId: string, sourceRecordId: string): Promise<SourceRecord | null> {
    const [source] = await this.db.select().from(knowledgeSourceRecords).where(and(eq(knowledgeSourceRecords.id, sourceRecordId), eq(knowledgeSourceRecords.userId, userId))).limit(1);
    if (!source) return null;
    const links = await this.db.select().from(knowledgeSourceExternalLinks).where(and(eq(knowledgeSourceExternalLinks.sourceRecordId, sourceRecordId), eq(knowledgeSourceExternalLinks.userId, userId)));
    return toSourceRecord(source, links);
  }

  async createDocument(input: { userId: string; sourceRecordId?: string; originKind: KnowledgeDocument['originKind']; displayName: string; sourceType: KnowledgeDocument['sourceType'] }): Promise<KnowledgeDocument> {
    if (!input.userId || !input.displayName || input.displayName.length > 255) invalid('Document user and safe display name are required.');
    if (input.sourceRecordId && !(await this.getSourceRecord(input.userId, input.sourceRecordId))) throw new KnowledgeError('KNOWLEDGE_NOT_FOUND', 'Source record was not found.');
    const [row] = await this.db.insert(knowledgeDocuments).values({
      userId: input.userId,
      ...(input.sourceRecordId === undefined ? {} : { sourceRecordId: input.sourceRecordId }),
      originKind: input.originKind,
      displayName: input.displayName,
      sourceType: input.sourceType,
      lifecycleStatus: 'active',
    }).returning();
    return toDocument(row);
  }

  async getDocument(userId: string, documentId: string): Promise<KnowledgeDocument | null> {
    const [row] = await this.db.select().from(knowledgeDocuments).where(and(eq(knowledgeDocuments.id, documentId), eq(knowledgeDocuments.userId, userId), eq(knowledgeDocuments.lifecycleStatus, 'active'))).limit(1);
    return row ? toDocument(row) : null;
  }

  async createVersion(input: Omit<KnowledgeDocumentVersion, 'id' | 'createdAt'>): Promise<KnowledgeDocumentVersion> {
    const [document] = await this.db.select({ id: knowledgeDocuments.id }).from(knowledgeDocuments).where(and(eq(knowledgeDocuments.id, input.documentId), eq(knowledgeDocuments.userId, input.userId), eq(knowledgeDocuments.lifecycleStatus, 'active'))).limit(1);
    if (!document) throw new KnowledgeError('KNOWLEDGE_NOT_FOUND', 'Document was not found.');
    try {
      const [row] = await this.db.insert(knowledgeDocumentVersions).values({
        userId: input.userId,
        documentId: input.documentId,
        versionNumber: input.versionNumber,
        originalContentHash: input.originalContentHash,
        ...(input.normalizedContentHash === undefined ? {} : { normalizedContentHash: input.normalizedContentHash }),
        ...(input.normalizationProfile === undefined ? {} : { normalizationProfile: input.normalizationProfile }),
        parserProfile: input.parserProfile,
        chunkingProfile: input.chunkingProfile,
        ...(input.sourceText === undefined ? {} : { sourceText: input.sourceText }),
        ...(input.sourceArtifactRef === undefined ? {} : { sourceArtifactRef: input.sourceArtifactRef }),
        ...(input.supersedesVersionId === undefined ? {} : { supersedesVersionId: input.supersedesVersionId }),
        lifecycleStatus: input.lifecycleStatus,
        readinessStatus: input.readinessStatus,
        indexInputFingerprint: input.indexInputFingerprint,
      }).returning();
      return toVersion(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw new KnowledgeError('KNOWLEDGE_IMMUTABLE_VERSION', 'An immutable version with this identity already exists.');
      throw error;
    }
  }

  async getVersion(userId: string, versionId: string): Promise<KnowledgeDocumentVersion | null> {
    const [row] = await this.db.select().from(knowledgeDocumentVersions).where(and(eq(knowledgeDocumentVersions.id, versionId), eq(knowledgeDocumentVersions.userId, userId))).limit(1);
    return row ? toVersion(row) : null;
  }

  async getLatestVersion(userId: string, documentId: string): Promise<KnowledgeDocumentVersion | null> {
    const rows = await this.db.select().from(knowledgeDocumentVersions).where(and(eq(knowledgeDocumentVersions.documentId, documentId), eq(knowledgeDocumentVersions.userId, userId))).orderBy(knowledgeDocumentVersions.versionNumber);
    const row = rows[rows.length - 1];
    return row ? toVersion(row) : null;
  }

  async createChunks(input: KnowledgeChunk[]): Promise<KnowledgeChunk[]> {
    if (input.length === 0) return [];
    const first = input[0];
    const [version] = await this.db.select({ id: knowledgeDocumentVersions.id }).from(knowledgeDocumentVersions).where(and(eq(knowledgeDocumentVersions.id, first.documentVersionId), eq(knowledgeDocumentVersions.userId, first.userId))).limit(1);
    if (!version || input.some((chunk) => chunk.userId !== first.userId || chunk.documentVersionId !== first.documentVersionId)) throw new KnowledgeError('KNOWLEDGE_NOT_FOUND', 'Document version was not found.');
    try {
      const rows = await this.db.insert(knowledgeChunks).values(input.map((chunk) => ({
        id: chunk.id,
        userId: chunk.userId,
        documentVersionId: chunk.documentVersionId,
        ordinal: chunk.ordinal,
        text: chunk.text,
        textHash: chunk.textHash,
        provenance: chunk.provenance,
        citationLocator: chunk.citationLocator,
      }))).returning();
      return rows.map(toChunk);
    } catch (error) {
      if (isUniqueViolation(error)) throw new KnowledgeError('KNOWLEDGE_IMMUTABLE_VERSION', 'Chunk identity or ordinal already exists.');
      throw error;
    }
  }

  async getChunks(userId: string, versionId: string): Promise<KnowledgeChunk[]> {
    const rows = await this.db.select().from(knowledgeChunks).where(and(eq(knowledgeChunks.userId, userId), eq(knowledgeChunks.documentVersionId, versionId))).orderBy(knowledgeChunks.ordinal);
    return rows.map(toChunk);
  }

  async activateVersion(userId: string, documentId: string, versionId: string): Promise<void> {
    const [version] = await this.db.select({ id: knowledgeDocumentVersions.id }).from(knowledgeDocumentVersions).where(and(eq(knowledgeDocumentVersions.id, versionId), eq(knowledgeDocumentVersions.documentId, documentId), eq(knowledgeDocumentVersions.userId, userId))).limit(1);
    if (!version) throw new KnowledgeError('KNOWLEDGE_NOT_FOUND', 'Document version was not found.');
    const result = await this.db.update(knowledgeDocuments).set({ activeVersionId: versionId, updatedAt: new Date() }).where(and(eq(knowledgeDocuments.id, documentId), eq(knowledgeDocuments.userId, userId), eq(knowledgeDocuments.lifecycleStatus, 'active'))).returning({ id: knowledgeDocuments.id });
    if (!result.length) throw new KnowledgeError('KNOWLEDGE_NOT_FOUND', 'Document was not found.');
  }

  async findImport(userId: string, idempotencyKey: string): Promise<{ requestFingerprint: string; documentId?: string; documentVersionId?: string; status: string } & { id: string } | null> {
    const [row] = await this.db.select().from(knowledgeImports).where(and(eq(knowledgeImports.userId, userId), eq(knowledgeImports.idempotencyKey, idempotencyKey))).limit(1);
    if (!row) return null;
    return {
      id: row.id,
      requestFingerprint: row.requestFingerprint,
      ...(row.documentId === null ? {} : { documentId: row.documentId }),
      ...(row.documentVersionId === null ? {} : { documentVersionId: row.documentVersionId }),
      status: row.status,
    };
  }

  async createImportMarker(input: { userId: string; idempotencyKey: string; requestFingerprint: string }): Promise<string> {
    const [created] = await this.db.insert(knowledgeImports).values({
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: input.requestFingerprint,
      status: 'processing',
    }).onConflictDoNothing({ target: [knowledgeImports.userId, knowledgeImports.idempotencyKey] }).returning({ id: knowledgeImports.id });
    const existing = await this.findImport(input.userId, input.idempotencyKey);
    if (!existing) throw new KnowledgeError('KNOWLEDGE_IDEMPOTENCY_CONFLICT', 'Import marker could not be re-read.');
    if (existing.requestFingerprint !== input.requestFingerprint) throw new KnowledgeError('KNOWLEDGE_IDEMPOTENCY_CONFLICT', 'Idempotency key belongs to a different import.');
    return created?.id ?? existing.id;
  }

  async claimImportMarker(input: { userId: string; idempotencyKey: string; requestFingerprint: string }): Promise<{ id: string; created: boolean }> {
    const existingBefore = await this.findImport(input.userId, input.idempotencyKey);
    if (existingBefore) {
      if (existingBefore.requestFingerprint !== input.requestFingerprint) throw new KnowledgeError('KNOWLEDGE_IDEMPOTENCY_CONFLICT', 'Idempotency key belongs to a different import.');
      return { id: existingBefore.id, created: false };
    }
    const [created] = await this.db.insert(knowledgeImports).values({
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: input.requestFingerprint,
      status: 'processing',
    }).onConflictDoNothing({ target: [knowledgeImports.userId, knowledgeImports.idempotencyKey] }).returning({ id: knowledgeImports.id });
    const existing = await this.findImport(input.userId, input.idempotencyKey);
    if (!existing) throw new KnowledgeError('KNOWLEDGE_IDEMPOTENCY_CONFLICT', 'Import marker could not be re-read.');
    if (existing.requestFingerprint !== input.requestFingerprint) throw new KnowledgeError('KNOWLEDGE_IDEMPOTENCY_CONFLICT', 'Idempotency key belongs to a different import.');
    return { id: existing.id, created: Boolean(created) && !existingBefore };
  }

  async completeImport(userId: string, importId: string, documentId: string, documentVersionId: string): Promise<void> {
    const result = await this.db.update(knowledgeImports).set({ documentId, documentVersionId, status: 'completed', updatedAt: new Date() }).where(and(eq(knowledgeImports.id, importId), eq(knowledgeImports.userId, userId))).returning({ id: knowledgeImports.id });
    if (!result.length) throw new KnowledgeError('KNOWLEDGE_NOT_FOUND', 'Import marker was not found.');
  }

  async tombstoneDocument(userId: string, documentId: string): Promise<void> {
    const result = await this.db.update(knowledgeDocuments).set({ lifecycleStatus: 'tombstoned', updatedAt: new Date() }).where(and(eq(knowledgeDocuments.id, documentId), eq(knowledgeDocuments.userId, userId))).returning({ id: knowledgeDocuments.id });
    if (!result.length) throw new KnowledgeError('KNOWLEDGE_NOT_FOUND', 'Document was not found.');
  }
}
