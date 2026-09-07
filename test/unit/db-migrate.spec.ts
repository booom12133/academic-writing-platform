// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createMigrationPool, createMigrationPoolConfig, runMigrations } = require('../../scripts/db-migrate.js');

describe('standard PostgreSQL migration runner', () => {
  it('fails closed when DATABASE_URL is missing', () => {
    expect(() => createMigrationPool({})).toThrow(/DATABASE_URL/);
  });

  it('supports a separately scoped migration principal while retaining DATABASE_URL fallback', () => {
    const config = createMigrationPoolConfig({
      DATABASE_URL: 'postgresql://runtime.example/academic_writing',
      MIGRATION_DATABASE_URL: 'postgresql://migration.example/academic_writing',
    });

    expect(config.connectionString).toBe(
      'postgresql://migration.example/academic_writing',
    );
  });

  it('locks and migrates on one client before releasing it', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({}),
      release: jest.fn(),
    };
    const pool = {
      connect: jest.fn().mockResolvedValue(client),
      end: jest.fn().mockResolvedValue(undefined),
    };
    const drizzleFn = jest.fn().mockReturnValue({ database: true });
    const migrateFn = jest.fn().mockResolvedValue(undefined);

    await runMigrations({ pool, drizzleFn, migrateFn });

    expect(client.query.mock.calls).toEqual([
      ['SELECT pg_advisory_lock($1)', [318104001]],
      ['SELECT pg_advisory_unlock($1)', [318104001]],
    ]);
    expect(drizzleFn).toHaveBeenCalledWith(client);
    expect(migrateFn).toHaveBeenCalledWith(
      { database: true },
      expect.objectContaining({
        migrationsSchema: 'drizzle',
        migrationsTable: '__drizzle_migrations',
      }),
    );
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('releases the advisory lock when migration fails', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({}),
      release: jest.fn(),
    };
    const pool = {
      connect: jest.fn().mockResolvedValue(client),
      end: jest.fn().mockResolvedValue(undefined),
    };
    const error = new Error('migration failed');

    await expect(
      runMigrations({
        pool,
        drizzleFn: () => ({}),
        migrateFn: jest.fn().mockRejectedValue(error),
      }),
    ).rejects.toBe(error);

    expect(client.query).toHaveBeenLastCalledWith('SELECT pg_advisory_unlock($1)', [318104001]);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
  });
});
