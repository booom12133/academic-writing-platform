import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const readProjectFile = (relativePath: string) =>
  require('node:fs').readFileSync(join(root, relativePath), 'utf8');

describe('P3 immutable release integrity contract', () => {
  it('verifies the complete manifest and blocks changed, missing, or extra files', () => {
    const {
      assertRuntimeMode,
      writeReleaseManifest,
      verifyReleaseManifest,
    } = require('../../deploy/scripts/release-manifest.js');
    expect(assertRuntimeMode(0o640)).toBe(true);
    expect(() => assertRuntimeMode(0o660)).toThrow(/runtime-writable/);
    const releaseRoot = mkdtempSync(join(tmpdir(), 'p3-release-'));
    try {
      mkdirSync(join(releaseRoot, 'app', 'server'), { recursive: true });
      mkdirSync(join(releaseRoot, 'deploy', 'pm2'), { recursive: true });
      writeFileSync(join(releaseRoot, 'app', 'server', 'main.js'), 'runtime');
      writeFileSync(join(releaseRoot, 'deploy', 'pm2', 'ecosystem.config.cjs'), 'config');

      writeReleaseManifest(releaseRoot);
      expect(verifyReleaseManifest(releaseRoot, { checkRuntimePermissions: false })).toBe(true);

      writeFileSync(join(releaseRoot, 'app', 'server', 'main.js'), 'tampered');
      expect(() =>
        verifyReleaseManifest(releaseRoot, { checkRuntimePermissions: false }),
      ).toThrow(/mismatch/);

      writeFileSync(join(releaseRoot, 'app', 'server', 'main.js'), 'runtime');
      writeFileSync(join(releaseRoot, 'deploy', 'pm2', 'unexpected.conf'), 'extra');
      expect(() =>
        verifyReleaseManifest(releaseRoot, { checkRuntimePermissions: false }),
      ).toThrow(/file set mismatch/);
    } finally {
      rmSync(releaseRoot, { recursive: true, force: true });
    }
  });

  it('uses one deterministic ordering for migration metadata manifest entries', () => {
    const {
      writeReleaseManifest,
      verifyReleaseManifest,
    } = require('../../deploy/scripts/release-manifest.js');
    const releaseRoot = mkdtempSync(join(tmpdir(), 'p3-release-order-'));
    try {
      mkdirSync(join(releaseRoot, 'app', 'drizzle', 'migrations', 'meta'), {
        recursive: true,
      });
      mkdirSync(join(releaseRoot, 'deploy'), { recursive: true });
      writeFileSync(
        join(releaseRoot, 'app', 'drizzle', 'migrations', 'meta', '_journal.json'),
        'journal',
      );
      writeFileSync(
        join(releaseRoot, 'app', 'drizzle', 'migrations', 'meta', '0001_snapshot.json'),
        'snapshot-1',
      );
      writeFileSync(
        join(releaseRoot, 'app', 'drizzle', 'migrations', 'meta', '0002_snapshot.json'),
        'snapshot-2',
      );
      writeFileSync(join(releaseRoot, 'deploy', 'metadata.txt'), 'deploy');

      writeReleaseManifest(releaseRoot);
      expect(
        verifyReleaseManifest(releaseRoot, { checkRuntimePermissions: false }),
      ).toBe(true);
    } finally {
      rmSync(releaseRoot, { recursive: true, force: true });
    }
  });

  it('uses root-controlled release ownership and verifies before activation or rollback', () => {
    const install = readProjectFile('deploy/scripts/release-install.sh');
    const activate = readProjectFile('deploy/scripts/release-activate.sh');
    const rollback = readProjectFile('deploy/scripts/rollback.sh');

    expect(install).toMatch(/chown -R root:academic-writing/);
    expect(install).not.toMatch(/chown -R academic-writing:academic-writing/);
    expect(install).toMatch(/chmod 750/);
    expect(install).toMatch(/chmod 640/);
    expect(install).toContain('app_artifact/scripts/verify-production-database.js');
    expect(activate.indexOf('release-manifest.js')).toBeGreaterThanOrEqual(0);
    expect(activate.indexOf('release-manifest.js')).toBeLessThan(
      activate.indexOf('ln -sfn'),
    );
    expect(rollback.indexOf('release-manifest.js')).toBeGreaterThanOrEqual(0);
    expect(rollback.indexOf('release-manifest.js')).toBeLessThan(
      rollback.indexOf('ln -sfn'),
    );
    expect(rollback.indexOf('rollback-preflight.js')).toBeGreaterThanOrEqual(0);
    expect(rollback.indexOf('rollback-preflight.js')).toBeLessThan(rollback.indexOf('ln -sfn'));
    expect(rollback).not.toMatch(/db-migrate|pg_restore|DROP SCHEMA/iu);
    expect(existsSync(join(root, 'deploy', 'scripts', 'release-manifest.js'))).toBe(true);
  });

  it('requires authorization and matching recovery receipts before rollback', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { validateRollbackPreflight } = require('../../deploy/scripts/rollback-preflight.js');
    const sha = 'a'.repeat(40);
    const digest = 'b'.repeat(64);
    const regularRootFile = { isFile: () => true, isSymbolicLink: () => false, uid: 0, mode: 0o100600 };
    const inputs = {
      targetReleaseSha: sha,
      env: {
        PRODUCTION_ROLLBACK_AUTHORIZED: 'YES', P3_REVIEWED_ROLLBACK_SHA: sha,
        BACKUP_EVIDENCE_PATH: '/evidence/backup.json', RESTORE_EVIDENCE_PATH: '/evidence/restore.json',
        BACKUP_INPUT_PATH: '/evidence/backup.dump',
      },
      lstat: () => regularRootFile,
      readJson: (path: string) => path.includes('backup.json')
        ? { version: 1, status: 'pass', backupSha256: digest, sourceDatabaseIdentity: 'db:5432/live' }
        : { version: 1, status: 'pass', backupSha256: digest, liveDatabaseIdentity: 'db:5432/live', restoreDatabaseIdentity: 'db:5432/recovery', isolatedTarget: true },
      sha256File: () => digest,
    };
    expect(validateRollbackPreflight(inputs)).toEqual({ authorized: true, targetReleaseSha: sha });
    expect(() => validateRollbackPreflight({ ...inputs, env: { ...inputs.env, PRODUCTION_ROLLBACK_AUTHORIZED: 'NO' } })).toThrow(/PRODUCTION_ROLLBACK_AUTHORIZED=YES/);
    expect(() => validateRollbackPreflight({ ...inputs, readJson: () => ({ version: 1, status: 'pass', backupSha256: digest, liveDatabaseIdentity: 'same', restoreDatabaseIdentity: 'same', isolatedTarget: true }) })).toThrow(/isolated/i);
  });
});
