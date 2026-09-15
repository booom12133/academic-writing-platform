import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { readMigrationFiles } from 'drizzle-orm/migrator';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { applyPendingMigrations } = require('../../scripts/db-migrate.js');

const migrationsFolder = resolve(__dirname, '..', '..', 'drizzle', 'migrations');
const reviewedMigrations = [
  { fileName: '0001_standard_postgres_baseline.sql', folderMillis: 1788495777913 },
  { fileName: '0002_e1_knowledge_provenance.sql', folderMillis: 1788495777914 },
  { fileName: '0003_e2_embedding_indexes.sql', folderMillis: 1788623512945 },
  { fileName: '0004_e4_zotero_connections.sql', folderMillis: 1788670451922 },
].map(({ fileName, folderMillis }) => ({
  fileName,
  folderMillis,
  hash: createHash('sha256')
    .update(readFileSync(join(migrationsFolder, fileName)))
    .digest('hex'),
}));

describe('controlled migration schema contract', () => {
  it('retains the reviewed Drizzle journal order and SHA-256 hashes', () => {
    const migrations = readMigrationFiles({ migrationsFolder });

    expect(migrations.map(({ folderMillis, hash }) => ({ folderMillis, hash }))).toEqual(
      reviewedMigrations.map(({ folderMillis, hash }) => ({ folderMillis, hash })),
    );
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
    ).toEqual(reviewedMigrations.map(({ hash, folderMillis }) => [hash, folderMillis]));
  });
});
