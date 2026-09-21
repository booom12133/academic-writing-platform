import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('P4 PostgreSQL migration contract', () => {
  const sql = readFileSync(resolve(process.cwd(), 'drizzle/migrations/0005_p4_paper_projects.sql'), 'utf8');
  it('adds only the five P4 tables and keeps project sources canonical', () => {
    expect((sql.match(/CREATE TABLE/g) ?? [])).toHaveLength(5);
    const sourceTable = sql.slice(sql.indexOf('CREATE TABLE "paper_project_sources"'), sql.indexOf('--> statement-breakpoint', sql.indexOf('CREATE TABLE "paper_project_sources"')));
    expect(sourceTable).toContain('"source_record_id"');
    expect(sourceTable).toContain('"document_version_id"');
    expect(sourceTable).not.toContain('"document_id"');
    expect(sourceTable).toMatch(/source_record_id.*is not null or.*document_version_id.*is not null/isu);
  });
  it('uses active-only root and child sibling position indexes', () => {
    expect(sql).toMatch(/paper_outline_nodes_active_root_position_key[^;]+WHERE "parent_id" IS NULL AND "status"='active'/u);
    expect(sql).toMatch(/paper_outline_nodes_active_child_position_key[^;]+WHERE "parent_id" IS NOT NULL AND "status"='active'/u);
  });
});
