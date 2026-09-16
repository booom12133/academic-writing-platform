import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Client } from 'pg';

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
        DATABASE_SSL_CA: 'trusted-ca-pem',
      }),
    ).toMatchObject({
      connectionString: 'postgresql://user:pass@localhost:5432/app',
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      ssl: { rejectUnauthorized: true, ca: 'trusted-ca-pem' },
    });
  });

  it('loads the trusted CA from DATABASE_SSL_CA_FILE for production TLS', () => {
    const root = mkdtempSync(join(tmpdir(), 'academic-writing-ca-'));
    const caPath = join(root, 'postgres-ca.pem');
    try {
      writeFileSync(caPath, 'trusted-ca-pem');
      const config = createStandardPostgresConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@db.academic-writing.internal:5432/app',
        DATABASE_SSL_CA_FILE: caPath,
      });
      expect(config).toMatchObject({
        ssl: { rejectUnauthorized: true, ca: 'trusted-ca-pem' },
      });
      const client = new Client(config);
      expect(client.connectionParameters.ssl).toEqual({
        rejectUnauthorized: true,
        ca: 'trusted-ca-pem',
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

  it.each(['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert'])(
    'rejects the conflicting %s parameter in a production runtime URL',
    (parameter) => {
      const databaseUrl =
        `postgresql://user:sentinel-password@db.academic-writing.internal:5432/app?${parameter}=sentinel-value`;
      expect(() =>
        createStandardPostgresConfig({
          NODE_ENV: 'production',
          DATABASE_URL: databaseUrl,
          DATABASE_SSL_CA: 'sentinel-ca-content',
        }),
      ).toThrow(/DATABASE_URL must not include PostgreSQL SSL query parameters/);
      try {
        createStandardPostgresConfig({
          NODE_ENV: 'production',
          DATABASE_URL: databaseUrl,
          DATABASE_SSL_CA: 'sentinel-ca-content',
        });
      } catch (error) {
        expect(String(error)).not.toContain(databaseUrl);
        expect(String(error)).not.toContain('sentinel-password');
        expect(String(error)).not.toContain('sentinel-ca-content');
      }
    },
  );

  it('closes the owned pool through the database lifecycle', async () => {
    const end = jest.fn().mockResolvedValue(undefined);
    await closeStandardPostgresPool({ end });
    expect(end).toHaveBeenCalledTimes(1);
  });
});
