import {
  checkDatabaseReadiness,
  REQUIRED_MIGRATION_COUNT,
  REQUIRED_TABLE_NAMES,
} from './database-readiness';

describe('database readiness', () => {
  it('reports ready only when PostgreSQL, pgvector, schema version and tables are present', async () => {
    const execute = jest.fn().mockResolvedValue({
      rows: [{
        vector_extension: true,
        applied_migrations: REQUIRED_MIGRATION_COUNT,
        required_tables: REQUIRED_TABLE_NAMES.length,
      }],
    });

    await expect(checkDatabaseReadiness({ execute } as never)).resolves.toEqual({
      ready: true,
    });
  });

  it('returns a stable database reason when the dependency is unreachable', async () => {
    const execute = jest.fn().mockRejectedValue(new Error('password leaked must not escape'));

    await expect(checkDatabaseReadiness({ execute } as never)).resolves.toEqual({
      ready: false,
      reasonCode: 'database_unreachable',
    });
  });

  it('reports missing vector and schema independently without exposing database details', async () => {
    const execute = jest.fn().mockResolvedValue({
      rows: [{ vector_extension: false, applied_migrations: 2, required_tables: 14 }],
    });

    await expect(checkDatabaseReadiness({ execute } as never)).resolves.toEqual({
      ready: false,
      reasonCode: 'vector_extension_missing',
    });
  });

  it('reports a missing required schema version', async () => {
    const execute = jest.fn().mockResolvedValue({
      rows: [{ vector_extension: true, applied_migrations: 2, required_tables: 14 }],
    });

    await expect(checkDatabaseReadiness({ execute } as never)).resolves.toEqual({
      ready: false,
      reasonCode: 'schema_version_missing',
    });
  });
});
