// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  MIGRATION_LOCK_KEY,
  applyPendingMigrations,
  assertControlledMigrationPreconditions,
  createMigrationPool,
  createMigrationPoolConfig,
  runMigrations,
  sanitizeMigrationError,
} = require('../../scripts/db-migrate.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg');

interface FakeClientOptions {
  currentUser?: string;
  schemaExists?: boolean;
  hasUsage?: boolean;
  hasCreate?: boolean;
  hasDatabaseCreate?: boolean;
  latestCreatedAt?: number;
  failOn?: string;
}

function createClient(options: FakeClientOptions = {}) {
  const client = {
    query: jest.fn(async (text: string) => {
      if (options.failOn && text.includes(options.failOn)) {
        throw new Error('synthetic migration failure');
      }
      if (text.includes('current_user AS current_user')) {
        return { rows: [{ current_user: options.currentUser ?? 'academic_writing_migrator' }] };
      }
      if (text.includes('AS schema_exists')) {
        return { rows: [{ schema_exists: options.schemaExists ?? true }] };
      }
      if (text.includes('AS has_usage')) {
        return {
          rows: [{
            has_usage: options.hasUsage ?? true,
            has_create: options.hasCreate ?? true,
            has_database_create: options.hasDatabaseCreate ?? false,
          }],
        };
      }
      if (text.includes('ORDER BY created_at DESC LIMIT 1')) {
        return {
          rows: options.latestCreatedAt === undefined
            ? []
            : [{ created_at: options.latestCreatedAt }],
        };
      }
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  return client;
}

describe('controlled PostgreSQL migration runner', () => {
  it('rejects a production DATABASE_URL fallback before pool creation', () => {
    const sentinel = 'postgresql://app:do-not-echo@runtime.example/academic_writing';

    expect(() =>
      createMigrationPool({
        NODE_ENV: 'production',
        DATABASE_URL: sentinel,
      }),
    ).toThrow('MIGRATION_DATABASE_URL is required in production');

    try {
      createMigrationPoolConfig({ NODE_ENV: 'production', DATABASE_URL: sentinel });
    } catch (error) {
      expect(String(error)).not.toContain(sentinel);
      expect(String(error)).not.toContain('do-not-echo');
    }
  });

  it('uses an explicit production migrator URL with verified TLS', () => {
    const config = createMigrationPoolConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://runtime.example/academic_writing',
      MIGRATION_DATABASE_URL:
        'postgresql://migration.example/academic_writing',
      DATABASE_SSL_CA_FILE: __filename,
    });

    expect(config).toMatchObject({
      connectionString:
        'postgresql://migration.example/academic_writing',
      ssl: { rejectUnauthorized: true, ca: expect.any(String) },
    });
    const client = new Client(config);
    expect(client.connectionParameters.ssl).toMatchObject({
      rejectUnauthorized: true,
      ca: expect.any(String),
    });
  });

  it('fails closed when the migration CA file is unreadable', () => {
    expect(() =>
      createMigrationPoolConfig({
        NODE_ENV: 'production',
        MIGRATION_DATABASE_URL:
          'postgresql://migration.example/academic_writing',
        DATABASE_SSL_CA_FILE: '/missing/postgres-ca.pem',
      }),
    ).toThrow(/DATABASE_SSL_CA_FILE/);
  });

  it.each(['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert'])(
    'rejects the conflicting %s parameter in the production migrator URL',
    (parameter) => {
      const migrationUrl =
        `postgresql://academic_writing_migrator:sentinel-password@migration.example/academic_writing?${parameter}=sentinel-value`;
      expect(() =>
        createMigrationPoolConfig({
          NODE_ENV: 'production',
          MIGRATION_DATABASE_URL: migrationUrl,
          DATABASE_SSL_CA: 'sentinel-ca-content',
        }),
      ).toThrow(/MIGRATION_DATABASE_URL must not include PostgreSQL SSL query parameters/);
      try {
        createMigrationPoolConfig({
          NODE_ENV: 'production',
          MIGRATION_DATABASE_URL: migrationUrl,
          DATABASE_SSL_CA: 'sentinel-ca-content',
        });
      } catch (error) {
        expect(String(error)).not.toContain(migrationUrl);
        expect(String(error)).not.toContain('sentinel-password');
        expect(String(error)).not.toContain('sentinel-ca-content');
      }
    },
  );

  it('retains DATABASE_URL fallback outside production only', () => {
    expect(
      createMigrationPoolConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://localhost/academic_writing',
      }).connectionString,
    ).toBe('postgresql://localhost/academic_writing');
  });

  it('redacts configured URLs, passwords, and CA content from failures', () => {
    const migrationUrl = 'postgresql://migrator:sentinel-password@db.example/academic_writing';
    const ca = 'sentinel-ca-content';
    const message = sanitizeMigrationError(
      new Error(`failed ${migrationUrl} sentinel-password ${ca}`),
      { MIGRATION_DATABASE_URL: migrationUrl, DATABASE_SSL_CA: ca },
    );

    expect(message).toContain('[REDACTED]');
    expect(message).not.toContain(migrationUrl);
    expect(message).not.toContain('sentinel-password');
    expect(message).not.toContain(ca);
  });

  it.each([
    ['wrong production role', { currentUser: 'academic_writing_app' }, true, /migration role/],
    ['missing drizzle schema', { schemaExists: false }, false, /drizzle schema/],
    ['missing schema usage', { hasUsage: false }, false, /USAGE and CREATE/],
    ['missing schema create', { hasCreate: false }, false, /USAGE and CREATE/],
    ['database create privilege', { hasDatabaseCreate: true }, false, /database CREATE/],
  ])('rejects %s', async (_name, options, production, expected) => {
    await expect(
      assertControlledMigrationPreconditions(createClient(options), { production }),
    ).rejects.toThrow(expected);
  });

  it('applies pending statements and metadata once in one transaction', async () => {
    const client = createClient({ latestCreatedAt: 100 });
    const migrations = [
      { sql: ['FIRST STATEMENT', 'SECOND STATEMENT'], hash: 'hash-two', folderMillis: 200 },
      { sql: ['THIRD STATEMENT'], hash: 'hash-three', folderMillis: 300 },
    ];

    await applyPendingMigrations(client, migrations);

    expect(client.query.mock.calls).toEqual([
      [expect.stringContaining('CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations')],
      [expect.stringContaining('ORDER BY created_at DESC LIMIT 1')],
      ['BEGIN'],
      ['FIRST STATEMENT'],
      ['SECOND STATEMENT'],
      [
        expect.stringContaining('INSERT INTO drizzle.__drizzle_migrations'),
        ['hash-two', 200],
      ],
      ['THIRD STATEMENT'],
      [
        expect.stringContaining('INSERT INTO drizzle.__drizzle_migrations'),
        ['hash-three', 300],
      ],
      ['COMMIT'],
    ]);
  });

  it('rolls back the complete pending set on statement failure', async () => {
    const client = createClient({ failOn: 'BROKEN STATEMENT' });

    await expect(
      applyPendingMigrations(client, [
        { sql: ['FIRST STATEMENT', 'BROKEN STATEMENT'], hash: 'hash', folderMillis: 100 },
      ]),
    ).rejects.toThrow('synthetic migration failure');

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
  });

  it('locks, reads migrations, and always unlocks and closes', async () => {
    const client = createClient();
    const pool = {
      connect: jest.fn().mockResolvedValue(client),
      end: jest.fn().mockResolvedValue(undefined),
    };
    const readMigrationFilesFn = jest.fn().mockReturnValue([]);

    await runMigrations({ pool, readMigrationFilesFn });

    expect(readMigrationFilesFn).toHaveBeenCalledWith({
      migrationsFolder: expect.stringContaining('drizzle'),
    });
    expect(client.query.mock.calls[0]).toEqual([
      'SELECT pg_advisory_lock($1)',
      [MIGRATION_LOCK_KEY],
    ]);
    expect(client.query).toHaveBeenLastCalledWith(
      'SELECT pg_advisory_unlock($1)',
      [MIGRATION_LOCK_KEY],
    );
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('unlocks and closes when controlled migration fails', async () => {
    const client = createClient({ schemaExists: false });
    const pool = {
      connect: jest.fn().mockResolvedValue(client),
      end: jest.fn().mockResolvedValue(undefined),
    };

    await expect(runMigrations({ pool, readMigrationFilesFn: () => [] })).rejects.toThrow(
      /drizzle schema/,
    );

    expect(client.query).toHaveBeenLastCalledWith(
      'SELECT pg_advisory_unlock($1)',
      [MIGRATION_LOCK_KEY],
    );
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
  });
});
