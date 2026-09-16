const path = require('node:path');
const fs = require('node:fs');
const { readMigrationFiles } = require('drizzle-orm/migrator');
const { Pool } = require('pg');

const MIGRATION_LOCK_KEY = 318104001;
const MIGRATIONS_FOLDER = path.resolve(__dirname, '..', 'drizzle', 'migrations');
const MIGRATION_ROLE = 'academic_writing_migrator';
const POSTGRES_SSL_QUERY_PARAMETERS = [
  'ssl',
  'sslmode',
  'sslcert',
  'sslkey',
  'sslrootcert',
];

function boundedInteger(env, name, fallback, minimum, maximum) {
  const raw = env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function readDatabaseCa(env) {
  const caFile = (env.DATABASE_SSL_CA_FILE || '').trim();
  if (caFile) {
    try {
      const ca = fs.readFileSync(caFile, 'utf8');
      if (!ca.trim()) throw new Error('empty CA file');
      return ca;
    } catch {
      throw new Error('DATABASE_SSL_CA_FILE must be a readable non-empty PEM file.');
    }
  }
  return env.DATABASE_SSL_CA;
}

function selectMigrationDatabaseUrl(env = process.env) {
  const migrationUrl = (env.MIGRATION_DATABASE_URL || '').trim();
  if (env.NODE_ENV === 'production') {
    if (!migrationUrl) {
      throw new Error('MIGRATION_DATABASE_URL is required in production.');
    }
    return { connectionString: migrationUrl, variableName: 'MIGRATION_DATABASE_URL' };
  }

  const databaseUrl = (env.DATABASE_URL || '').trim();
  const connectionString = migrationUrl || databaseUrl;
  if (!connectionString) {
    throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL is required to apply migrations.');
  }
  return {
    connectionString,
    variableName: migrationUrl ? 'MIGRATION_DATABASE_URL' : 'DATABASE_URL',
  };
}

function createMigrationPoolConfig(env = process.env) {
  const { connectionString, variableName } = selectMigrationDatabaseUrl(env);
  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL connection URL.`);
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error(`${variableName} must use a PostgreSQL connection URL.`);
  }
  const production = env.NODE_ENV === 'production';
  if (
    production &&
    POSTGRES_SSL_QUERY_PARAMETERS.some((parameter) =>
      parsed.searchParams.has(parameter),
    )
  ) {
    throw new Error(
      `${variableName} must not include PostgreSQL SSL query parameters in production.`,
    );
  }
  if (production && env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false') {
    throw new Error('DATABASE_SSL_REJECT_UNAUTHORIZED cannot be false in production.');
  }
  if (production && env.DATABASE_SSL === 'disable') {
    throw new Error('DATABASE_SSL cannot disable TLS in production.');
  }
  const sslRequired = production || env.DATABASE_SSL === 'require';
  const ca = readDatabaseCa(env);
  return {
    connectionString,
    max: boundedInteger(env, 'DATABASE_POOL_MAX', 5, 1, 20),
    idleTimeoutMillis: boundedInteger(env, 'DATABASE_IDLE_TIMEOUT_MS', 10_000, 1_000, 120_000),
    connectionTimeoutMillis: boundedInteger(
      env,
      'DATABASE_CONNECTION_TIMEOUT_MS',
      5_000,
      100,
      30_000,
    ),
    ssl: sslRequired
      ? {
          rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
          ...(ca ? { ca } : {}),
        }
      : undefined,
  };
}

function createMigrationPool(env = process.env) {
  return new Pool(createMigrationPoolConfig(env));
}

function postgresBoolean(value) {
  return value === true || value === 't' || value === 'true' || value === 1 || value === '1';
}

async function assertControlledMigrationPreconditions(
  client,
  { production = process.env.NODE_ENV === 'production' } = {},
) {
  const identity = await client.query('SELECT current_user AS current_user');
  if (production && identity.rows[0]?.current_user !== MIGRATION_ROLE) {
    throw new Error(`Production migrations require the ${MIGRATION_ROLE} migration role.`);
  }

  const schema = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'drizzle'
    ) AS schema_exists
  `);
  if (!postgresBoolean(schema.rows[0]?.schema_exists)) {
    throw new Error('The precreated drizzle schema is required before migration.');
  }

  const privileges = await client.query(`
    SELECT
      has_schema_privilege(current_user, 'drizzle', 'USAGE') AS has_usage,
      has_schema_privilege(current_user, 'drizzle', 'CREATE') AS has_create,
      has_database_privilege(current_user, current_database(), 'CREATE') AS has_database_create
  `);
  const row = privileges.rows[0];
  if (!postgresBoolean(row?.has_usage) || !postgresBoolean(row?.has_create)) {
    throw new Error('The migration role requires USAGE and CREATE on the precreated drizzle schema.');
  }
  if (postgresBoolean(row?.has_database_create)) {
    throw new Error('The migration role must not have database CREATE privilege.');
  }
}

async function applyPendingMigrations(client, migrations) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);
  const applied = await client.query(`
    SELECT id, hash, created_at
    FROM drizzle.__drizzle_migrations
    ORDER BY created_at DESC LIMIT 1
  `);
  const latest = applied.rows[0];

  await client.query('BEGIN');
  try {
    for (const migration of migrations) {
      if (!latest || Number(latest.created_at) < migration.folderMillis) {
        for (const statement of migration.sql) {
          await client.query(statement);
        }
        await client.query(
          'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
          [migration.hash, migration.folderMillis],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function runMigrations({
  pool = createMigrationPool(),
  readMigrationFilesFn = readMigrationFiles,
} = {}) {
  let client;
  let locked = false;
  try {
    client = await pool.connect();
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    locked = true;
    await assertControlledMigrationPreconditions(client);
    const migrations = readMigrationFilesFn({ migrationsFolder: MIGRATIONS_FOLDER });
    await applyPendingMigrations(client, migrations);
  } finally {
    try {
      if (client && locked) {
        await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
      }
    } finally {
      if (client) client.release();
      await pool.end();
    }
  }
}

function sanitizeMigrationError(error, env = process.env) {
  let message = error instanceof Error ? error.message : String(error);
  const sensitiveValues = new Set([
    env.MIGRATION_DATABASE_URL,
    env.DATABASE_URL,
    env.DATABASE_SSL_CA,
  ]);
  for (const candidate of [env.MIGRATION_DATABASE_URL, env.DATABASE_URL]) {
    if (!candidate) continue;
    try {
      const password = new URL(candidate).password;
      if (password) {
        sensitiveValues.add(password);
        sensitiveValues.add(decodeURIComponent(password));
      }
    } catch {
      // Invalid URLs are rejected before connection; redact their exact value below.
    }
  }
  for (const value of sensitiveValues) {
    if (value) message = message.replaceAll(value, '[REDACTED]');
  }
  return message;
}

module.exports = {
  MIGRATION_LOCK_KEY,
  MIGRATIONS_FOLDER,
  applyPendingMigrations,
  assertControlledMigrationPreconditions,
  createMigrationPool,
  createMigrationPoolConfig,
  runMigrations,
  sanitizeMigrationError,
  selectMigrationDatabaseUrl,
};

if (require.main === module) {
  runMigrations()
    .then(() => {
      process.stdout.write('Standard PostgreSQL migrations applied.\n');
    })
    .catch((error) => {
      process.stderr.write(`${sanitizeMigrationError(error)}\n`);
      process.exitCode = 1;
    });
}
