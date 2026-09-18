import { readFileSync } from 'node:fs';

import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema';
import { DRIZZLE_DATABASE, type AppDatabase } from './database.types';
import { assertNoProductionPostgresSslQueryParameters } from '../config/config-validation';

export interface StandardPostgresConfig extends PoolConfig {
  connectionString: string;
}

function parseBoundedInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function readDatabaseCa(env: NodeJS.ProcessEnv): string | undefined {
  const caFile = env.DATABASE_SSL_CA_FILE?.trim();
  if (caFile) {
    try {
      const ca = readFileSync(caFile, 'utf8');
      if (!ca.trim()) throw new Error('empty CA file');
      return ca;
    } catch {
      throw new Error('DATABASE_SSL_CA_FILE must be a readable non-empty PEM file.');
    }
  }
  return env.DATABASE_SSL_CA;
}

export function createStandardPostgresConfig(
  env: NodeJS.ProcessEnv = process.env,
): StandardPostgresConfig {
  const connectionString = env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for the standard PostgreSQL provider.');
  }

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use a PostgreSQL connection URL.');
  }
  if (!parsed.hostname) {
    throw new Error('DATABASE_URL must include a PostgreSQL host.');
  }

  const isProduction = env.NODE_ENV === 'production';
  if (isProduction) {
    assertNoProductionPostgresSslQueryParameters(connectionString, 'DATABASE_URL');
  }
  if (isProduction && env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false') {
    throw new Error('DATABASE_SSL_REJECT_UNAUTHORIZED cannot be false in production.');
  }
  if (isProduction && env.DATABASE_SSL === 'disable') {
    throw new Error('DATABASE_SSL cannot disable TLS in production.');
  }

  const sslRequired = isProduction || env.DATABASE_SSL === 'require';
  const ca = readDatabaseCa(env);
  const ssl = sslRequired
    ? {
        rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
        ...(ca ? { ca } : {}),
      }
    : undefined;

  return {
    connectionString,
    max: parseBoundedInteger(env, 'DATABASE_POOL_MAX', 5, 1, 20),
    idleTimeoutMillis: parseBoundedInteger(
      env,
      'DATABASE_IDLE_TIMEOUT_MS',
      10_000,
      1_000,
      120_000,
    ),
    connectionTimeoutMillis: parseBoundedInteger(
      env,
      'DATABASE_CONNECTION_TIMEOUT_MS',
      5_000,
      100,
      30_000,
    ),
    ssl,
  };
}

export interface StandardPostgresDatabase {
  db: AppDatabase;
  pool: Pool;
}

export function createStandardPostgresDatabase(
  env: NodeJS.ProcessEnv = process.env,
): StandardPostgresDatabase {
  const pool = new Pool(createStandardPostgresConfig(env));
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export async function closeStandardPostgresPool(pool: Pick<Pool, 'end'>): Promise<void> {
  await pool.end();
}

export const STANDARD_POSTGRES_DATABASE = Symbol('STANDARD_POSTGRES_DATABASE');

class StandardPostgresDatabaseLifecycle implements OnApplicationShutdown {
  constructor(
    @Inject(STANDARD_POSTGRES_DATABASE)
    private readonly database: StandardPostgresDatabase,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await closeStandardPostgresPool(this.database.pool);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: STANDARD_POSTGRES_DATABASE,
      useFactory: () => createStandardPostgresDatabase(),
    },
    {
      provide: DRIZZLE_DATABASE,
      useFactory: (database: StandardPostgresDatabase) => database.db,
      inject: [STANDARD_POSTGRES_DATABASE],
    },
    {
      provide: StandardPostgresDatabaseLifecycle,
      useFactory: (database: StandardPostgresDatabase) =>
        new StandardPostgresDatabaseLifecycle(database),
      inject: [STANDARD_POSTGRES_DATABASE],
    },
  ],
  exports: [DRIZZLE_DATABASE],
})
export class StandardPostgresDatabaseModule {}
