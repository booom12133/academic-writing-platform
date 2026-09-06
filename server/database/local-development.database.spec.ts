import { sql } from 'drizzle-orm';
import {
  appUsers,
  knowledgeChunks,
  knowledgeDocuments,
  knowledgeDocumentVersions,
  knowledgeImports,
  knowledgeMetadataAssertions,
  knowledgeSourceExternalLinks,
  knowledgeSourceRecords,
} from './schema';
import { createLocalDevelopmentDatabase } from './local-development.database';

describe('createLocalDevelopmentDatabase', () => {
  it('creates the app user table for the existing task services', async () => {
    const local = await createLocalDevelopmentDatabase();

    try {
      await local.db.insert(appUsers).values({
        userId: 'database-test-user',
        points: 100,
      });
      const rows = await local.db.select().from(appUsers);

      expect(rows.some((row) => row.userId === 'database-test-user')).toBe(true);
    } finally {
      await local.close();
    }
  });

  it('creates the approved E1 tables without duplicating source provenance', async () => {
    const local = await createLocalDevelopmentDatabase();

    try {
      await expect(local.db.select().from(knowledgeSourceRecords).limit(0)).resolves.toEqual([]);
      await expect(local.db.select().from(knowledgeMetadataAssertions).limit(0)).resolves.toEqual([]);
      await expect(local.db.select().from(knowledgeSourceExternalLinks).limit(0)).resolves.toEqual([]);
      await expect(local.db.select().from(knowledgeDocuments).limit(0)).resolves.toEqual([]);
      await expect(local.db.select().from(knowledgeDocumentVersions).limit(0)).resolves.toEqual([]);
      await expect(local.db.select().from(knowledgeChunks).limit(0)).resolves.toEqual([]);
      await expect(local.db.select().from(knowledgeImports).limit(0)).resolves.toEqual([]);

      const columns = await local.db.execute(sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'knowledge_source_records'
      `);

      expect(columns.rows.map((row) => row.column_name)).not.toContain('external_provenance');
    } finally {
      await local.close();
    }
  });

  it('creates the E4 connection and generic external artifact state schema', async () => {
    const local = await createLocalDevelopmentDatabase();

    try {
      const connectionTable = await local.db.execute(sql`
        SELECT DISTINCT table_name
        FROM information_schema.tables
        WHERE table_name = 'zotero_connections'
      `);
      expect(connectionTable.rows).toEqual([{ table_name: 'zotero_connections' }]);

      const connectionColumns = await local.db.execute(sql`
        SELECT DISTINCT column_name
        FROM information_schema.columns
        WHERE table_name = 'zotero_connections'
        ORDER BY ordinal_position
      `);
      expect(connectionColumns.rows.map((row) => row.column_name)).toEqual([
        'id', 'user_id', 'library_type', 'library_id', 'ciphertext', 'nonce', 'auth_tag',
        'encryption_algorithm', 'encryption_key_version', 'key_fingerprint', 'status',
        'last_checked_at', 'last_seen_library_version', '_created_at', '_updated_at',
      ]);

      const documentColumns = await local.db.execute(sql`
        SELECT DISTINCT column_name
        FROM information_schema.columns
        WHERE table_name = 'knowledge_documents'
          AND column_name IN ('external_identity', 'external_version', 'external_checksum_algorithm', 'external_checksum')
        ORDER BY column_name
      `);
      expect(documentColumns.rows.map((row) => row.column_name)).toEqual([
        'external_checksum', 'external_checksum_algorithm', 'external_identity', 'external_version',
      ]);
    } finally {
      await local.close();
    }
  });
});
