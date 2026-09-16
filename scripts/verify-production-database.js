'use strict';

const fs = require('node:fs');
const { Pool } = require('pg');

const APP_DATABASE_ROLE = 'academic_writing_app';
const REQUIRED_MIGRATION_COUNT = 4;
const REQUIRED_TABLE_NAMES = Object.freeze([
  'app_users',
  'tasks',
  'point_records',
  'recharge_orders',
  'knowledge_documents',
  'knowledge_document_versions',
  'knowledge_chunks',
  'knowledge_source_records',
  'knowledge_source_external_links',
  'knowledge_metadata_assertions',
  'knowledge_imports',
  'knowledge_embedding_indexes',
  'knowledge_chunk_embeddings',
  'zotero_connections',
]);
const VERIFICATION_QUERY_TIMEOUT_MS = 5_000;
const POSTGRES_SSL_QUERY_PARAMETERS = [
  'ssl',
  'sslmode',
  'sslcert',
  'sslkey',
  'sslrootcert',
];

class ProductionDatabaseVerificationError extends Error {
  constructor(reasonCode) {
    super(`Production database verification failed: ${reasonCode}.`);
    this.name = 'ProductionDatabaseVerificationError';
    this.reasonCode = reasonCode;
  }
}

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
  const ca = env.DATABASE_SSL_CA;
  if (!ca || !ca.trim()) {
    throw new Error('A readable non-empty PostgreSQL CA is required.');
  }
  return ca;
}

function createVerificationPoolConfig(env = process.env) {
  const connectionString = (env.DATABASE_URL || '').trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for production database verification.');
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
  if (env.NODE_ENV !== 'production') {
    throw new Error('Production database verification requires NODE_ENV=production.');
  }
  if (
    POSTGRES_SSL_QUERY_PARAMETERS.some((parameter) =>
      parsed.searchParams.has(parameter),
    )
  ) {
    throw new Error(
      'DATABASE_URL must not include PostgreSQL SSL query parameters in production.',
    );
  }
  if (env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false') {
    throw new Error('DATABASE_SSL_REJECT_UNAUTHORIZED cannot be false in production.');
  }

  return {
    connectionString,
    max: 1,
    idleTimeoutMillis: 1_000,
    connectionTimeoutMillis: boundedInteger(
      env,
      'DATABASE_CONNECTION_TIMEOUT_MS',
      5_000,
      100,
      30_000,
    ),
    ssl: {
      ca: readDatabaseCa(env),
      rejectUnauthorized: true,
    },
  };
}

function createVerificationPool(env = process.env) {
  return new Pool(createVerificationPoolConfig(env));
}

function postgresBoolean(value) {
  return value === true || value === 't' || value === 'true' || value === 1 || value === '1';
}

function asVerificationError(error, fallbackReasonCode) {
  if (error instanceof ProductionDatabaseVerificationError) return error;
  return new ProductionDatabaseVerificationError(fallbackReasonCode);
}

async function verifyProductionDatabase({ pool = createVerificationPool() } = {}) {
  let client;
  let transactionStarted = false;
  let failure;
  try {
    try {
      client = await pool.connect();
    } catch (error) {
      throw asVerificationError(error, 'DATABASE_CONNECTION_FAILED');
    }

    await client.query('BEGIN TRANSACTION READ ONLY');
    transactionStarted = true;
    await client.query("SELECT set_config('statement_timeout', $1, true)", [
      `${VERIFICATION_QUERY_TIMEOUT_MS}ms`,
    ]);

    let identity;
    let readiness;
    try {
      identity = await client.query('SELECT current_user AS current_user');
      if (identity.rows[0]?.current_user !== APP_DATABASE_ROLE) {
        throw new ProductionDatabaseVerificationError('ROLE_MISMATCH');
      }

      const requiredTableSql = REQUIRED_TABLE_NAMES.map((name) => `'${name}'`).join(', ');
      readiness = await client.query(`
        SELECT
          EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'vector'
          ) AS vector_extension,
          (
            SELECT count(*) FROM drizzle.__drizzle_migrations
          ) AS applied_migrations,
          COALESCE((
            SELECT array_agg(table_name::text ORDER BY table_name::text)
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN (${requiredTableSql})
          ), ARRAY[]::text[]) AS required_tables
      `);
    } catch (error) {
      throw asVerificationError(error, 'VERIFICATION_QUERY_FAILED');
    }

    const row = readiness.rows[0];
    if (!row || !postgresBoolean(row.vector_extension)) {
      throw new ProductionDatabaseVerificationError('VECTOR_EXTENSION_MISSING');
    }
    if (Number(row.applied_migrations) < REQUIRED_MIGRATION_COUNT) {
      throw new ProductionDatabaseVerificationError('MIGRATION_COUNT_MISMATCH');
    }
    const actualTables = Array.isArray(row.required_tables)
      ? [...row.required_tables].sort()
      : [];
    const expectedTables = [...REQUIRED_TABLE_NAMES].sort();
    if (
      actualTables.length !== expectedTables.length ||
      actualTables.some((name, index) => name !== expectedTables[index])
    ) {
      throw new ProductionDatabaseVerificationError('REQUIRED_TABLES_MISMATCH');
    }
  } catch (error) {
    failure = asVerificationError(error, 'VERIFICATION_QUERY_FAILED');
  } finally {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (error) {
        failure ||= asVerificationError(error, 'TRANSACTION_CLEANUP_FAILED');
      }
    }
    if (client) client.release();
    try {
      await pool.end();
    } catch (error) {
      failure ||= asVerificationError(error, 'POOL_CLOSE_FAILED');
    }
  }

  if (failure) throw failure;
}

function sanitizeVerificationError(error) {
  const reasonCode =
    error instanceof ProductionDatabaseVerificationError
      ? error.reasonCode
      : 'CONFIGURATION_INVALID';
  return `Production database verification failed: ${reasonCode}.`;
}

module.exports = {
  APP_DATABASE_ROLE,
  ProductionDatabaseVerificationError,
  REQUIRED_MIGRATION_COUNT,
  REQUIRED_TABLE_NAMES,
  VERIFICATION_QUERY_TIMEOUT_MS,
  createVerificationPool,
  createVerificationPoolConfig,
  sanitizeVerificationError,
  verifyProductionDatabase,
};

if (require.main === module) {
  verifyProductionDatabase()
    .then(() => {
      process.stdout.write('P3_PRODUCTION_DATABASE_VERIFICATION_PASS\n');
    })
    .catch((error) => {
      process.stderr.write(`${sanitizeVerificationError(error)}\n`);
      process.exitCode = 1;
    });
}
