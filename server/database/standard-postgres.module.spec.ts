import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  closeStandardPostgresPool,
  createStandardPostgresConfig,
} from './standard-postgres.module';

describe('standard PostgreSQL database boundary', () => {
  it('fails closed when DATABASE_URL is missing', () => {
    expect(() => createStandardPostgresConfig({})).toThrow(/DATABASE_URL/);
  });

  it('fails closed when DATABASE_URL is not PostgreSQL', () => {
    expect(() =>
      createStandardPostgresConfig({ DATABASE_URL: 'https://example.test' }),
    ).toThrow(/PostgreSQL/);
  });

  it('accepts a PostgreSQL URL and applies bounded pool defaults', () => {
    expect(
      createStandardPostgresConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
      }),
    ).toMatchObject({
      connectionString: 'postgresql://user:pass@localhost:5432/app',
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      ssl: { rejectUnauthorized: true },
    });
  });

  it('loads the trusted CA from DATABASE_SSL_CA_FILE for production TLS', () => {
    const root = mkdtempSync(join(tmpdir(), 'academic-writing-ca-'));
    const caPath = join(root, 'postgres-ca.pem');
    try {
      writeFileSync(caPath, 'trusted-ca-pem');
      expect(
        createStandardPostgresConfig({
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://user:pass@db.academic-writing.internal:5432/app',
          DATABASE_SSL_CA_FILE: caPath,
        }),
      ).toMatchObject({
        ssl: { rejectUnauthorized: true, ca: 'trusted-ca-pem' },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when DATABASE_SSL_CA_FILE is unreadable', () => {
    expect(() =>
      createStandardPostgresConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@db.academic-writing.internal:5432/app',
        DATABASE_SSL_CA_FILE: '/missing/postgres-ca.pem',
      }),
    ).toThrow(/DATABASE_SSL_CA_FILE/);
  });

  it('rejects sslmode=require in a production connection URL', () => {
    expect(() =>
      createStandardPostgresConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@db.academic-writing.internal:5432/app?sslmode=require',
      }),
    ).toThrow(/sslmode must be verify-full/);
  });

  it('closes the owned pool through the database lifecycle', async () => {
    const end = jest.fn().mockResolvedValue(undefined);
    await closeStandardPostgresPool({ end });
    expect(end).toHaveBeenCalledTimes(1);
  });
});
