'use strict';

const fs = require('node:fs');
const { Client } = require('pg');
const {
  assertZoteroRotationAllowed,
  createRotationPlan,
  parseEnvFile,
} = require('./rotation-contract.js');

const ROLE_BY_ENV_KEY = {
  DATABASE_URL: 'academic_writing_app',
  MIGRATION_DATABASE_URL: 'academic_writing_migrator',
};

function readDatabaseCa(env) {
  const caFile = (env.DATABASE_SSL_CA_FILE || '').trim();
  if (caFile) return fs.readFileSync(caFile, 'utf8');
  if (env.DATABASE_SSL_CA) return env.DATABASE_SSL_CA;
  throw new Error('trusted database CA is required');
}

function clientConfig(connectionString, env) {
  return {
    connectionString,
    ssl: { ca: readDatabaseCa(env), rejectUnauthorized: true },
    connectionTimeoutMillis: 10_000,
  };
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function connectionPassword(connectionString) {
  return decodeURIComponent(new URL(connectionString).password);
}

async function rotateRoles({ adminClient, plan, env }) {
  const roleEntries = Object.entries(ROLE_BY_ENV_KEY)
    .filter(([key]) => plan.rolesToRotate.includes(ROLE_BY_ENV_KEY[key]));
  if (roleEntries.length === 0) return;

  const expectedRoles = roleEntries.map(([, role]) => role);
  const roleResult = await adminClient.query(
    'SELECT rolname FROM pg_catalog.pg_roles WHERE rolname = ANY($1::text[])',
    [expectedRoles],
  );
  const existingRoles = new Set(roleResult.rows.map((row) => row.rolname));
  if (expectedRoles.some((role) => !existingRoles.has(role))) {
    throw new Error('required PostgreSQL role is missing; no role may be created');
  }

  await adminClient.query('BEGIN');
  try {
    for (const [key, role] of roleEntries) {
      const literalResult = await adminClient.query(
        'SELECT quote_literal($1) AS literal',
        [connectionPassword(env[key])],
      );
      await adminClient.query(
        `ALTER ROLE ${quoteIdentifier(role)} PASSWORD ${literalResult.rows[0].literal}`,
      );
    }
    await adminClient.query('COMMIT');
  } catch (error) {
    await adminClient.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

async function checkConnectivity(key, expectedRole, env) {
  const client = new Client(clientConfig(env[key], env));
  try {
    await client.connect();
    const result = await client.query('SELECT current_user AS current_user');
    if (result.rows[0]?.current_user !== expectedRole) {
      throw new Error(`${key} connected as an unexpected role`);
    }
    process.stdout.write(`role=${expectedRole} connectivity=success\n`);
  } catch {
    process.stdout.write(`role=${expectedRole} connectivity=failure\n`);
    throw new Error('new database credential connectivity validation failed');
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  const [, , currentEnvPath, mode] = process.argv;
  if (!currentEnvPath || !mode) throw new Error('rotation helper arguments are invalid');
  const currentEnv = parseEnvFile(currentEnvPath);
  const plan = createRotationPlan({ mode, currentEnv, candidateEnv: process.env });
  const adminUrl = process.env.P3_DB_ADMIN_URL || '';
  const adminPassword = process.env.P3_DB_ADMIN_PASSWORD || '';
  const needsAdmin = plan.rolesToRotate.length > 0 || plan.zoteroKeyChanged;
  if (needsAdmin) {
    if (!adminUrl || !adminPassword) {
      throw new Error('interactive PostgreSQL administrative credentials are required');
    }
    const parsedAdminUrl = new URL(adminUrl);
    if (parsedAdminUrl.password) {
      throw new Error('P3_DB_ADMIN_URL must not contain a password');
    }
    const adminClient = new Client({
      ...clientConfig(adminUrl, process.env),
      password: adminPassword,
    });
    try {
      await adminClient.connect();
      if (plan.zoteroKeyChanged) {
        let count = null;
        try {
          const result = await adminClient.query(
            'SELECT count(*)::int AS count FROM zotero_connections',
          );
          count = result.rows[0]?.count;
        } catch {
          count = null;
        }
        assertZoteroRotationAllowed({
          keyChanged: true,
          databaseCheckSucceeded: count !== null,
          encryptedCredentialCount: count,
        });
      }
      await rotateRoles({ adminClient, plan, env: process.env });
    } finally {
      await adminClient.end().catch(() => undefined);
    }
  }

  for (const [key, role] of Object.entries(ROLE_BY_ENV_KEY)) {
    await checkConnectivity(key, role, process.env);
  }
  for (const role of plan.rolesToRotate) {
    process.stdout.write(`role=${role} rotation=success\n`);
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'database credential rotation failed'}\n`,
  );
  process.exitCode = 1;
});
