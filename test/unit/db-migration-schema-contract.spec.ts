import { resolve } from 'node:path';

import { readMigrationFiles } from 'drizzle-orm/migrator';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { applyPendingMigrations } = require('../../scripts/db-migrate.js');

const migrationsFolder = resolve(__dirname, '..', '..', 'drizzle', 'migrations');

describe('controlled migration schema contract', () => {
  it('retains the reviewed Drizzle journal order and SHA-256 hashes', () => {
    const migrations = readMigrationFiles({ migrationsFolder });

    expect(migrations.map(({ folderMillis, hash }) => ({ folderMillis, hash }))).toEqual([
      {
        folderMillis: 1788495777913,
        hash: 'fb9a821a072df715968438626d2be6623d730bee833f58f26064507368578ee8',
      },
      {
        folderMillis: 1788495777914,
        hash: 'd88c7e10522148713084ac6d7e38ef103484720a2b5a9935de1f0cf910573042',
      },
      {
        folderMillis: 1788623512945,
        hash: '986b864942d324b3a877ced68ce4567b634b92bf80304815f46d3c5d16690f0f',
      },
      {
        folderMillis: 1788670451922,
        hash: '6d91ef048aee4e5bd7ec90736faeefc4a6460dea9ecde3148289ef7f14633e87',
      },
    ]);
  });

  it('never emits CREATE SCHEMA while preserving statement order and hash inserts', async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];
    const client = {
      query: jest.fn(async (text: string, values?: unknown[]) => {
        queries.push({ text, values });
        if (text.includes('ORDER BY created_at DESC LIMIT 1')) return { rows: [] };
        return { rows: [] };
      }),
    };

    await applyPendingMigrations(client, readMigrationFiles({ migrationsFolder }));

    expect(queries.map(({ text }) => text).join('\n')).not.toMatch(/CREATE\s+SCHEMA/iu);
    expect(queries.findIndex(({ text }) => text.includes('CREATE TABLE "app_users"'))).toBeLessThan(
      queries.findIndex(({ text }) => text.includes('CREATE TABLE "knowledge_source_records"')),
    );
    expect(
      queries.filter(({ text }) => text.includes('INSERT INTO drizzle.__drizzle_migrations'))
        .map(({ values }) => values),
    ).toEqual([
      ['fb9a821a072df715968438626d2be6623d730bee833f58f26064507368578ee8', 1788495777913],
      ['d88c7e10522148713084ac6d7e38ef103484720a2b5a9935de1f0cf910573042', 1788495777914],
      ['986b864942d324b3a877ced68ce4567b634b92bf80304815f46d3c5d16690f0f', 1788623512945],
      ['6d91ef048aee4e5bd7ec90736faeefc4a6460dea9ecde3148289ef7f14633e87', 1788670451922],
    ]);
  });
});
