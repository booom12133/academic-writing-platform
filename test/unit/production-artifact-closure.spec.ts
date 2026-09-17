import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  assertProductionArtifactLayout,
  classifyArtifactEntry,
} from '../../scripts/test-production-artifact';

const migrationName = '0001_standard_postgres_baseline.sql';

function createArtifact(
  root: string,
  migrationContent = 'CREATE TABLE baseline ();',
) {
  mkdirSync(join(root, 'server'), { recursive: true });
  mkdirSync(join(root, 'dist', 'client'), { recursive: true });
  mkdirSync(join(root, 'client'), { recursive: true });
  mkdirSync(join(root, 'shared'), { recursive: true });
  mkdirSync(join(root, 'sourcemaps'), { recursive: true });
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'drizzle', 'migrations'), { recursive: true });
  writeFileSync(join(root, 'server', 'main.js'), 'runtime');
  mkdirSync(join(root, 'dist', 'client', 'assets'), { recursive: true });
  writeFileSync(
    join(root, 'dist', 'client', 'index.html'),
    [
      '<!doctype html>',
      '<link rel="stylesheet" href="/assets/app-hash.css">',
      '<script type="module" src="/assets/app-hash.js"></script>',
    ].join('\n'),
  );
  writeFileSync(join(root, 'dist', 'client', 'assets', 'app-hash.css'), 'body {}');
  writeFileSync(join(root, 'dist', 'client', 'assets', 'app-hash.js'), 'export {};');
  writeFileSync(join(root, 'api-routes.json'), '{}');
  writeFileSync(join(root, 'page-routes.json'), '{}');
  writeFileSync(join(root, 'package.json'), '{"private":true}');
  writeFileSync(join(root, 'run.sh'), '#!/usr/bin/env bash');
  for (const script of [
    'db-migrate.js',
    'db-backup.js',
    'db-restore-verify.js',
    'verify-production-database.js',
  ]) {
    writeFileSync(
      join(root, 'scripts', script),
      '#!/usr/bin/env node\n' + script,
    );
  }
  writeFileSync(
    join(root, 'drizzle', 'migrations', migrationName),
    migrationContent,
  );
}

describe('production artifact closure', () => {
  it('classifies symlinks as artifact violations', () => {
    expect(
      classifyArtifactEntry('app/node_modules/linked', {
        isSymbolicLink: () => true,
      }),
    ).toBe('symlink');
  });

  it('accepts runtime, allow-listed DB scripts, and exact migrations', () => {
    const root = mkdtempSync(join(tmpdir(), 'academic-writing-artifact-'));
    const migrationsRoot = mkdtempSync(
      join(tmpdir(), 'academic-writing-migrations-'),
    );
    try {
      createArtifact(root);
      mkdirSync(migrationsRoot, { recursive: true });
      writeFileSync(
        join(migrationsRoot, migrationName),
        'CREATE TABLE baseline ();',
      );

      expect(() =>
        assertProductionArtifactLayout(root, migrationsRoot),
      ).not.toThrow();
      expect(readdirSync(join(root, 'scripts')).sort()).toEqual([
        'db-backup.js',
        'db-migrate.js',
        'db-restore-verify.js',
        'verify-production-database.js',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(migrationsRoot, { recursive: true, force: true });
    }
  });

  it('rejects a non-approved production script', () => {
    const root = mkdtempSync(join(tmpdir(), 'academic-writing-artifact-'));
    const migrationsRoot = mkdtempSync(
      join(tmpdir(), 'academic-writing-migrations-'),
    );
    try {
      createArtifact(root);
      writeFileSync(join(root, 'scripts', 'lint.js'), 'not production');
      mkdirSync(migrationsRoot, { recursive: true });
      writeFileSync(
        join(migrationsRoot, migrationName),
        'CREATE TABLE baseline ();',
      );

      expect(() =>
        assertProductionArtifactLayout(root, migrationsRoot),
      ).toThrow(/scripts\/lint\.js/);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(migrationsRoot, { recursive: true, force: true });
    }
  });

  it('rejects the old split frontend layout when index assets exist only outside the runtime root', () => {
    const root = mkdtempSync(join(tmpdir(), 'academic-writing-artifact-'));
    const migrationsRoot = mkdtempSync(
      join(tmpdir(), 'academic-writing-migrations-'),
    );
    try {
      createArtifact(root);
      rmSync(join(root, 'dist', 'client', 'assets'), {
        recursive: true,
        force: true,
      });
      mkdirSync(join(root, 'client', 'assets'), { recursive: true });
      writeFileSync(join(root, 'client', 'assets', 'app-hash.css'), 'body {}');
      writeFileSync(join(root, 'client', 'assets', 'app-hash.js'), 'export {};');
      mkdirSync(migrationsRoot, { recursive: true });
      writeFileSync(
        join(migrationsRoot, migrationName),
        'CREATE TABLE baseline ();',
      );

      expect(() =>
        assertProductionArtifactLayout(root, migrationsRoot),
      ).toThrow(
        /frontend index references missing runtime asset: \/assets\/app-hash\.(?:css|js)/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(migrationsRoot, { recursive: true, force: true });
    }
  });

  it('ignores external and data frontend references', () => {
    const root = mkdtempSync(join(tmpdir(), 'academic-writing-artifact-'));
    const migrationsRoot = mkdtempSync(
      join(tmpdir(), 'academic-writing-migrations-'),
    );
    try {
      createArtifact(root);
      writeFileSync(
        join(root, 'dist', 'client', 'index.html'),
        [
          '<link rel="stylesheet" href="https://cdn.example.com/app.css">',
          '<script src="data:text/javascript,export%20default%201"></script>',
        ].join('\n'),
      );
      rmSync(join(root, 'dist', 'client', 'assets'), {
        recursive: true,
        force: true,
      });
      mkdirSync(migrationsRoot, { recursive: true });
      writeFileSync(
        join(migrationsRoot, migrationName),
        'CREATE TABLE baseline ();',
      );

      expect(() =>
        assertProductionArtifactLayout(root, migrationsRoot),
      ).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(migrationsRoot, { recursive: true, force: true });
    }
  });

  it('rejects frontend references that traverse outside the runtime root', () => {
    const root = mkdtempSync(join(tmpdir(), 'academic-writing-artifact-'));
    const migrationsRoot = mkdtempSync(
      join(tmpdir(), 'academic-writing-migrations-'),
    );
    try {
      createArtifact(root);
      writeFileSync(
        join(root, 'dist', 'client', 'index.html'),
        '<script src="../outside.js"></script>',
      );
      writeFileSync(join(root, 'dist', 'outside.js'), 'export {};');
      mkdirSync(migrationsRoot, { recursive: true });
      writeFileSync(
        join(migrationsRoot, migrationName),
        'CREATE TABLE baseline ();',
      );

      expect(() =>
        assertProductionArtifactLayout(root, migrationsRoot),
      ).toThrow(/frontend asset path traversal is forbidden: \.\.\/outside\.js/);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(migrationsRoot, { recursive: true, force: true });
    }
  });

  it.each([
    'server/modules/health/health.spec.js',
    'server/modules/health/health.spec.d.ts',
    'server/modules/health/health.spec.js.map',
    'server/modules/health/health.test.js',
    'server/modules/health/health.test.d.ts',
    'server/modules/health/health.test.js.map',
    'server/modules/health/health.e2e-spec.js',
    'server/modules/health/health.e2e-spec.d.ts',
    'server/modules/health/health.e2e-spec.js.map',
    'server/modules/health/__tests__/health.js',
  ])('rejects application-owned compiled test artifact %s', (relativePath) => {
    const root = mkdtempSync(join(tmpdir(), 'academic-writing-artifact-'));
    const migrationsRoot = mkdtempSync(
      join(tmpdir(), 'academic-writing-migrations-'),
    );
    try {
      createArtifact(root);
      mkdirSync(join(root, dirname(relativePath)), { recursive: true });
      writeFileSync(join(root, relativePath), 'compiled test artifact');
      mkdirSync(migrationsRoot, { recursive: true });
      writeFileSync(
        join(migrationsRoot, migrationName),
        'CREATE TABLE baseline ();',
      );

      expect(() =>
        assertProductionArtifactLayout(root, migrationsRoot),
      ).toThrow(relativePath);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(migrationsRoot, { recursive: true, force: true });
    }
  });

  it('rejects an empty application-owned __tests__ directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'academic-writing-artifact-'));
    const migrationsRoot = mkdtempSync(
      join(tmpdir(), 'academic-writing-migrations-'),
    );
    try {
      createArtifact(root);
      mkdirSync(join(root, 'server', 'modules', 'health', '__tests__'), {
        recursive: true,
      });
      mkdirSync(migrationsRoot, { recursive: true });
      writeFileSync(
        join(migrationsRoot, migrationName),
        'CREATE TABLE baseline ();',
      );

      expect(() =>
        assertProductionArtifactLayout(root, migrationsRoot),
      ).toThrow('server/modules/health/__tests__');
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(migrationsRoot, { recursive: true, force: true });
    }
  });

  it('does not treat third-party node_modules test files as application artifacts', () => {
    const root = mkdtempSync(join(tmpdir(), 'academic-writing-artifact-'));
    const migrationsRoot = mkdtempSync(
      join(tmpdir(), 'academic-writing-migrations-'),
    );
    try {
      createArtifact(root);
      const thirdPartyTests = join(
        root,
        'node_modules',
        'dependency',
        '__tests__',
      );
      mkdirSync(thirdPartyTests, { recursive: true });
      writeFileSync(join(thirdPartyTests, 'dependency.spec.js'), 'third party');
      mkdirSync(migrationsRoot, { recursive: true });
      writeFileSync(
        join(migrationsRoot, migrationName),
        'CREATE TABLE baseline ();',
      );

      expect(() =>
        assertProductionArtifactLayout(root, migrationsRoot),
      ).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(migrationsRoot, { recursive: true, force: true });
    }
  });

  it('rejects an unrelated top-level artifact entry', () => {
    const root = mkdtempSync(join(tmpdir(), 'academic-writing-artifact-'));
    const migrationsRoot = mkdtempSync(
      join(tmpdir(), 'academic-writing-migrations-'),
    );
    try {
      createArtifact(root);
      mkdirSync(join(root, 'tests'), { recursive: true });
      writeFileSync(join(root, 'tests', 'fixture.txt'), 'fixture');
      mkdirSync(migrationsRoot, { recursive: true });
      writeFileSync(
        join(migrationsRoot, migrationName),
        'CREATE TABLE baseline ();',
      );

      expect(() =>
        assertProductionArtifactLayout(root, migrationsRoot),
      ).toThrow(/unexpected top-level artifact entry: tests/);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(migrationsRoot, { recursive: true, force: true });
    }
  });

  it('rejects a migration that differs from the reviewed source', () => {
    const root = mkdtempSync(join(tmpdir(), 'academic-writing-artifact-'));
    const migrationsRoot = mkdtempSync(
      join(tmpdir(), 'academic-writing-migrations-'),
    );
    try {
      createArtifact(root, 'ALTER TABLE drifted ();');
      mkdirSync(migrationsRoot, { recursive: true });
      writeFileSync(
        join(migrationsRoot, migrationName),
        'CREATE TABLE baseline ();',
      );

      expect(() =>
        assertProductionArtifactLayout(root, migrationsRoot),
      ).toThrow(/migration content mismatch/);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(migrationsRoot, { recursive: true, force: true });
    }
  });
});
