import { createLocalDevelopmentDatabase } from '../../server/database/local-development.database';
import { sql } from 'drizzle-orm';

describe('E4 local database compatibility', () => {
  it('keeps legacy documents nullable while enforcing user-scoped external identity uniqueness', async () => {
    const local = await createLocalDevelopmentDatabase();
    try {
      const columns = await local.db.execute(sql`
        SELECT DISTINCT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'knowledge_documents'
          AND column_name IN ('external_identity', 'external_version', 'external_checksum_algorithm', 'external_checksum')
        ORDER BY column_name
      `);
      expect(columns.rows).toHaveLength(4);
      const legacy = await local.db.insert((await import('../../server/database/schema')).knowledgeDocuments).values({
        userId: 'legacy-user', originKind: 'user-upload', displayName: 'legacy', sourceType: 'txt', lifecycleStatus: 'active',
      }).returning();
      expect(legacy[0].externalIdentity).toBeNull();

      const table = await local.db.execute(sql`
        SELECT table_name FROM information_schema.tables WHERE table_name = 'zotero_connections'
      `);
      expect(table.rows.length).toBeGreaterThan(0);
    } finally {
      await local.close();
    }
  });
});
