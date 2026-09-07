// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createBackupInvocation, runBackup } = require('../../scripts/db-backup.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRestoreVerifyInvocations, runRestoreVerify } = require('../../scripts/db-restore-verify.js');

describe('PostgreSQL backup and restore wrappers', () => {
  it('builds a custom-format pg_dump invocation without inventing a backup protocol', () => {
    expect(createBackupInvocation({
      databaseUrl: 'postgresql://db.example/academic_writing',
      outputPath: 'backup.dump',
    })).toEqual({
      command: 'pg_dump',
      args: [
        '--format=custom',
        '--no-owner',
        '--file',
        'backup.dump',
        '--dbname',
        'postgresql://db.example/academic_writing',
      ],
    });
  });

  it('returns the native pg_dump failure and does not claim success', () => {
    const spawnSync = jest.fn().mockReturnValue({ status: 1, stderr: Buffer.from('dump failed') });
    expect(() => runBackup({
      databaseUrl: 'postgresql://db.example/academic_writing',
      outputPath: 'backup.dump',
      spawnSync,
    })).toThrow(/pg_dump failed/);
    expect(spawnSync).toHaveBeenCalledWith('pg_dump', expect.any(Array), expect.any(Object));
  });

  it('restores with pg_restore then verifies required schema through psql', () => {
    const spawnSync = jest.fn()
      .mockReturnValueOnce({ status: 0, stdout: Buffer.from('') })
      .mockReturnValueOnce({
        status: 0,
        stdout: Buffer.from('t|14|4\n'),
      });
    expect(runRestoreVerify({
      databaseUrl: 'postgresql://db.example/academic_writing',
      backupPath: 'backup.dump',
      confirmRestore: true,
      spawnSync,
    })).toEqual({ verified: true });
    expect(createRestoreVerifyInvocations({
      databaseUrl: 'postgresql://db.example/academic_writing',
      backupPath: 'backup.dump',
    })).toEqual([
      expect.objectContaining({ command: 'pg_restore' }),
      expect.objectContaining({ command: 'psql' }),
    ]);
  });
});
