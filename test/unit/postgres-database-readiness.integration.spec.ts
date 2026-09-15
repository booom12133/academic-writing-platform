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
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  createVerificationPoolConfig,
  verifyProductionDatabase,
} = require(
  process.env.P3_PRODUCTION_DATABASE_VERIFY_SCRIPT ??
    '../../scripts/verify-production-database.js'
);

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

  it('runs the shipped verifier without writes and fails closed for invalid privileges', async () => {
    const verifierEnvironment = (databaseUrl: string) => ({
      NODE_ENV: 'production',
      DATABASE_URL: databaseUrl,
      ...(fixture.caFile ? { DATABASE_SSL_CA_FILE: fixture.caFile } : {}),
    });
    const adminPool = new Pool(createMigrationPoolConfig({
      NODE_ENV: 'test',
      DATABASE_URL: fixture.adminUrl,
      DATABASE_SSL: 'require',
      ...(fixture.caFile ? { DATABASE_SSL_CA_FILE: fixture.caFile } : {}),
    }));
    const snapshot = async () =>
      adminPool.query(`
        SELECT
          (SELECT count(*) FROM drizzle.__drizzle_migrations) AS migrations,
          (SELECT count(*) FROM information_schema.tables
            WHERE table_schema IN ('public', 'drizzle')) AS tables,
          (SELECT count(*) FROM pg_catalog.pg_class AS c
            JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
            WHERE n.nspname IN ('public', 'drizzle')) AS objects
      `);

    try {
      const before = (await snapshot()).rows[0];
      await expect(
        verifyProductionDatabase({
          pool: new Pool(createVerificationPoolConfig(verifierEnvironment(fixture.appUrl))),
        }),
      ).resolves.toBeUndefined();
      expect((await snapshot()).rows[0]).toEqual(before);

      await expect(
        verifyProductionDatabase({
          pool: new Pool(createVerificationPoolConfig(verifierEnvironment(fixture.migratorUrl))),
        }),
      ).rejects.toMatchObject({ reasonCode: 'ROLE_MISMATCH' });

      await adminPool.query('REVOKE SELECT ON ALL TABLES IN SCHEMA public, drizzle FROM academic_writing_app');
      await expect(
        verifyProductionDatabase({
          pool: new Pool(createVerificationPoolConfig(verifierEnvironment(fixture.appUrl))),
        }),
      ).rejects.toMatchObject({ reasonCode: 'VERIFICATION_QUERY_FAILED' });
    } finally {
      await fixture.applyCanonicalGrants();
      await adminPool.end();
    }
  });
});
