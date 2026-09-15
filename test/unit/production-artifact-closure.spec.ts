import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  assertProductionArtifactLayout,
  classifyArtifactEntry,
} from '../../scripts/test-production-artifact';

const migrationName = '0001_standard_postgres_baseline.sql';

function createArtifact(root: string, migrationContent = 'CREATE TABLE baseline ();') {
  mkdirSync(join(root, 'server'), { recursive: true });
  mkdirSync(join(root, 'dist', 'client'), { recursive: true });
  mkdirSync(join(root, 'client'), { recursive: true });
  mkdirSync(join(root, 'shared'), { recursive: true });
  mkdirSync(join(root, 'sourcemaps'), { recursive: true });
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'drizzle', 'migrations'), { recursive: true });
  writeFileSync(join(root, 'server', 'main.js'), 'runtime');
  writeFileSync(join(root, 'dist', 'client', 'index.html'), 'client');
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
    expect(classifyArtifactEntry('app/node_modules/linked', {
      isSymbolicLink: () => true,
    })).toBe('symlink');
  });

  it('accepts runtime, allow-listed DB scripts, and exact migrations', () => {
    const root = mkdtempSync(join(tmpdir(), 'academic-writing-artifact-'));
    const migrationsRoot = mkdtempSync(join(tmpdir(), 'academic-writing-migrations-'));
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
    const migrationsRoot = mkdtempSync(join(tmpdir(), 'academic-writing-migrations-'));
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

  it('rejects an unrelated top-level artifact entry', () => {
    const root = mkdtempSync(join(tmpdir(), 'academic-writing-artifact-'));
    const migrationsRoot = mkdtempSync(join(tmpdir(), 'academic-writing-migrations-'));
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
    const migrationsRoot = mkdtempSync(join(tmpdir(), 'academic-writing-migrations-'));
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
