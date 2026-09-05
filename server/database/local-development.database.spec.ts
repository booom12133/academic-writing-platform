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
});
