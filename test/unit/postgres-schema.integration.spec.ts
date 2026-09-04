import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { knowledgeDocuments } from '../../server/database/schema';

const databaseUrl = process.env.DATABASE_URL;
const describeIfDatabase = databaseUrl ? describe : describe.skip;

describeIfDatabase('standard PostgreSQL migrations', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await migrate(drizzle(pool), { migrationsFolder: 'drizzle/migrations' });
    await migrate(drizzle(pool), { migrationsFolder: 'drizzle/migrations' });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('applies the accepted baseline and E1 schema exactly once', async () => {
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
    );
    expect(result.rows.map((row) => row.table_name)).toEqual([
      'app_users', 'knowledge_chunks', 'knowledge_document_versions', 'knowledge_documents',
      'knowledge_imports', 'knowledge_metadata_assertions', 'knowledge_source_external_links',
      'knowledge_source_records', 'point_records', 'recharge_orders', 'tasks',
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
});
