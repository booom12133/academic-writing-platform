import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('P5 section role migration contract', () => {
  const sql = readFileSync(resolve(process.cwd(), 'drizzle/migrations/0006_p5_section_roles.sql'), 'utf8');

  it('only extends paper_sections with bounded roles and one active derived role per project', () => {
    expect(sql).toMatch(/ALTER TABLE "paper_sections"\s+ADD COLUMN "section_role" varchar\(20\) DEFAULT 'OUTLINE' NOT NULL/iu);
    expect(sql).toMatch(/CHECK \("section_role" in \('OUTLINE','ABSTRACT','KEYWORDS'\)\)/iu);
    expect(sql).toMatch(/paper_sections_active_derived_role_key/iu);
    expect(sql).toMatch(/WHERE "section_role" in \('ABSTRACT','KEYWORDS'\) AND "status"='active'/iu);
    expect(sql).not.toMatch(/CREATE TABLE/iu);
  });
});
