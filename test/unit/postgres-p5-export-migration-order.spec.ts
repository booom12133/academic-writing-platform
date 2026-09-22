import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('P5 export migration contract', () => {
  const sql = readFileSync(resolve(process.cwd(), 'drizzle/migrations/0007_p5_paper_exports.sql'), 'utf8');

  it('adds only the immutable owner-scoped paper_exports table', () => {
    expect(sql).toMatch(/CREATE TABLE "paper_exports"/u);
    expect(sql).toMatch(/paper_exports_project_owner_fk/iu);
    expect(sql).toMatch(/paper_exports_fingerprint_check/iu);
    expect(sql).toMatch(/jsonb_typeof\("snapshot_manifest"\) = 'object'/iu);
    expect(sql).toMatch(/paper_exports_user_project_created_idx/iu);
    expect(sql).not.toMatch(/ALTER TABLE "paper_sections"/iu);
    expect(sql).not.toMatch(/UPDATE|DELETE/iu);
  });
});
