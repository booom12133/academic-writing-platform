'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const {
  assertZoteroRotationAllowed,
  createRotationPlan,
  parseEnvFile,
} = require('./rotation-contract.js');

const ROLE_BY_ENV_KEY = {
  DATABASE_URL: 'academic_writing_app',
  MIGRATION_DATABASE_URL: 'academic_writing_migrator',
};

function lstatOrFail(targetPath, description) {
  let stats;
  try {
    stats = fs.lstatSync(targetPath);
  } catch {
    throw new Error(`${description} is missing or unavailable`);
  }
  if (stats.isSymbolicLink()) {
    throw new Error(`${description} must not be a symlink`);
  }
  return stats;
}

function validateAppRoot(appRoot) {
  if (!appRoot || !path.isAbsolute(appRoot)) {
    throw new Error('rotation app root must be an absolute path');
  }

  const appRootStats = lstatOrFail(appRoot, 'rotation app root');
  if (!appRootStats.isDirectory()) {
    throw new Error('rotation app root must be a directory');
  }

  const packagePath = path.join(appRoot, 'package.json');
  const packageStats = lstatOrFail(packagePath, 'rotation app package.json');
  if (!packageStats.isFile()) {
    throw new Error('rotation app package.json must be a regular file');
  }

  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch {
    throw new Error('rotation app package.json is invalid');
  }
  if (
    !packageJson ||
    typeof packageJson !== 'object' ||
    typeof packageJson.dependencies?.pg !== 'string'
  ) {
    throw new Error('rotation app package.json must declare pg');
  }

  const nodeModulesRoot = path.join(appRoot, 'node_modules');
  const nodeModulesStats = lstatOrFail(
    nodeModulesRoot,
    'rotation app node_modules',
  );
  if (!nodeModulesStats.isDirectory()) {
    throw new Error('rotation app node_modules must be a directory');
  }

  return { packagePath, nodeModulesRoot };
}

function isWithinRoot(root, target) {
  const relativePath = path.relative(root, target);
  return (
    relativePath !== '' &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

function loadPgClient(appRoot) {
  const { packagePath, nodeModulesRoot } = validateAppRoot(appRoot);
  const appRequire = createRequire(packagePath);
  let resolvedPgPath;
  try {
    resolvedPgPath = appRequire.resolve('pg');
  } catch {
    throw new Error('rotation app pg dependency is unavailable');
  }
  let resolvedPgRealPath;
  let nodeModulesRealPath;
  try {
    resolvedPgRealPath = fs.realpathSync.native(resolvedPgPath);
    nodeModulesRealPath = fs.realpathSync.native(nodeModulesRoot);
  } catch {
    throw new Error('rotation app pg dependency path is unavailable');
  }
  if (!isWithinRoot(nodeModulesRealPath, resolvedPgRealPath)) {
    throw new Error('rotation app pg dependency resolved outside app node_modules');
  }

  let pg;
  try {
    pg = appRequire('pg');
  } catch {
    throw new Error('rotation app pg dependency could not be loaded');
  }
  if (!pg || typeof pg.Client !== 'function') {
    throw new Error('rotation app pg dependency has no Client');
  }
  return pg.Client;
}

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

async function checkConnectivity(key, expectedRole, env, Client) {
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
  const [, , currentEnvPath, mode, appRoot] = process.argv;
  if (!currentEnvPath || !mode || !appRoot) {
    throw new Error('rotation helper arguments are invalid');
  }
  const Client = loadPgClient(appRoot);
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
    await checkConnectivity(key, role, process.env, Client);
  }
  for (const role of plan.rolesToRotate) {
    process.stdout.write(`role=${role} rotation=success\n`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'database credential rotation failed'}\n`,
    );
    process.exitCode = 1;
  });
}

module.exports = { loadPgClient, validateAppRoot };
