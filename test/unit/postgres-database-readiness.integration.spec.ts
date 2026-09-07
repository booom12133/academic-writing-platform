import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

import { checkDatabaseReadiness } from '../../server/database/database-readiness';

const databaseUrl = process.env.DATABASE_URL;
const describeIfDatabase = databaseUrl ? describe : describe.skip;

describeIfDatabase('standard PostgreSQL readiness', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await migrate(drizzle(pool), { migrationsFolder: 'drizzle/migrations' });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('accepts the migrated PostgreSQL + pgvector schema', async () => {
    await expect(checkDatabaseReadiness(drizzle(pool) as never)).resolves.toEqual({
      ready: true,
    });
  });
});
