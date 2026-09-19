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

export const zoteroConnections = pgTable(
  'zotero_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    libraryType: varchar('library_type', { length: 16 }).notNull(),
    libraryId: varchar('library_id', { length: 64 }).notNull(),
    ciphertext: text('ciphertext').notNull(),
    nonce: varchar('nonce', { length: 128 }).notNull(),
    authTag: varchar('auth_tag', { length: 128 }).notNull(),
    encryptionAlgorithm: varchar('encryption_algorithm', { length: 32 }).notNull(),
    encryptionKeyVersion: varchar('encryption_key_version', { length: 64 }).notNull(),
    keyFingerprint: varchar('key_fingerprint', { length: 128 }).notNull(),
    status: varchar('status', { length: 24 }).notNull(),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true, precision: 3 }),
    lastSeenLibraryVersion: varchar('last_seen_library_version', { length: 255 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('zotero_connections_id_user_id_key').on(table.id, table.userId),
    uniqueIndex('zotero_connections_identity_key').on(table.userId, table.libraryType, table.libraryId),
    index('zotero_connections_user_status_idx').on(table.userId, table.status),
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
    externalIdentity: varchar('external_identity', { length: 255 }),
    externalVersion: varchar('external_version', { length: 255 }),
    externalChecksumAlgorithm: varchar('external_checksum_algorithm', { length: 32 }),
    externalChecksum: varchar('external_checksum', { length: 128 }),
    lifecycleStatus: varchar('lifecycle_status', { length: 24 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('knowledge_documents_id_user_id_key').on(table.id, table.userId),
    index('knowledge_documents_user_lifecycle_idx').on(table.userId, table.lifecycleStatus),
    index('knowledge_documents_user_source_idx').on(table.userId, table.sourceRecordId),
    uniqueIndex('knowledge_documents_external_identity_key').on(table.userId, table.externalIdentity),
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

export const paperProjects = pgTable(
  'paper_projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    selectedTitle: varchar('selected_title', { length: 500 }),
    profile: jsonb('profile').notNull(),
    researchPlan: jsonb('research_plan'),
    defaultSourceStrategy: varchar('default_source_strategy', { length: 32 }).notNull().default('MODEL_ONLY'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    lockVersion: integer('lock_version').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('paper_projects_id_user_id_key').on(table.id, table.userId),
    index('paper_projects_user_status_updated_idx').on(table.userId, table.status, table.updatedAt),
    check('paper_projects_status_check', sql`${table.status} in ('active', 'archived')`),
    check('paper_projects_strategy_check', sql`${table.defaultSourceStrategy} in ('MODEL_ONLY', 'WEB_RETRIEVED', 'USER_KNOWLEDGE', 'MIXED')`),
    check('paper_projects_lock_version_check', sql`${table.lockVersion} >= 0`),
  ],
);

export const paperOutlineNodes = pgTable(
  'paper_outline_nodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    parentId: uuid('parent_id'),
    nodeType: varchar('node_type', { length: 20 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    position: integer('position').notNull(),
    targetWords: integer('target_words'),
    generationNotes: text('generation_notes'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('paper_outline_nodes_id_project_user_key').on(table.id, table.projectId, table.userId),
    uniqueIndex('paper_outline_nodes_active_root_position_key')
      .on(table.projectId, table.userId, table.position)
      .where(sql`${table.parentId} is null and ${table.status} = 'active'`),
    uniqueIndex('paper_outline_nodes_active_child_position_key')
      .on(table.projectId, table.userId, table.parentId, table.position)
      .where(sql`${table.parentId} is not null and ${table.status} = 'active'`),
    index('paper_outline_nodes_tree_idx').on(table.userId, table.projectId, table.status, table.parentId, table.position),
    check('paper_outline_nodes_type_check', sql`${table.nodeType} in ('container', 'writing-unit')`),
    check('paper_outline_nodes_status_check', sql`${table.status} in ('active', 'archived')`),
    check('paper_outline_nodes_position_check', sql`${table.position} >= 0`),
    check('paper_outline_nodes_target_words_check', sql`${table.targetWords} is null or ${table.targetWords} > 0`),
    foreignKey({
      columns: [table.projectId, table.userId],
      foreignColumns: [paperProjects.id, paperProjects.userId],
      name: 'paper_outline_nodes_project_owner_fk',
    }),
    foreignKey({
      columns: [table.parentId, table.projectId, table.userId],
      foreignColumns: [table.id, table.projectId, table.userId],
      name: 'paper_outline_nodes_parent_owner_fk',
    }),
  ],
);

export const paperSections = pgTable(
  'paper_sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    outlineNodeId: uuid('outline_node_id'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    currentRevisionNumber: integer('current_revision_number').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('paper_sections_id_user_id_key').on(table.id, table.userId),
    uniqueIndex('paper_sections_project_outline_key').on(table.projectId, table.outlineNodeId),
    index('paper_sections_project_status_idx').on(table.userId, table.projectId, table.status),
    check('paper_sections_status_check', sql`${table.status} in ('active', 'orphaned', 'archived')`),
    check('paper_sections_revision_check', sql`${table.currentRevisionNumber} >= 0`),
    foreignKey({ columns: [table.projectId, table.userId], foreignColumns: [paperProjects.id, paperProjects.userId], name: 'paper_sections_project_owner_fk' }),
    foreignKey({ columns: [table.outlineNodeId, table.projectId, table.userId], foreignColumns: [paperOutlineNodes.id, paperOutlineNodes.projectId, paperOutlineNodes.userId], name: 'paper_sections_outline_owner_fk' }),
  ],
);

export const paperSectionRevisions = pgTable(
  'paper_section_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sectionId: uuid('section_id').notNull(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    revisionNumber: integer('revision_number').notNull(),
    baseRevisionId: uuid('base_revision_id'),
    content: text('content').notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    origin: varchar('origin', { length: 24 }).notNull(),
    sourceStrategy: varchar('source_strategy', { length: 32 }).notNull(),
    actualSupportMode: varchar('actual_support_mode', { length: 24 }).notNull(),
    supportState: varchar('support_state', { length: 24 }).notNull(),
    citations: jsonb('citations').notNull().default(sql`'[]'::jsonb`),
    bibliography: jsonb('bibliography').notNull().default(sql`'[]'::jsonb`),
    evidenceTrace: jsonb('evidence_trace').notNull().default(sql`'[]'::jsonb`),
    generationMetadata: jsonb('generation_metadata').notNull().default(sql`'{}'::jsonb`),
    warnings: jsonb('warnings').notNull().default(sql`'[]'::jsonb`),
    rewriteInstruction: text('rewrite_instruction'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('paper_section_revisions_id_section_user_key').on(table.id, table.sectionId, table.userId),
    uniqueIndex('paper_section_revisions_number_key').on(table.sectionId, table.userId, table.revisionNumber),
    index('paper_section_revisions_history_idx').on(table.userId, table.sectionId, table.revisionNumber),
    check('paper_section_revisions_number_check', sql`${table.revisionNumber} > 0`),
    check('paper_section_revisions_content_check', sql`length(trim(${table.content})) > 0`),
    check('paper_section_revisions_origin_check', sql`${table.origin} in ('AI_GENERATION', 'AI_REWRITE', 'USER_EDIT')`),
    check('paper_section_revisions_strategy_check', sql`${table.sourceStrategy} in ('MODEL_ONLY', 'WEB_RETRIEVED', 'USER_KNOWLEDGE', 'MIXED')`),
    check('paper_section_revisions_support_mode_check', sql`${table.actualSupportMode} in ('AI_DRAFT', 'WEB_EVIDENCE', 'USER_EVIDENCE', 'MIXED_EVIDENCE')`),
    check('paper_section_revisions_support_state_check', sql`${table.supportState} in ('NOT_CLAIMED', 'VALID', 'STALE_AFTER_EDIT')`),
    foreignKey({ columns: [table.sectionId, table.userId], foreignColumns: [paperSections.id, paperSections.userId], name: 'paper_section_revisions_section_owner_fk' }),
    foreignKey({ columns: [table.baseRevisionId, table.sectionId, table.userId], foreignColumns: [table.id, table.sectionId, table.userId], name: 'paper_section_revisions_base_owner_fk' }),
  ],
);

export const paperProjectSources = pgTable(
  'paper_project_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    sourceRecordId: uuid('source_record_id'),
    documentVersionId: uuid('document_version_id'),
    originClass: varchar('origin_class', { length: 24 }).notNull(),
    selectionStatus: varchar('selection_status', { length: 20 }).notNull().default('selected'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('paper_project_sources_project_status_idx').on(table.userId, table.projectId, table.selectionStatus),
    uniqueIndex('paper_project_sources_project_source_key').on(table.projectId, table.sourceRecordId).where(sql`${table.sourceRecordId} is not null`),
    uniqueIndex('paper_project_sources_project_version_key').on(table.projectId, table.documentVersionId).where(sql`${table.documentVersionId} is not null`),
    check('paper_project_sources_identity_check', sql`${table.sourceRecordId} is not null or ${table.documentVersionId} is not null`),
    check('paper_project_sources_origin_check', sql`${table.originClass} in ('WEB_IMPORTED', 'USER_KNOWLEDGE')`),
    check('paper_project_sources_selection_check', sql`${table.selectionStatus} in ('selected', 'unbound')`),
    foreignKey({ columns: [table.projectId, table.userId], foreignColumns: [paperProjects.id, paperProjects.userId], name: 'paper_project_sources_project_owner_fk' }),
    foreignKey({ columns: [table.sourceRecordId, table.userId], foreignColumns: [knowledgeSourceRecords.id, knowledgeSourceRecords.userId], name: 'paper_project_sources_source_owner_fk' }),
    foreignKey({ columns: [table.documentVersionId, table.userId], foreignColumns: [knowledgeDocumentVersions.id, knowledgeDocumentVersions.userId], name: 'paper_project_sources_version_owner_fk' }),
  ],
);

export const appUsersTable = appUsers;
export const pointRecordsTable = pointRecords;
export const rechargeOrdersTable = rechargeOrders;
export const tasksTable = tasks;
