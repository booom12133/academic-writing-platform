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

  it('closes the owned pool through the database lifecycle', async () => {
    const end = jest.fn().mockResolvedValue(undefined);
    await closeStandardPostgresPool({ end });
    expect(end).toHaveBeenCalledTimes(1);
  });
});
