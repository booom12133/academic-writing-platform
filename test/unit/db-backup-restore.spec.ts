// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createBackupInvocation, runBackup } = require('../../scripts/db-backup.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRestoreVerifyInvocations, runRestoreVerify } = require('../../scripts/db-restore-verify.js');

const verifiedLibpqEnv = {
  PGSSLMODE: 'verify-full',
  PGSSLROOTCERT: '/etc/academic-writing-platform/postgres-ca.pem',
};

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
      env: verifiedLibpqEnv,
      spawnSync,
    })).toThrow(/pg_dump failed/);
    expect(spawnSync).toHaveBeenCalledWith(
      'pg_dump',
      expect.any(Array),
      expect.objectContaining({
        env: expect.objectContaining(verifiedLibpqEnv),
      }),
    );
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
      env: verifiedLibpqEnv,
      spawnSync,
    })).toEqual({ verified: true });
    expect(createRestoreVerifyInvocations({
      databaseUrl: 'postgresql://db.example/academic_writing',
      backupPath: 'backup.dump',
    })).toEqual([
      expect.objectContaining({ command: 'pg_restore' }),
      expect.objectContaining({ command: 'psql' }),
    ]);
    expect(spawnSync).toHaveBeenNthCalledWith(
      1,
      'pg_restore',
      expect.any(Array),
      expect.objectContaining({
        env: expect.objectContaining(verifiedLibpqEnv),
      }),
    );
    expect(spawnSync).toHaveBeenNthCalledWith(
      2,
      'psql',
      expect.any(Array),
      expect.objectContaining({
        env: expect.objectContaining(verifiedLibpqEnv),
      }),
    );
  });

  it('rejects libpq execution without the verified TLS contract', () => {
    const spawnSync = jest.fn();
    expect(() => runBackup({
      databaseUrl: 'postgresql://db.example/academic_writing',
      outputPath: 'backup.dump',
      env: { PGSSLMODE: 'require', PGSSLROOTCERT: verifiedLibpqEnv.PGSSLROOTCERT },
      spawnSync,
    })).toThrow(/PGSSLMODE=verify-full/);
    expect(spawnSync).not.toHaveBeenCalled();

    expect(() => runRestoreVerify({
      databaseUrl: 'postgresql://db.example/academic_writing',
      backupPath: 'backup.dump',
      confirmRestore: true,
      env: { PGSSLMODE: 'verify-full' },
      spawnSync,
    })).toThrow(/PGSSLROOTCERT/);
    expect(spawnSync).not.toHaveBeenCalled();
  });
});
