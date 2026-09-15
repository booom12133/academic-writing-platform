import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const projectRoot = resolve(__dirname, '..', '..');
const canonicalRelativePath = 'deploy/postgres/production-role-grants.sql';
const canonicalPath = resolve(projectRoot, canonicalRelativePath);

function findCanonicalGrantSources(directory: string): string[] {
  const matches: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') {
      continue;
    }
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...findCanonicalGrantSources(absolute));
    } else if (entry.name === 'production-role-grants.sql') {
      matches.push(relative(projectRoot, absolute).replaceAll('\\', '/'));
    }
  }
  return matches;
}

describe('P3 canonical PostgreSQL role grants', () => {
  it('keeps one credential-free canonical grants source', () => {
    expect(findCanonicalGrantSources(projectRoot)).toEqual([canonicalRelativePath]);

    const sql = readFileSync(canonicalPath, 'utf8');
    expect(sql).not.toMatch(/PASSWORD|postgres(?:ql)?:\/\/|TOKEN|SECRET/iu);
  });

  it('normalizes the three least-privilege roles and explicit owners', () => {
    const sql = readFileSync(canonicalPath, 'utf8');

    expect(sql).toMatch(
      /CREATE ROLE academic_writing_db_owner\s+NOLOGIN\s+NOINHERIT\s+NOSUPERUSER\s+NOCREATEDB\s+NOCREATEROLE/iu,
    );
    expect(sql).toMatch(
      /ALTER ROLE academic_writing_db_owner\s+NOLOGIN\s+NOINHERIT\s+NOSUPERUSER\s+NOCREATEDB\s+NOCREATEROLE/iu,
    );
    for (const role of ['academic_writing_migrator', 'academic_writing_app']) {
      expect(sql).toMatch(
        new RegExp(
          `CREATE ROLE ${role}\\s+LOGIN\\s+NOINHERIT\\s+NOSUPERUSER\\s+NOCREATEDB\\s+NOCREATEROLE`,
          'iu',
        ),
      );
      expect(sql).toMatch(
        new RegExp(
          `ALTER ROLE ${role}\\s+LOGIN\\s+NOINHERIT\\s+NOSUPERUSER\\s+NOCREATEDB\\s+NOCREATEROLE`,
          'iu',
        ),
      );
    }
    expect(sql).toMatch(/ALTER DATABASE .* OWNER TO academic_writing_db_owner/iu);
    expect(sql).toMatch(/ALTER SCHEMA public OWNER TO academic_writing_db_owner/iu);
    expect(sql).toMatch(/CREATE SCHEMA IF NOT EXISTS drizzle AUTHORIZATION academic_writing_db_owner/iu);
    expect(sql).toMatch(/ALTER SCHEMA drizzle OWNER TO academic_writing_db_owner/iu);
  });

  it('allows migration only in precreated schemas and keeps the app DDL-free', () => {
    const sql = readFileSync(canonicalPath, 'utf8');

    expect(sql).toMatch(/REVOKE CREATE ON SCHEMA public FROM PUBLIC/iu);
    expect(sql).toMatch(
      /GRANT USAGE, CREATE ON SCHEMA public, drizzle TO academic_writing_migrator/iu,
    );
    expect(sql).toMatch(
      /GRANT USAGE ON SCHEMA public, drizzle TO academic_writing_app/iu,
    );
    expect(sql).not.toMatch(
      /GRANT\s+[^;]*\bCREATE\b[^;]*\bON\s+DATABASE[^;]*\bTO\s+academic_writing_(?:migrator|app)\b/iu,
    );
    expect(sql).not.toMatch(
      /GRANT\s+[^;]*\bCREATE\b[^;]*\bON\s+SCHEMA[^;]*\bTO\s+academic_writing_app\b/iu,
    );
    expect(sql).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO academic_writing_app/iu,
    );
    expect(sql).toMatch(
      /GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO academic_writing_app/iu,
    );
    expect(sql).toMatch(
      /GRANT SELECT ON ALL TABLES IN SCHEMA drizzle TO academic_writing_app/iu,
    );
  });

  it('grants app access to future migrator-owned runtime objects', () => {
    const sql = readFileSync(canonicalPath, 'utf8');

    expect(sql).toMatch(
      /ALTER DEFAULT PRIVILEGES FOR ROLE academic_writing_migrator IN SCHEMA public\s+GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO academic_writing_app/iu,
    );
    expect(sql).toMatch(
      /ALTER DEFAULT PRIVILEGES FOR ROLE academic_writing_migrator IN SCHEMA public\s+GRANT USAGE, SELECT ON SEQUENCES TO academic_writing_app/iu,
    );
    expect(sql).toMatch(
      /ALTER DEFAULT PRIVILEGES FOR ROLE academic_writing_migrator IN SCHEMA public\s+GRANT USAGE ON TYPES TO academic_writing_app/iu,
    );
    expect(sql).toMatch(
      /ALTER DEFAULT PRIVILEGES FOR ROLE academic_writing_migrator IN SCHEMA drizzle\s+GRANT SELECT ON TABLES TO academic_writing_app/iu,
    );
  });
});
