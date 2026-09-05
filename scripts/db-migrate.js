const path = require('node:path');
const { drizzle } = require('drizzle-orm/node-postgres');
const { migrate } = require('drizzle-orm/node-postgres/migrator');
const { Pool } = require('pg');

const MIGRATION_LOCK_KEY = 318104001;
const MIGRATIONS_FOLDER = path.resolve(__dirname, '..', 'drizzle', 'migrations');

function boundedInteger(env, name, fallback, minimum, maximum) {
  const raw = env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function createMigrationPoolConfig(env = process.env) {
  const connectionString = env.DATABASE_URL && env.DATABASE_URL.trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to apply standard PostgreSQL migrations.');
  }
  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('DATABASE_URL must use a PostgreSQL connection URL.');
  }
  const production = env.NODE_ENV === 'production';
  if (production && env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false') {
    throw new Error('DATABASE_SSL_REJECT_UNAUTHORIZED cannot be false in production.');
  }
  if (production && env.DATABASE_SSL === 'disable') {
    throw new Error('DATABASE_SSL cannot disable TLS in production.');
  }
  const sslRequired = production || env.DATABASE_SSL === 'require';
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
          ...(env.DATABASE_SSL_CA ? { ca: env.DATABASE_SSL_CA } : {}),
        }
      : undefined,
  };
}

function createMigrationPool(env = process.env) {
  return new Pool(createMigrationPoolConfig(env));
}

async function runMigrations({
  pool = createMigrationPool(),
  drizzleFn = drizzle,
  migrateFn = migrate,
} = {}) {
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    locked = true;
    const db = drizzleFn(client);
    await migrateFn(db, {
      migrationsFolder: MIGRATIONS_FOLDER,
      migrationsSchema: 'drizzle',
      migrationsTable: '__drizzle_migrations',
    });
  } finally {
    if (locked) {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    }
    client.release();
    await pool.end();
  }
}

module.exports = {
  MIGRATION_LOCK_KEY,
  MIGRATIONS_FOLDER,
  createMigrationPool,
  createMigrationPoolConfig,
  runMigrations,
};

if (require.main === module) {
  runMigrations()
    .then(() => {
      process.stdout.write('Standard PostgreSQL migrations applied.\n');
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
