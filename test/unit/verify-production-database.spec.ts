import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  REQUIRED_MIGRATION_COUNT as RUNTIME_REQUIRED_MIGRATION_COUNT,
  REQUIRED_TABLE_NAMES as RUNTIME_REQUIRED_TABLE_NAMES,
} from '../../server/database/database-readiness';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  APP_DATABASE_ROLE,
  REQUIRED_MIGRATION_COUNT,
  REQUIRED_TABLE_NAMES,
  createVerificationPoolConfig,
  sanitizeVerificationError,
  verifyProductionDatabase,
} = require('../../scripts/verify-production-database.js');

interface FakeClientOptions {
  currentUser?: string;
  vectorExtension?: boolean;
  appliedMigrations?: number;
  requiredTables?: readonly string[];
  failOn?: string;
}

function createClient(options: FakeClientOptions = {}) {
  return {
    query: jest.fn(async (text: string) => {
      if (options.failOn && text.includes(options.failOn)) {
        throw new Error('synthetic database sentinel-password query failure');
      }
      if (text.includes('current_user AS current_user')) {
        return {
          rows: [{ current_user: options.currentUser ?? 'academic_writing_app' }],
        };
      }
      if (text.includes('AS vector_extension')) {
        return {
          rows: [{
            vector_extension: options.vectorExtension ?? true,
            applied_migrations:
              options.appliedMigrations ?? RUNTIME_REQUIRED_MIGRATION_COUNT,
            required_tables:
              options.requiredTables ?? [...RUNTIME_REQUIRED_TABLE_NAMES].sort(),
          }],
        };
      }
      return { rows: [] };
    }),
    release: jest.fn(),
  };
}

function createPool(client: ReturnType<typeof createClient>) {
  return {
    connect: jest.fn().mockResolvedValue(client),
    end: jest.fn().mockResolvedValue(undefined),
  };
}

describe('pre-start production database verification', () => {
  it('uses only DATABASE_URL and requires verified production TLS with a readable CA', () => {
    const directory = mkdtempSync(join(tmpdir(), 'p3-db-verifier-'));
    const caFile = join(directory, 'postgres-ca.pem');
    const emptyCaFile = join(directory, 'empty.pem');
    writeFileSync(caFile, 'sentinel-ca-content');
    writeFileSync(emptyCaFile, '');

    try {
      expect(() =>
        createVerificationPoolConfig({
          NODE_ENV: 'production',
          MIGRATION_DATABASE_URL:
            'postgresql://migrator:sentinel-password@db.example/academic_writing?sslmode=verify-full',
          DATABASE_SSL_CA_FILE: caFile,
        }),
      ).toThrow(/DATABASE_URL is required/);

      expect(() =>
        createVerificationPoolConfig({
          NODE_ENV: 'production',
          DATABASE_URL:
            'postgresql://academic_writing_app@db.example/academic_writing?sslmode=require',
          DATABASE_SSL_CA_FILE: caFile,
        }),
      ).toThrow(/verify-full/);

      for (const invalidCaFile of [join(directory, 'missing.pem'), emptyCaFile]) {
        expect(() =>
          createVerificationPoolConfig({
            NODE_ENV: 'production',
            DATABASE_URL:
              'postgresql://academic_writing_app@db.example/academic_writing?sslmode=verify-full',
            DATABASE_SSL_CA_FILE: invalidCaFile,
          }),
        ).toThrow(/readable non-empty/);
      }

      expect(() =>
        createVerificationPoolConfig({
          NODE_ENV: 'production',
          DATABASE_URL:
            'postgresql://academic_writing_app@db.example/academic_writing?sslmode=verify-full',
          DATABASE_SSL_CA_FILE: caFile,
          DATABASE_SSL_REJECT_UNAUTHORIZED: 'false',
        }),
      ).toThrow(/cannot be false/);

      expect(
        createVerificationPoolConfig({
          NODE_ENV: 'production',
          DATABASE_URL:
            'postgresql://academic_writing_app@db.example/academic_writing?sslmode=verify-full',
          MIGRATION_DATABASE_URL:
            'postgresql://academic_writing_migrator@other.example/ignored',
          DATABASE_SSL_CA_FILE: caFile,
          DATABASE_CONNECTION_TIMEOUT_MS: '2500',
        }),
      ).toMatchObject({
        connectionString:
          'postgresql://academic_writing_app@db.example/academic_writing?sslmode=verify-full',
        connectionTimeoutMillis: 2500,
        ssl: {
          ca: 'sentinel-ca-content',
          rejectUnauthorized: true,
        },
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps count and exact table semantics aligned with runtime readiness', () => {
    expect(REQUIRED_MIGRATION_COUNT).toBe(RUNTIME_REQUIRED_MIGRATION_COUNT);
    expect(REQUIRED_TABLE_NAMES).toEqual(RUNTIME_REQUIRED_TABLE_NAMES);
    expect(REQUIRED_TABLE_NAMES).toHaveLength(14);
    expect(APP_DATABASE_ROLE).toBe('academic_writing_app');
  });

  it('verifies identity and schema inside a bounded read-only transaction', async () => {
    const client = createClient();
    const pool = createPool(client);

    await expect(verifyProductionDatabase({ pool })).resolves.toBeUndefined();

    const statements = client.query.mock.calls.map(([text]) => text);
    expect(statements[0]).toBe('BEGIN TRANSACTION READ ONLY');
    expect(statements[1]).toContain("set_config('statement_timeout'");
    expect(statements[2]).toContain('current_user AS current_user');
    expect(statements[3]).toContain("extname = 'vector'");
    expect(statements[3]).toContain('drizzle.__drizzle_migrations');
    for (const table of RUNTIME_REQUIRED_TABLE_NAMES) {
      expect(statements[3]).toContain(`'${table}'`);
    }
    expect(statements.at(-1)).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['wrong role', { currentUser: 'academic_writing_migrator' }, 'ROLE_MISMATCH'],
    ['missing vector', { vectorExtension: false }, 'VECTOR_EXTENSION_MISSING'],
    ['too few migrations', { appliedMigrations: 3 }, 'MIGRATION_COUNT_MISMATCH'],
    [
      'missing table',
      { requiredTables: RUNTIME_REQUIRED_TABLE_NAMES.slice(1) },
      'REQUIRED_TABLES_MISMATCH',
    ],
    [
      'extra table replacing a required table',
      { requiredTables: [...RUNTIME_REQUIRED_TABLE_NAMES.slice(1), 'unexpected_table'] },
      'REQUIRED_TABLES_MISMATCH',
    ],
    ['query failure', { failOn: 'AS vector_extension' }, 'VERIFICATION_QUERY_FAILED'],
  ])('fails closed for %s and still rolls back and closes', async (_name, options, code) => {
    const client = createClient(options as FakeClientOptions);
    const pool = createPool(client);

    await expect(verifyProductionDatabase({ pool })).rejects.toMatchObject({
      reasonCode: code,
    });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('closes the pool when connection fails', async () => {
    const pool = {
      connect: jest.fn().mockRejectedValue(new Error('synthetic connection timeout')),
      end: jest.fn().mockResolvedValue(undefined),
    };

    await expect(verifyProductionDatabase({ pool })).rejects.toMatchObject({
      reasonCode: 'DATABASE_CONNECTION_FAILED',
    });
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('sanitizes URLs, passwords, and CA content from library and CLI failures', () => {
    const databaseUrl =
      'postgresql://academic_writing_app:sentinel-password@db.example/academic_writing?sslmode=require';
    const ca = 'sentinel-ca-content';
    const sanitized = sanitizeVerificationError(
      new Error(`failure ${databaseUrl} sentinel-password ${ca}`),
      { DATABASE_URL: databaseUrl, DATABASE_SSL_CA: ca },
    );
    expect(sanitized).toMatch(/^Production database verification failed: [A-Z_]+\.$/u);
    expect(sanitized).not.toContain(databaseUrl);
    expect(sanitized).not.toContain('sentinel-password');
    expect(sanitized).not.toContain(ca);

    const result = spawnSync(process.execPath, [
      join(__dirname, '..', '..', 'scripts', 'verify-production-database.js'),
    ], {
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        DATABASE_URL: databaseUrl,
        DATABASE_SSL_CA: ca,
      },
    });
    expect(result.status).not.toBe(0);
    const output = `${result.stdout}${result.stderr}`;
    expect(output).toMatch(/^Production database verification failed: [A-Z_]+\.\r?\n$/u);
    expect(output).not.toContain(databaseUrl);
    expect(output).not.toContain('sentinel-password');
    expect(output).not.toContain(ca);
  });
});
