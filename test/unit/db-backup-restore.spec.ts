import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createBackupInvocation, runBackup } = require('../../scripts/db-backup.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRestoreVerifyInvocations, runRestoreVerify } = require('../../scripts/db-restore-verify.js');

const verifiedLibpqEnv = {
  PGSSLMODE: 'verify-full',
  PGSSLROOTCERT: '/etc/academic-writing-platform/postgres-ca.pem',
};

describe('PostgreSQL backup and restore wrappers', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'p3-backup-restore-'));

  it('builds a custom-format pg_dump invocation', () => {
    expect(createBackupInvocation({ databaseUrl: 'postgresql://db.example/academic_writing', outputPath: 'backup.dump' })).toEqual({
      command: 'pg_dump',
      args: ['--format=custom', '--no-owner', '--file', 'backup.dump', '--dbname', 'postgresql://db.example/academic_writing'],
    });
  });

  it('returns the native pg_dump failure and does not claim success', () => {
    const spawnSync = jest.fn().mockReturnValue({ status: 1 });
    expect(() => runBackup({
      outputPath: 'backup.dump', evidencePath: 'backup-receipt.json',
      env: { ...verifiedLibpqEnv, BACKUP_DATABASE_URL: 'postgresql://academic_writing_backup@db.example/academic_writing' }, spawnSync,
    })).toThrow(/pg_dump failed/);
  });

  it('requires the dedicated backup connection and emits a sanitized receipt', () => {
    const chmodSpy = jest.spyOn(require('node:fs'), 'chmodSync');
    const outputPath = join(tempRoot, 'dedicated.dump');
    const evidencePath = join(tempRoot, 'backup-receipt.json');
    const spawnSync = jest.fn().mockImplementation(() => {
      writeFileSync(outputPath, Buffer.from('custom-format-backup'));
      return { status: 0 };
    });
    expect(() => runBackup({ outputPath, evidencePath, env: { ...verifiedLibpqEnv, DATABASE_URL: 'postgresql://app:secret@db.example/live' }, spawnSync })).toThrow(/BACKUP_DATABASE_URL/);
    expect(spawnSync).not.toHaveBeenCalled();

    const result = runBackup({
      outputPath, evidencePath,
      env: { ...verifiedLibpqEnv, BACKUP_DATABASE_URL: 'postgresql://academic_writing_backup:secret@db.example:5432/live' },
      spawnSync, now: () => '2026-09-17T00:00:00.000Z',
    });
    expect(result).toMatchObject({ backedUp: true, outputPath, evidencePath });
    const receipt = JSON.parse(readFileSync(evidencePath, 'utf8'));
    expect(receipt).toEqual(expect.objectContaining({
      version: 1, status: 'pass', backupSizeBytes: 20,
      sourceDatabaseIdentity: 'db.example:5432/live', createdAt: '2026-09-17T00:00:00.000Z',
    }));
    expect(receipt.backupSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(receipt)).not.toContain('secret');
    expect(chmodSpy).toHaveBeenCalledWith(outputPath, 0o600);
    if (process.platform !== 'win32') expect(statSync(outputPath).mode & 0o777).toBe(0o600);
    chmodSpy.mockRestore();
  });

  it('restores only to a confirmed isolated database then writes a receipt', () => {
    const backupPath = join(tempRoot, 'restore-input.dump');
    const evidencePath = join(tempRoot, 'restore-receipt.json');
    writeFileSync(backupPath, Buffer.from('restore-backup'));
    const spawnSync = jest.fn()
      .mockReturnValueOnce({ status: 0, stdout: Buffer.from('10.10.0.5|5432|academic_writing\n') })
      .mockReturnValueOnce({ status: 0, stdout: Buffer.from('10.10.0.5|5432|academic_writing_recovery\n') })
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 0, stdout: Buffer.from('t|20|7|academic_writing_recovery\n') });
    expect(runRestoreVerify({
      liveDatabaseUrl: 'postgresql://app:live-secret@db.example/academic_writing',
      restoreDatabaseUrl: 'postgresql://operator:restore-secret@db.example/academic_writing_recovery',
      restoreDatabaseNameConfirm: 'academic_writing_recovery', backupPath, evidencePath,
      confirmIsolatedRestore: true, env: verifiedLibpqEnv, spawnSync,
      now: () => '2026-09-17T00:01:00.000Z',
    })).toEqual({ verified: true });
    const invocations = createRestoreVerifyInvocations({
      liveDatabaseUrl: 'postgresql://app@db.example/academic_writing',
      restoreDatabaseUrl: 'postgresql://operator@db.example/academic_writing_recovery', backupPath,
    });
    expect(invocations).toEqual([
      expect.objectContaining({ command: 'psql' }), expect.objectContaining({ command: 'psql' }),
      expect.objectContaining({ command: 'pg_restore' }), expect.objectContaining({ command: 'psql' }),
    ]);
    const schemaVerificationQuery = invocations[3].args.at(-1);
    expect(schemaVerificationQuery).toEqual(expect.stringContaining("'paper_projects'"));
    expect(schemaVerificationQuery).toEqual(expect.stringContaining("'paper_outline_nodes'"));
    expect(schemaVerificationQuery).toEqual(expect.stringContaining("'paper_sections'"));
    expect(schemaVerificationQuery).toEqual(expect.stringContaining("'paper_section_revisions'"));
    expect(schemaVerificationQuery).toEqual(expect.stringContaining("'paper_project_sources'"));
    expect(schemaVerificationQuery).toEqual(expect.stringContaining("'paper_exports'"));
    const receipt = JSON.parse(readFileSync(evidencePath, 'utf8'));
    expect(receipt).toEqual(expect.objectContaining({
      version: 1, status: 'pass', liveDatabaseIdentity: '10.10.0.5:5432/academic_writing',
      restoreDatabaseIdentity: '10.10.0.5:5432/academic_writing_recovery', isolatedTarget: true,
      vectorExtension: true, tableCount: 20, migrationCount: 7, verifiedAt: '2026-09-17T00:01:00.000Z',
    }));
    expect(JSON.stringify(receipt)).not.toMatch(/live-secret|restore-secret/u);
  });

  it('proves isolation before spawning pg_restore', () => {
    const backupPath = join(tempRoot, 'isolation.dump');
    writeFileSync(backupPath, Buffer.from('backup'));
    const spawnSync = jest.fn();
    const common = {
      liveDatabaseUrl: 'postgresql://app@db.example/live', restoreDatabaseUrl: 'postgresql://operator@db.example/live',
      restoreDatabaseNameConfirm: 'live', backupPath, evidencePath: join(tempRoot, 'never.json'),
      confirmIsolatedRestore: true, env: verifiedLibpqEnv, spawnSync,
    };
    expect(() => runRestoreVerify(common)).toThrow(/live database/i);
    expect(() => runRestoreVerify({ ...common, restoreDatabaseUrl: 'postgresql://operator@db.example/recovery', restoreDatabaseNameConfirm: 'wrong' })).toThrow(/confirmation/i);
    expect(() => runRestoreVerify({ ...common, restoreDatabaseUrl: 'postgresql://operator@db.example/recovery', restoreDatabaseNameConfirm: 'recovery', confirmIsolatedRestore: false })).toThrow(/confirm-isolated-restore/i);
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it('rejects hostname aliases that resolve to the same actual live database before pg_restore', () => {
    const backupPath = join(tempRoot, 'alias-isolation.dump');
    writeFileSync(backupPath, Buffer.from('backup'));
    const spawnSync = jest.fn()
      .mockReturnValueOnce({ status: 0, stdout: Buffer.from('10.10.0.5|5432|live\n') })
      .mockReturnValueOnce({ status: 0, stdout: Buffer.from('10.10.0.5|5432|live\n') });
    expect(() => runRestoreVerify({
      liveDatabaseUrl: 'postgresql://app@primary.example/live',
      restoreDatabaseUrl: 'postgresql://operator@alias.example/live',
      restoreDatabaseNameConfirm: 'live', backupPath,
      evidencePath: join(tempRoot, 'alias-never.json'), confirmIsolatedRestore: true,
      env: verifiedLibpqEnv, spawnSync,
    })).toThrow(/actual restore target/i);
    expect(spawnSync).toHaveBeenCalledTimes(2);
    expect(spawnSync.mock.calls.some(([command]) => command === 'pg_restore')).toBe(false);
  });

  it('rejects libpq execution without verified TLS', () => {
    const spawnSync = jest.fn();
    expect(() => runBackup({ outputPath: 'backup.dump', evidencePath: 'receipt.json', env: { PGSSLMODE: 'require', PGSSLROOTCERT: verifiedLibpqEnv.PGSSLROOTCERT, BACKUP_DATABASE_URL: 'postgresql://academic_writing_backup@db.example/live' }, spawnSync })).toThrow(/PGSSLMODE=verify-full/);
    expect(() => runRestoreVerify({
      liveDatabaseUrl: 'postgresql://db.example/live', restoreDatabaseUrl: 'postgresql://db.example/recovery',
      restoreDatabaseNameConfirm: 'recovery', backupPath: join(tempRoot, 'restore-input.dump'), evidencePath: join(tempRoot, 'tls-never.json'),
      confirmIsolatedRestore: true, env: { PGSSLMODE: 'verify-full' }, spawnSync,
    })).toThrow(/PGSSLROOTCERT/);
    expect(spawnSync).not.toHaveBeenCalled();
  });
});
