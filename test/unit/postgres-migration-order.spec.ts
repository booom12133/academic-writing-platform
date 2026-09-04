import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('E1 PostgreSQL migration ordering', () => {
  it('creates every composite referenced unique key before the ownership foreign keys', () => {
    const sql = readFileSync(resolve(process.cwd(), 'drizzle/migrations/0002_e1_knowledge_provenance.sql'), 'utf8');
    const firstForeignKey = sql.indexOf('ADD CONSTRAINT "knowledge_');
    expect(firstForeignKey).toBeGreaterThanOrEqual(0);

    for (const indexName of [
      'knowledge_source_records_id_user_id_key',
      'knowledge_documents_id_user_id_key',
      'knowledge_document_versions_id_user_id_key',
    ]) {
      const indexPosition = sql.indexOf(`CREATE UNIQUE INDEX "${indexName}"`);
      expect(indexPosition).toBeGreaterThanOrEqual(0);
      expect(indexPosition).toBeLessThan(firstForeignKey);
    }
  });
});
