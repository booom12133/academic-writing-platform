import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const vector = customType<{ data: number[]; driverData: string }>({
  dataType: () => 'vector',
  toDriver: (value) => `[${value.join(',')}]`,
  fromDriver: (value) => String(value).slice(1, -1).split(',').filter(Boolean).map(Number),
});

const createdAt = () =>
  timestamp('_created_at', { withTimezone: true, precision: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`);

const updatedAt = () =>
  timestamp('_updated_at', { withTimezone: true, precision: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`);

const createdBy = () => text('_created_by');
const updatedBy = () => text('_updated_by');

export const rechargeOrders = pgTable(
  'recharge_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    amount: integer('amount').notNull(),
    points: integer('points').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    payMethod: varchar('pay_method', { length: 20 }),
    payOrderNo: varchar('pay_order_no', { length: 100 }),
    createdAt: createdAt(),
    createdBy: createdBy(),
    updatedAt: updatedAt(),
    updatedBy: updatedBy(),
  },
  (table) => [
    index('idx_recharge_orders_user_id').on(table.userId),
    index('idx_recharge_orders_status').on(table.status),
  ],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    taskType: varchar('task_type', { length: 30 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    progress: integer('progress').notNull().default(0),
    pointsCost: integer('points_cost').notNull().default(0),
    inputData: jsonb('input_data').notNull().default(sql`'{}'::jsonb`),
    resultData: jsonb('result_data'),
    errorMessage: text('error_message'),
    createdAt: createdAt(),
    createdBy: createdBy(),
    updatedAt: updatedAt(),
    updatedBy: updatedBy(),
  },
  (table) => [
    index('idx_tasks_user_id').on(table.userId),
    index('idx_tasks_status').on(table.status),
    index('idx_tasks_task_type').on(table.taskType),
    index('idx_tasks_created_at').on(table.createdAt),
  ],
);

export const pointRecords = pgTable(
  'point_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    amount: integer('amount').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    taskId: uuid('task_id'),
    orderId: uuid('order_id'),
    description: varchar('description', { length: 255 }),
    createdAt: createdAt(),
    createdBy: createdBy(),
    updatedAt: updatedAt(),
    updatedBy: updatedBy(),
  },
  (table) => [
    index('idx_point_records_user_id').on(table.userId),
    index('idx_point_records_created_at').on(table.createdAt),
  ],
);

export const appUsers = pgTable(
  'app_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    phone: varchar('phone', { length: 20 }),
    username: varchar('username', { length: 50 }),
    passwordHash: varchar('password_hash', { length: 255 }),
    avatarUrl: text('avatar_url'),
    points: integer('points').notNull().default(0),
    totalRecharge: integer('total_recharge').notNull().default(0),
    memberLevel: varchar('member_level', { length: 20 }).notNull().default('normal'),
    createdAt: createdAt(),
    createdBy: createdBy(),
    updatedAt: updatedAt(),
    updatedBy: updatedBy(),
  },
  (table) => [
    uniqueIndex('app_users_user_id_key').on(table.userId),
    index('idx_app_users_user_id').on(table.userId),
  ],
);

export const knowledgeSourceRecords = pgTable(
  'knowledge_source_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    kind: varchar('kind', { length: 32 }).notNull(),
    canonicalMetadata: jsonb('canonical_metadata').notNull().default(sql`'{}'::jsonb`),
    status: varchar('status', { length: 24 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('knowledge_source_records_id_user_id_key').on(table.id, table.userId),
    index('knowledge_source_records_user_status_idx').on(table.userId, table.status),
  ],
);

export const knowledgeMetadataAssertions = pgTable(
  'knowledge_metadata_assertions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    sourceRecordId: uuid('source_record_id').notNull(),
    field: varchar('field', { length: 32 }).notNull(),
    value: jsonb('value').notNull(),
    providerKind: varchar('provider_kind', { length: 64 }).notNull(),
    provider: varchar('provider', { length: 128 }).notNull(),
    externalRecordId: varchar('external_record_id', { length: 255 }).notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true, precision: 3 }),
    verificationStatus: varchar('verification_status', { length: 24 }).notNull(),
    assertionHash: varchar('assertion_hash', { length: 64 }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('knowledge_metadata_assertions_id_user_id_key').on(table.id, table.userId),
    uniqueIndex('knowledge_metadata_assertions_identity_key').on(
      table.sourceRecordId,
      table.userId,
      table.assertionHash,
    ),
    index('knowledge_metadata_assertions_user_source_field_idx').on(
      table.userId,
      table.sourceRecordId,
      table.field,
    ),
    foreignKey({
      columns: [table.sourceRecordId, table.userId],
      foreignColumns: [knowledgeSourceRecords.id, knowledgeSourceRecords.userId],
      name: 'knowledge_metadata_assertions_source_owner_fk',
    }),
  ],
);

export const knowledgeSourceExternalLinks = pgTable(
  'knowledge_source_external_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    sourceRecordId: uuid('source_record_id').notNull(),
    connectorKind: varchar('connector_kind', { length: 64 }).notNull(),
    provider: varchar('provider', { length: 128 }).notNull(),
    externalRecordId: varchar('external_record_id', { length: 255 }).notNull(),
    externalVersion: varchar('external_version', { length: 255 }),
    canonicalUrl: text('canonical_url'),
    retrievedAt: timestamp('retrieved_at', { withTimezone: true, precision: 3 }),
    licenseOrAccessNote: text('license_or_access_note'),
    verificationStatus: varchar('verification_status', { length: 24 }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('knowledge_source_external_links_id_user_id_key').on(table.id, table.userId),
    uniqueIndex('knowledge_source_external_links_identity_key').on(
      table.userId,
      table.connectorKind,
      table.provider,
      table.externalRecordId,
    ),
    index('knowledge_source_external_links_user_source_idx').on(
      table.userId,
      table.sourceRecordId,
    ),
    foreignKey({
      columns: [table.sourceRecordId, table.userId],
      foreignColumns: [knowledgeSourceRecords.id, knowledgeSourceRecords.userId],
      name: 'knowledge_source_external_links_source_owner_fk',
    }),
  ],
);

export const knowledgeDocuments = pgTable(
  'knowledge_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    sourceRecordId: uuid('source_record_id'),
    originKind: varchar('origin_kind', { length: 32 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    sourceType: varchar('source_type', { length: 16 }).notNull(),
    activeVersionId: uuid('active_version_id'),
    lifecycleStatus: varchar('lifecycle_status', { length: 24 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('knowledge_documents_id_user_id_key').on(table.id, table.userId),
    index('knowledge_documents_user_lifecycle_idx').on(table.userId, table.lifecycleStatus),
    index('knowledge_documents_user_source_idx').on(table.userId, table.sourceRecordId),
    foreignKey({
      columns: [table.sourceRecordId, table.userId],
      foreignColumns: [knowledgeSourceRecords.id, knowledgeSourceRecords.userId],
      name: 'knowledge_documents_source_owner_fk',
    }),
  ],
);

export const knowledgeDocumentVersions = pgTable(
  'knowledge_document_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    documentId: uuid('document_id').notNull(),
    versionNumber: integer('version_number').notNull(),
    originalContentHash: varchar('original_content_hash', { length: 64 }).notNull(),
    normalizedContentHash: varchar('normalized_content_hash', { length: 64 }),
    normalizationProfile: jsonb('normalization_profile'),
    parserProfile: jsonb('parser_profile').notNull(),
    chunkingProfile: jsonb('chunking_profile').notNull(),
    sourceText: text('source_text'),
    sourceArtifactRef: jsonb('source_artifact_ref'),
    supersedesVersionId: uuid('supersedes_version_id'),
    lifecycleStatus: varchar('lifecycle_status', { length: 24 }).notNull(),
    readinessStatus: varchar('readiness_status', { length: 32 }).notNull(),
    indexInputFingerprint: varchar('index_input_fingerprint', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('knowledge_document_versions_id_user_id_key').on(table.id, table.userId),
    uniqueIndex('knowledge_document_versions_number_key').on(
      table.documentId,
      table.userId,
      table.versionNumber,
    ),
    uniqueIndex('knowledge_document_versions_fingerprint_key').on(
      table.documentId,
      table.userId,
      table.indexInputFingerprint,
    ),
    index('knowledge_document_versions_user_document_state_idx').on(
      table.userId,
      table.documentId,
      table.lifecycleStatus,
      table.readinessStatus,
    ),
    foreignKey({
      columns: [table.documentId, table.userId],
      foreignColumns: [knowledgeDocuments.id, knowledgeDocuments.userId],
      name: 'knowledge_document_versions_document_owner_fk',
    }),
    foreignKey({
      columns: [table.supersedesVersionId, table.userId],
      foreignColumns: [knowledgeDocumentVersions.id, knowledgeDocumentVersions.userId],
      name: 'knowledge_document_versions_supersedes_owner_fk',
    }),
  ],
);

export const knowledgeChunks = pgTable(
  'knowledge_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    documentVersionId: uuid('document_version_id').notNull(),
    ordinal: integer('ordinal').notNull(),
    text: text('text').notNull(),
    textHash: varchar('text_hash', { length: 64 }).notNull(),
    provenance: jsonb('provenance').notNull(),
    citationLocator: jsonb('citation_locator').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('knowledge_chunks_id_user_id_key').on(table.id, table.userId),
    uniqueIndex('knowledge_chunks_version_ordinal_key').on(
      table.documentVersionId,
      table.userId,
      table.ordinal,
    ),
    index('knowledge_chunks_user_version_ordinal_idx').on(
      table.userId,
      table.documentVersionId,
      table.ordinal,
    ),
    foreignKey({
      columns: [table.documentVersionId, table.userId],
      foreignColumns: [knowledgeDocumentVersions.id, knowledgeDocumentVersions.userId],
      name: 'knowledge_chunks_version_owner_fk',
    }),
  ],
);

export const knowledgeImports = pgTable(
  'knowledge_imports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
    requestFingerprint: varchar('request_fingerprint', { length: 64 }).notNull(),
    documentId: uuid('document_id'),
    documentVersionId: uuid('document_version_id'),
    status: varchar('status', { length: 24 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('knowledge_imports_id_user_id_key').on(table.id, table.userId),
    uniqueIndex('knowledge_imports_user_idempotency_key').on(
      table.userId,
      table.idempotencyKey,
    ),
    index('knowledge_imports_user_status_idx').on(table.userId, table.status),
    foreignKey({
      columns: [table.documentId, table.userId],
      foreignColumns: [knowledgeDocuments.id, knowledgeDocuments.userId],
      name: 'knowledge_imports_document_owner_fk',
    }),
    foreignKey({
      columns: [table.documentVersionId, table.userId],
      foreignColumns: [knowledgeDocumentVersions.id, knowledgeDocumentVersions.userId],
      name: 'knowledge_imports_version_owner_fk',
    }),
  ],
);

export const knowledgeEmbeddingIndexes = pgTable(
  'knowledge_embedding_indexes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    documentVersionId: uuid('document_version_id').notNull(),
    e1IndexInputFingerprint: varchar('e1_index_input_fingerprint', { length: 64 }).notNull(),
    embeddingProfileFingerprint: varchar('embedding_profile_fingerprint', { length: 64 }).notNull(),
    indexFingerprint: varchar('index_fingerprint', { length: 64 }).notNull(),
    embeddingModelIdentity: jsonb('embedding_model_identity').notNull(),
    status: varchar('status', { length: 16 }).notNull(),
    totalChunks: integer('total_chunks').notNull(),
    indexedChunks: integer('indexed_chunks').notNull().default(0),
    failedChunks: integer('failed_chunks').notNull().default(0),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastErrorCode: varchar('last_error_code', { length: 64 }),
    lastErrorMessage: varchar('last_error_message', { length: 512 }),
    leaseOwner: varchar('lease_owner', { length: 128 }),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true, precision: 3 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    indexedAt: timestamp('indexed_at', { withTimezone: true, precision: 3 }),
  },
  (table) => [
    uniqueIndex('knowledge_embedding_indexes_id_user_id_key').on(table.id, table.userId),
    uniqueIndex('knowledge_embedding_indexes_version_fingerprint_key').on(
      table.documentVersionId,
      table.indexFingerprint,
    ),
    uniqueIndex('knowledge_embedding_indexes_natural_key').on(
      table.userId,
      table.documentVersionId,
      table.e1IndexInputFingerprint,
      table.embeddingProfileFingerprint,
    ),
    index('knowledge_embedding_indexes_user_version_status_idx').on(
      table.userId,
      table.documentVersionId,
      table.status,
    ),
    index('knowledge_embedding_indexes_lease_idx').on(table.status, table.leaseExpiresAt),
    check(
      'knowledge_embedding_indexes_status_check',
      sql`${table.status} in ('indexing', 'indexed', 'failed', 'stale')`,
    ),
    check(
      'knowledge_embedding_indexes_counts_check',
      sql`${table.totalChunks} >= 0 and ${table.indexedChunks} >= 0 and ${table.failedChunks} >= 0 and ${table.indexedChunks} + ${table.failedChunks} <= ${table.totalChunks}`,
    ),
    foreignKey({
      columns: [table.documentVersionId, table.userId],
      foreignColumns: [knowledgeDocumentVersions.id, knowledgeDocumentVersions.userId],
      name: 'knowledge_embedding_indexes_version_owner_fk',
    }),
  ],
);

export const knowledgeChunkEmbeddings = pgTable(
  'knowledge_chunk_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    knowledgeEmbeddingIndexId: uuid('knowledge_embedding_index_id').notNull(),
    knowledgeChunkId: uuid('knowledge_chunk_id').notNull(),
    inputFingerprint: varchar('input_fingerprint', { length: 64 }).notNull(),
    embeddingProfileFingerprint: varchar('embedding_profile_fingerprint', { length: 64 }).notNull(),
    dimensions: integer('dimensions').notNull(),
    embedding: vector('embedding'),
    status: varchar('status', { length: 16 }).notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastErrorCode: varchar('last_error_code', { length: 64 }),
    lastErrorMessage: varchar('last_error_message', { length: 512 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    indexedAt: timestamp('indexed_at', { withTimezone: true, precision: 3 }),
  },
  (table) => [
    uniqueIndex('knowledge_chunk_embeddings_id_user_id_key').on(table.id, table.userId),
    uniqueIndex('knowledge_chunk_embeddings_identity_key').on(
      table.userId,
      table.knowledgeChunkId,
      table.embeddingProfileFingerprint,
      table.inputFingerprint,
    ),
    index('knowledge_chunk_embeddings_user_index_status_idx').on(
      table.userId,
      table.knowledgeEmbeddingIndexId,
      table.status,
    ),
    check(
      'knowledge_chunk_embeddings_status_check',
      sql`${table.status} in ('indexing', 'indexed', 'failed', 'stale')`,
    ),
    check('knowledge_chunk_embeddings_dimensions_check', sql`${table.dimensions} > 0`),
    check(
      'knowledge_chunk_embeddings_vector_dimensions_check',
      sql`${table.embedding} is null or vector_dims(${table.embedding}) = ${table.dimensions}`,
    ),
    check(
      'knowledge_chunk_embeddings_indexed_vector_check',
      sql`${table.status} <> 'indexed' or ${table.embedding} is not null`,
    ),
    foreignKey({
      columns: [table.knowledgeEmbeddingIndexId, table.userId],
      foreignColumns: [knowledgeEmbeddingIndexes.id, knowledgeEmbeddingIndexes.userId],
      name: 'knowledge_chunk_embeddings_index_owner_fk',
    }),
    foreignKey({
      columns: [table.knowledgeChunkId, table.userId],
      foreignColumns: [knowledgeChunks.id, knowledgeChunks.userId],
      name: 'knowledge_chunk_embeddings_chunk_owner_fk',
    }),
  ],
);

export const appUsersTable = appUsers;
export const pointRecordsTable = pointRecords;
export const rechargeOrdersTable = rechargeOrders;
export const tasksTable = tasks;
