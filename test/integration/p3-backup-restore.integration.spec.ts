import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createP3PostgresRoleFixture, type P3PostgresRoleFixture } from '../support/p3-postgres-role-fixture';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createBackupInvocation, runBackup } = require('../../scripts/db-backup.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { runRestoreVerify } = require('../../scripts/db-restore-verify.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertControlledMigrationPreconditions, runMigrations } = require('../../scripts/db-migrate.js');

const enabled = process.env.P3_POSTGRES_ROLE_INTEGRATION === 'YES';
const describeIfEnabled = enabled ? describe : describe.skip;

function connectionFor(source: string, database: string): string {
  const url = new URL(source);
  url.pathname = `/${database}`;
  return url.toString();
}

function verifiedPool(connectionString: string, caFile?: string): Pool {
  return new Pool({
    connectionString,
    ...(caFile ? { ssl: { ca: readFileSync(caFile, 'utf8'), rejectUnauthorized: true } } : {}),
  });
}

describeIfEnabled('P3 dedicated backup and isolated restore', () => {
  let fixture: P3PostgresRoleFixture;
  let maintenance: Pool;
  let recoveryName: string;
  const tempRoot = mkdtempSync(join(tmpdir(), 'p3-backup-integration-'));
  const tlsEnv = {
    ...process.env,
    PGSSLMODE: 'verify-full',
    PGSSLROOTCERT: '/etc/academic-writing-platform/postgres-ca.pem',
  };

  beforeAll(async () => {
    fixture = await createP3PostgresRoleFixture();
    const migrator = verifiedPool(fixture.migratorUrl, fixture.caFile);
    const migrationClient = await migrator.connect();
    try {
      await assertControlledMigrationPreconditions(migrationClient, { production: true });
    } finally {
      migrationClient.release();
    }
    await runMigrations({ pool: migrator });
    await fixture.applyCanonicalGrants();
    const app = verifiedPool(fixture.appUrl, fixture.caFile);
    await app.query("INSERT INTO app_users (user_id, username) VALUES ('p3-backup-user', 'Backup Fixture')");
    await app.end();
    recoveryName = `p3_recovery_${randomUUID().replaceAll('-', '')}`;
    maintenance = verifiedPool(connectionFor(fixture.adminUrl, 'postgres'), fixture.caFile);
    await maintenance.query(`CREATE DATABASE "${recoveryName}"`);
  });

  afterAll(async () => {
    if (maintenance) {
      await maintenance.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [recoveryName]);
      await maintenance.query(`DROP DATABASE IF EXISTS "${recoveryName}"`);
      await maintenance.end();
    }
    if (fixture) await fixture.close();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('denies app pg_dump, permits read-only backup, and verifies only an isolated restore', async () => {
    const appDump = createBackupInvocation({ databaseUrl: fixture.appUrl, outputPath: join(tempRoot, 'app.dump') });
    const appResult = spawnSync(appDump.command, appDump.args, { env: tlsEnv, encoding: 'utf8' });
    expect(appResult.status).not.toBe(0);

    const backupPath = join(tempRoot, 'backup.dump');
    const backupReceiptPath = join(tempRoot, 'backup.json');
    const backup = runBackup({
      outputPath: backupPath,
      evidencePath: backupReceiptPath,
      env: { ...tlsEnv, BACKUP_DATABASE_URL: fixture.backupUrl },
    });
    expect(backup.backupSizeBytes).toBeGreaterThan(0);

    const backupPool = verifiedPool(fixture.backupUrl, fixture.caFile);
    await expect(backupPool.query("INSERT INTO app_users (user_id) VALUES ('denied')")).rejects.toThrow();
    await expect(backupPool.query('CREATE TABLE backup_role_must_not_create(id int)')).rejects.toThrow();
    await backupPool.end();

    const restoreUrl = connectionFor(fixture.adminUrl, recoveryName);
    const restoreReceiptPath = join(tempRoot, 'restore.json');
    expect(runRestoreVerify({
      liveDatabaseUrl: fixture.appUrl,
      restoreDatabaseUrl: restoreUrl,
      restoreDatabaseNameConfirm: recoveryName,
      backupPath,
      evidencePath: restoreReceiptPath,
      confirmIsolatedRestore: true,
      env: tlsEnv,
    })).toEqual({ verified: true });

    const receipt = JSON.parse(readFileSync(restoreReceiptPath, 'utf8'));
    expect(receipt).toMatchObject({ isolatedTarget: true, migrationCount: 7, tableCount: 20 });
    const recovery = verifiedPool(restoreUrl, fixture.caFile);
    const restored = await recovery.query("SELECT count(*)::int AS count FROM app_users WHERE user_id = 'p3-backup-user'");
    expect(restored.rows[0].count).toBe(1);
    await recovery.end();
  });
});
