import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('E4 PostgreSQL migration ordering', () => {
  it('adds the E4 migration after the accepted E2 migration', () => {
    const migrationPath = resolve(process.cwd(), 'drizzle/migrations/0004_e4_zotero_connections.sql');
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql.indexOf('CREATE TABLE "zotero_connections"')).toBeGreaterThanOrEqual(0);
    expect(sql.indexOf('ALTER TABLE "knowledge_documents"')).toBeGreaterThanOrEqual(0);
    expect(sql).toContain('zotero_connections_identity_key');
    expect(sql).toContain('knowledge_documents_external_identity_key');
  });
});
