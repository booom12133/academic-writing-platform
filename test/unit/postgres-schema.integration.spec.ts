import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { knowledgeDocuments } from '../../server/database/schema';
import { createStandardPostgresConfig } from '../../server/database/standard-postgres.module';
import { KnowledgeRepository, type KnowledgeRepositoryPort } from '../../server/modules/knowledge/knowledge.repository';
import { KnowledgeService } from '../../server/modules/knowledge/knowledge.service';
import { hashTextInputExact } from '../../server/modules/knowledge/knowledge.hash';
import { finalizeKnowledgeChunkDraft } from '../../server/modules/knowledge/knowledge.provenance';
import type { ParsedDocument } from '../../server/modules/document-parsing/document-parser.types';
import type { StructuralDocumentContext } from '../../server/modules/context-builder/context-builder.types';
import type { StructuralChunkedDocument } from '../../server/modules/chunking/chunking.types';
import {
  createP3PostgresRoleFixture,
  type P3PostgresRoleFixture,
} from '../support/p3-postgres-role-fixture';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  assertControlledMigrationPreconditions,
  createMigrationPoolConfig,
  runMigrations,
} = require('../../scripts/db-migrate.js');

const roleIntegrationEnabled = process.env.P3_POSTGRES_ROLE_INTEGRATION === 'YES';
const describeIfDatabase = roleIntegrationEnabled ? describe : describe.skip;

const parsed: ParsedDocument = {
  source: { type: 'txt', fileName: 'input.txt', extension: '.txt', sizeBytes: 12 },
  blocks: [{ id: 'b1', type: 'paragraph', text: 'changed text' }],
  outline: [], plainText: 'changed text', metadata: {}, warnings: [],
};
const structural: StructuralDocumentContext = {
  version: 1,
  source: { id: 'document-1', kind: 'parsed-document', fileName: 'input.txt', sourceType: 'txt', extension: '.txt', sizeBytes: 12, metadata: {}, warnings: [] },
  units: [{ id: 'document-1:b000001', sourceId: 'document-1', sourceBlockId: 'b1', sourceBlockIndex: 0, section: 'content', headingPath: [], block: parsed.blocks[0] }],
};
const chunked: StructuralChunkedDocument = {
  version: 1, source: structural.source,
  policy: { version: 1, maxSize: 100, sizeMetric: 'unicode-code-points', overlap: 0 },
  chunks: [{ id: 'document-1:c000001', sourceId: 'document-1', section: 'content', size: 12, items: [{ kind: 'whole-unit', unit: structural.units[0], size: 12 }] }],
  warnings: [],
};

describeIfDatabase('standard PostgreSQL migrations', () => {
  let pool: Pool;
  let adminPool: Pool;
  let fixture: P3PostgresRoleFixture;

  beforeAll(async () => {
    fixture = await createP3PostgresRoleFixture();
    await fixture.applyCanonicalGrants();

    const migrationEnvironment = {
      NODE_ENV: 'production',
      MIGRATION_DATABASE_URL: fixture.migratorUrl,
      DATABASE_SSL: 'require',
      ...(fixture.caFile ? { DATABASE_SSL_CA_FILE: fixture.caFile } : {}),
    };
    const migrationPool = new Pool(createMigrationPoolConfig(migrationEnvironment));
    const migrationClient = await migrationPool.connect();
    try {
      await assertControlledMigrationPreconditions(migrationClient, { production: true });
    } finally {
      migrationClient.release();
    }
    await migrationPool.end();
    await runMigrations({ pool: new Pool(createMigrationPoolConfig(migrationEnvironment)) });
    await runMigrations({ pool: new Pool(createMigrationPoolConfig(migrationEnvironment)) });
    await fixture.applyCanonicalGrants();

    const appEnvironment = {
      NODE_ENV: 'production',
      DATABASE_URL: fixture.appUrl,
      DATABASE_SSL: 'require',
      ...(fixture.caFile ? { DATABASE_SSL_CA_FILE: fixture.caFile } : {}),
    };
    pool = new Pool(createStandardPostgresConfig(appEnvironment));
    adminPool = new Pool(createStandardPostgresConfig({
      ...appEnvironment,
      DATABASE_URL: fixture.adminUrl,
    }));
  });

  afterAll(async () => {
    await pool.end();
    await adminPool.end();
    await fixture.close();
  });

  it('enforces role attributes, ownership, schema bounds, and vector ownership', async () => {
    const roles = await adminPool.query<{
      rolname: string;
      rolcanlogin: boolean;
      rolinherit: boolean;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
    }>(`
      SELECT rolname, rolcanlogin, rolinherit, rolsuper, rolcreatedb, rolcreaterole
      FROM pg_catalog.pg_roles
      WHERE rolname IN (
        'academic_writing_db_owner',
        'academic_writing_migrator',
        'academic_writing_app'
      )
      ORDER BY rolname
    `);
    expect(roles.rows).toEqual([
      {
        rolname: 'academic_writing_app', rolcanlogin: true, rolinherit: false,
        rolsuper: false, rolcreatedb: false, rolcreaterole: false,
      },
      {
        rolname: 'academic_writing_db_owner', rolcanlogin: false, rolinherit: false,
        rolsuper: false, rolcreatedb: false, rolcreaterole: false,
      },
      {
        rolname: 'academic_writing_migrator', rolcanlogin: true, rolinherit: false,
        rolsuper: false, rolcreatedb: false, rolcreaterole: false,
      },
    ]);

    const ownership = await adminPool.query<{
      database_owner: string;
      public_owner: string;
      drizzle_owner: string;
      vector_owner: string;
    }>(`
      SELECT
        pg_get_userbyid((SELECT datdba FROM pg_database WHERE datname = current_database())) AS database_owner,
        pg_get_userbyid((SELECT nspowner FROM pg_namespace WHERE nspname = 'public')) AS public_owner,
        pg_get_userbyid((SELECT nspowner FROM pg_namespace WHERE nspname = 'drizzle')) AS drizzle_owner,
        pg_get_userbyid((SELECT extowner FROM pg_extension WHERE extname = 'vector')) AS vector_owner
    `);
    expect(ownership.rows[0]).toMatchObject({
      database_owner: 'academic_writing_db_owner',
      public_owner: 'academic_writing_db_owner',
      drizzle_owner: 'academic_writing_db_owner',
    });
    expect(ownership.rows[0].vector_owner).not.toMatch(
      /^academic_writing_(?:migrator|app)$/u,
    );

    const privileges = await adminPool.query<{
      database_create: boolean;
      schema_usage: boolean;
      schema_create: boolean;
      app_is_migrator: boolean;
    }>(`
      SELECT
        has_database_privilege('academic_writing_migrator', current_database(), 'CREATE') AS database_create,
        has_schema_privilege('academic_writing_migrator', 'drizzle', 'USAGE') AS schema_usage,
        has_schema_privilege('academic_writing_migrator', 'drizzle', 'CREATE') AS schema_create,
        pg_has_role('academic_writing_app', 'academic_writing_migrator', 'MEMBER') AS app_is_migrator
    `);
    expect(privileges.rows[0]).toEqual({
      database_create: false,
      schema_usage: true,
      schema_create: true,
      app_is_migrator: false,
    });
  });

  it('denies arbitrary schema creation to the migrator', async () => {
    const migratorPool = new Pool(createMigrationPoolConfig({
      NODE_ENV: 'production',
      MIGRATION_DATABASE_URL: fixture.migratorUrl,
      DATABASE_SSL: 'require',
      ...(fixture.caFile ? { DATABASE_SSL_CA_FILE: fixture.caFile } : {}),
    }));
    await expect(migratorPool.query('CREATE SCHEMA p3_forbidden_schema')).rejects.toThrow();
    await migratorPool.end();
  });

  it('denies runtime DDL while retaining required application DML', async () => {
    await expect(pool.query('CREATE TABLE p3_forbidden_table (id integer)')).rejects.toThrow();
    await expect(pool.query('ALTER TABLE app_users ADD COLUMN p3_forbidden integer')).rejects.toThrow();
    await expect(pool.query('DROP TABLE app_users')).rejects.toThrow();
    await expect(pool.query('CREATE EXTENSION hstore')).rejects.toThrow();
  });

  it('applies the accepted baseline and E1 schema exactly once', async () => {
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
    );
    expect(result.rows.map((row) => row.table_name)).toEqual([
      'app_users', 'knowledge_chunk_embeddings', 'knowledge_chunks', 'knowledge_document_versions', 'knowledge_documents',
      'knowledge_embedding_indexes', 'knowledge_imports', 'knowledge_metadata_assertions', 'knowledge_source_external_links',
      'knowledge_source_records', 'paper_outline_nodes', 'paper_project_sources', 'paper_projects',
      'paper_section_revisions', 'paper_sections', 'point_records', 'recharge_orders', 'tasks', 'zotero_connections',
    ]);
  });

  it('enforces the P4 canonical source and active sibling schema invariants', async () => {
    const sourceColumns = await pool.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='paper_project_sources' ORDER BY column_name`);
    expect(sourceColumns.rows.map((row) => row.column_name)).toContain('source_record_id');
    expect(sourceColumns.rows.map((row) => row.column_name)).toContain('document_version_id');
    expect(sourceColumns.rows.map((row) => row.column_name)).not.toContain('document_id');
    const indexes = await pool.query<{ indexname: string; indexdef: string }>(`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND indexname IN ('paper_outline_nodes_active_root_position_key','paper_outline_nodes_active_child_position_key') ORDER BY indexname`);
    expect(indexes.rows).toHaveLength(2);
    expect(indexes.rows.map((row) => row.indexdef).join('\n')).toMatch(/WHERE .*status.*active/iu);
  });

  it('enforces P4 source identities, owner foreign keys, and reusable archived positions', async () => {
    const userId = `p4-${randomUUID()}`;
    const project = await pool.query<{ id: string }>(`INSERT INTO paper_projects (user_id, profile) VALUES ($1, $2::jsonb) RETURNING id`, [userId, JSON.stringify({ schemaVersion: 1, researchIdea: 'P4 schema check', paperType: 'other', language: 'en' })]);
    const projectId = project.rows[0].id;
    await expect(pool.query(`INSERT INTO paper_project_sources (project_id,user_id,origin_class) VALUES ($1,$2,'USER_KNOWLEDGE')`, [projectId, userId])).rejects.toThrow();
    await expect(pool.query(`INSERT INTO paper_project_sources (project_id,user_id,source_record_id,origin_class) VALUES ($1,$2,$3,'USER_KNOWLEDGE')`, [projectId, userId, randomUUID()])).rejects.toThrow();
    const first = await pool.query<{ id: string }>(`INSERT INTO paper_outline_nodes (project_id,user_id,node_type,title,position) VALUES ($1,$2,'writing-unit','First',0) RETURNING id`, [projectId, userId]);
    await expect(pool.query(`INSERT INTO paper_outline_nodes (project_id,user_id,node_type,title,position) VALUES ($1,$2,'writing-unit','Duplicate',0)`, [projectId, userId])).rejects.toThrow();
    await pool.query(`UPDATE paper_outline_nodes SET status='archived' WHERE id=$1`, [first.rows[0].id]);
    await expect(pool.query(`INSERT INTO paper_outline_nodes (project_id,user_id,node_type,title,position) VALUES ($1,$2,'writing-unit','Replacement',0)`, [projectId, userId])).resolves.toMatchObject({ rowCount: 1 });
  });

  it('has the composite referenced unique keys required by the ownership foreign keys', async () => {
    const result = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN (
        'knowledge_source_records_id_user_id_key',
        'knowledge_documents_id_user_id_key',
        'knowledge_document_versions_id_user_id_key'
      ) ORDER BY indexname`,
    );
    expect(result.rows.map((row) => row.indexname)).toEqual([
      'knowledge_document_versions_id_user_id_key',
      'knowledge_documents_id_user_id_key',
      'knowledge_source_records_id_user_id_key',
    ]);
  });

  it('preserves the nullable source relation and sole external provenance storage', async () => {
    const columns = await pool.query<{ column_name: string; is_nullable: string }>(
      `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'knowledge_documents' AND column_name = 'source_record_id'`,
    );
    expect(columns.rows).toEqual([{ column_name: 'source_record_id', is_nullable: 'YES' }]);

    const sourceColumns = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'knowledge_source_records' AND column_name = 'external_provenance'`,
    );
    expect(sourceColumns.rows).toEqual([]);
  });

  it('rolls back a failed transaction on real PostgreSQL', async () => {
    const db = drizzle(pool, { schema: { knowledgeDocuments } });
    await expect(db.transaction(async (tx) => {
      await tx.insert(knowledgeDocuments).values({ userId: 'rollback-test', originKind: 'user-upload', displayName: 'rollback', sourceType: 'txt', lifecycleStatus: 'active' });
      throw new Error('forced rollback');
    })).rejects.toThrow('forced rollback');
    await expect(db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.userId, 'rollback-test'))).resolves.toEqual([]);
  });

  async function seedVersion(repository: KnowledgeRepository, userId: string) {
    const document = await repository.createDocument({ userId, originKind: 'user-upload', displayName: 'Versioned', sourceType: 'txt' });
    const previous = await repository.createVersion({
      userId, documentId: document.id, versionNumber: 1, originalContentHash: hashTextInputExact('previous'),
      parserProfile: { name: 'c1-document-parser-v1', version: '1' },
      chunkingProfile: { name: 'c3-deterministic-v1', version: '1', parameters: { maxSize: 100 } },
      sourceText: 'previous', lifecycleStatus: 'active', readinessStatus: 'content-ready-for-indexing', indexInputFingerprint: hashTextInputExact('previous-derivation'),
    });
    const previousChunk = finalizeKnowledgeChunkDraft({
      draft: {
        userId, documentVersionId: previous.id, ordinal: 0, text: 'previous', textHash: hashTextInputExact('previous'),
        provenance: { documentId: document.id, documentVersionId: previous.id, sourceBlockId: 'old-block', sourceBlockIndex: 0, section: 'content', headingPath: [], sourceUnitId: 'old-unit', sourceChunkOrdinal: 0, itemOrdinal: 0 },
        citationLocator: { documentVersionId: previous.id, section: 'content', sourceBlockId: 'old-block', sourceBlockIndex: 0 },
      },
      chunkId: randomUUID(),
    });
    await repository.createChunks([previousChunk]);
    await repository.activateVersion(userId, document.id, previous.id);
    return { document, previous, previousChunk };
  }

  function createService(repository: KnowledgeRepositoryPort) {
    return new KnowledgeService(
      repository,
      { parse: jest.fn().mockResolvedValue(parsed) },
      { buildStructural: jest.fn().mockReturnValue(structural) },
      { chunkStructural: jest.fn().mockReturnValue(chunked) },
      { readVerified: jest.fn() },
    );
  }

  function repositoryWithFailure(repository: KnowledgeRepository, failure: 'chunks' | 'activate'): KnowledgeRepositoryPort {
    const root = Object.create(repository) as KnowledgeRepositoryPort;
    root.withTransaction = (work) => repository.withTransaction(async (transaction) => {
      const scoped = Object.create(transaction) as KnowledgeRepositoryPort;
      if (failure === 'chunks') scoped.createChunks = jest.fn().mockRejectedValue(new Error('forced chunk persistence failure'));
      if (failure === 'activate') scoped.activateVersion = jest.fn().mockRejectedValue(new Error('forced active-version failure'));
      return work(scoped);
    });
    return root;
  }

  async function createNextVersion(service: KnowledgeService, userId: string, documentId: string) {
    return service.createNextVersion({
      userId, documentId, idempotencyKey: randomUUID(), displayName: 'Versioned', originKind: 'user-upload',
      input: { kind: 'text', text: 'changed text', fileName: 'input.txt' }, chunkingPolicy: { maxSize: 100 },
    });
  }

  it('rolls back the created version when real PostgreSQL chunk persistence fails', async () => {
    const repository = new KnowledgeRepository(drizzle(pool));
    const userId = `chunk-failure-${randomUUID()}`;
    const seeded = await seedVersion(repository, userId);
    await expect(createNextVersion(createService(repositoryWithFailure(repository, 'chunks')), userId, seeded.document.id)).rejects.toThrow('forced chunk persistence failure');
    await expect(repository.getLatestVersion(userId, seeded.document.id)).resolves.toMatchObject({ id: seeded.previous.id });
    await expect(repository.getChunks(userId, seeded.previous.id)).resolves.toEqual([seeded.previousChunk]);
  });

  it('rolls back version and chunks when real PostgreSQL activation fails', async () => {
    const repository = new KnowledgeRepository(drizzle(pool));
    const userId = `activate-failure-${randomUUID()}`;
    const seeded = await seedVersion(repository, userId);
    await expect(createNextVersion(createService(repositoryWithFailure(repository, 'activate')), userId, seeded.document.id)).rejects.toThrow('forced active-version failure');
    await expect(repository.getLatestVersion(userId, seeded.document.id)).resolves.toMatchObject({ id: seeded.previous.id });
    await expect(repository.getChunks(userId, seeded.previous.id)).resolves.toEqual([seeded.previousChunk]);
  });

  it('activates the actual new version and leaves the previous version immutable', async () => {
    const repository = new KnowledgeRepository(drizzle(pool));
    const userId = `success-version-${randomUUID()}`;
    const seeded = await seedVersion(repository, userId);
    const result = await createNextVersion(createService(repository), userId, seeded.document.id);
    expect(result.version.id).not.toBe(seeded.previous.id);
    expect(result.version.versionNumber).toBe(2);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].documentVersionId).toBe(result.version.id);
    await expect(repository.getDocument(userId, seeded.document.id)).resolves.toMatchObject({ activeVersionId: result.version.id });
    await expect(repository.getVersion(userId, seeded.previous.id)).resolves.toMatchObject({ id: seeded.previous.id, versionNumber: 1, sourceText: 'previous' });
    await expect(repository.getChunks(userId, seeded.previous.id)).resolves.toEqual([seeded.previousChunk]);
  });
});

describeIfDatabase('controlled migration vector prerequisite', () => {
  let fixture: P3PostgresRoleFixture;

  beforeAll(async () => {
    fixture = await createP3PostgresRoleFixture({ installVector: false });
  });

  afterAll(async () => {
    await fixture.close();
  });

  it('fails closed without vector and records no completed migration', async () => {
    const migrationEnvironment = {
      NODE_ENV: 'production',
      MIGRATION_DATABASE_URL: fixture.migratorUrl,
      DATABASE_SSL: 'require',
      ...(fixture.caFile ? { DATABASE_SSL_CA_FILE: fixture.caFile } : {}),
    };
    await expect(
      runMigrations({ pool: new Pool(createMigrationPoolConfig(migrationEnvironment)) }),
    ).rejects.toThrow();

    const adminPool = new Pool(createStandardPostgresConfig({
      NODE_ENV: 'production',
      DATABASE_URL: fixture.adminUrl,
      DATABASE_SSL: 'require',
      ...(fixture.caFile ? { DATABASE_SSL_CA_FILE: fixture.caFile } : {}),
    }));
    const migrations = await adminPool.query<{ count: string }>(
      'SELECT count(*) FROM drizzle.__drizzle_migrations',
    );
    const tables = await adminPool.query<{ count: string }>(
      "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'",
    );
    expect(migrations.rows[0].count).toBe('0');
    expect(tables.rows[0].count).toBe('0');
    await adminPool.end();
  });
});
