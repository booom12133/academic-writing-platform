import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Pool, type PoolConfig } from 'pg';

const projectRoot = resolve(__dirname, '..', '..');
const canonicalGrantsPath = resolve(
  projectRoot,
  'deploy',
  'postgres',
  'production-role-grants.sql',
);

const OWNER_ROLE = 'academic_writing_db_owner';
const MIGRATOR_ROLE = 'academic_writing_migrator';
const APP_ROLE = 'academic_writing_app';

export interface P3PostgresRoleFixture {
  adminUrl: string;
  migratorUrl: string;
  appUrl: string;
  caFile?: string;
  databaseName: string;
  applyCanonicalGrants(): Promise<void>;
  close(): Promise<void>;
}

interface P3PostgresRoleFixtureOptions {
  adminUrl?: string;
  caFile?: string;
  installVector?: boolean;
}

function poolConfig(connectionString: string, caFile?: string): PoolConfig {
  return {
    connectionString,
    ...(caFile
      ? {
          ssl: {
            ca: readFileSync(caFile, 'utf8'),
            rejectUnauthorized: true,
          },
        }
      : {}),
  };
}

function databaseUrl(source: string, databaseName: string): string {
  const url = new URL(source);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function roleUrl(source: string, databaseName: string, role: string, password: string): string {
  const url = new URL(databaseUrl(source, databaseName));
  url.username = role;
  url.password = password;
  return url.toString();
}

async function quotedLiteral(pool: Pool, value: string): Promise<string> {
  const result = await pool.query<{ literal: string }>(
    'SELECT quote_literal($1) AS literal',
    [value],
  );
  return result.rows[0].literal;
}

export async function createP3PostgresRoleFixture(
  options: P3PostgresRoleFixtureOptions = {},
): Promise<P3PostgresRoleFixture> {
  const sourceAdminUrl = options.adminUrl ?? process.env.P3_POSTGRES_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!sourceAdminUrl) {
    throw new Error('P3_POSTGRES_ADMIN_URL or DATABASE_URL is required.');
  }

  const caFile = options.caFile ?? process.env.DATABASE_SSL_CA_FILE ?? process.env.PGSSLROOTCERT;
  const databaseName = `p3_roles_${randomUUID().replaceAll('-', '')}`;
  const maintenanceUrl = databaseUrl(sourceAdminUrl, 'postgres');
  const targetAdminUrl = databaseUrl(sourceAdminUrl, databaseName);
  const migratorPassword = `p3-ci-migrator-${randomUUID()}`;
  const appPassword = `p3-ci-app-${randomUUID()}`;
  const maintenancePool = new Pool(poolConfig(maintenanceUrl, caFile));

  await maintenancePool.query(`CREATE DATABASE "${databaseName}"`);
  await maintenancePool.end();

  const targetPool = new Pool(poolConfig(targetAdminUrl, caFile));
  const canonicalSql = readFileSync(canonicalGrantsPath, 'utf8');

  async function applyCanonicalGrants(): Promise<void> {
    await targetPool.query(canonicalSql);
  }

  try {
    await applyCanonicalGrants();
    if (options.installVector !== false) {
      await targetPool.query('CREATE EXTENSION IF NOT EXISTS vector');
    }
    const migratorLiteral = await quotedLiteral(targetPool, migratorPassword);
    const appLiteral = await quotedLiteral(targetPool, appPassword);
    await targetPool.query(`ALTER ROLE ${MIGRATOR_ROLE} PASSWORD ${migratorLiteral}`);
    await targetPool.query(`ALTER ROLE ${APP_ROLE} PASSWORD ${appLiteral}`);
  } catch (error) {
    await targetPool.end();
    throw error;
  }

  return {
    adminUrl: targetAdminUrl,
    migratorUrl: roleUrl(sourceAdminUrl, databaseName, MIGRATOR_ROLE, migratorPassword),
    appUrl: roleUrl(sourceAdminUrl, databaseName, APP_ROLE, appPassword),
    caFile,
    databaseName,
    applyCanonicalGrants,
    async close(): Promise<void> {
      await targetPool.end();
      const cleanupPool = new Pool(poolConfig(maintenanceUrl, caFile));
      try {
        await cleanupPool.query(
          'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
          [databaseName],
        );
        await cleanupPool.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
        await cleanupPool.query(`DROP ROLE IF EXISTS ${APP_ROLE}`);
        await cleanupPool.query(`DROP ROLE IF EXISTS ${MIGRATOR_ROLE}`);
        await cleanupPool.query(`DROP ROLE IF EXISTS ${OWNER_ROLE}`);
      } finally {
        await cleanupPool.end();
      }
    },
  };
}
