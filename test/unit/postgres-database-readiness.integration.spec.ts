import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { checkDatabaseReadiness } from '../../server/database/database-readiness';
import { createStandardPostgresConfig } from '../../server/database/standard-postgres.module';
import {
  createP3PostgresRoleFixture,
  type P3PostgresRoleFixture,
} from '../support/p3-postgres-role-fixture';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createMigrationPoolConfig, runMigrations } = require('../../scripts/db-migrate.js');

const roleIntegrationEnabled = process.env.P3_POSTGRES_ROLE_INTEGRATION === 'YES';
const describeIfDatabase = roleIntegrationEnabled ? describe : describe.skip;

describeIfDatabase('standard PostgreSQL readiness', () => {
  let pool: Pool;
  let fixture: P3PostgresRoleFixture;

  beforeAll(async () => {
    fixture = await createP3PostgresRoleFixture();
    const migrationEnvironment = {
      NODE_ENV: 'production',
      MIGRATION_DATABASE_URL: fixture.migratorUrl,
      DATABASE_SSL: 'require',
      ...(fixture.caFile ? { DATABASE_SSL_CA_FILE: fixture.caFile } : {}),
    };
    await runMigrations({ pool: new Pool(createMigrationPoolConfig(migrationEnvironment)) });
    await fixture.applyCanonicalGrants();
    pool = new Pool(createStandardPostgresConfig({
      NODE_ENV: 'production',
      DATABASE_URL: fixture.appUrl,
      DATABASE_SSL: 'require',
      ...(fixture.caFile ? { DATABASE_SSL_CA_FILE: fixture.caFile } : {}),
    }));
  });

  afterAll(async () => {
    await pool.end();
    await fixture.close();
  });

  it('accepts the migrated PostgreSQL + pgvector schema', async () => {
    await expect(checkDatabaseReadiness(drizzle(pool) as never)).resolves.toEqual({
      ready: true,
    });
  });

  it('runs readiness as the app role without DDL privileges', async () => {
    await expect(pool.query('SELECT current_user AS current_user')).resolves.toMatchObject({
      rows: [{ current_user: 'academic_writing_app' }],
    });
    await expect(pool.query('CREATE TABLE readiness_forbidden (id integer)')).rejects.toThrow();
  });
});
