const { spawnSync: defaultSpawnSync } = require('node:child_process');

function databaseUrlFrom(env = process.env) {
  const databaseUrl = (env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to create a PostgreSQL backup.');
  }
  return databaseUrl;
}

function createBackupInvocation({ databaseUrl, outputPath }) {
  if (!databaseUrl || !String(databaseUrl).trim()) {
    throw new Error('DATABASE_URL is required to create a PostgreSQL backup.');
  }
  if (!outputPath || !String(outputPath).trim()) {
    throw new Error('A backup output path is required.');
  }
  return {
    command: 'pg_dump',
    args: [
      '--format=custom',
      '--no-owner',
      '--file',
      String(outputPath),
      '--dbname',
      String(databaseUrl),
    ],
  };
}

function runBackup({
  databaseUrl = databaseUrlFrom(),
  outputPath = process.env.BACKUP_OUTPUT_PATH,
  spawnSync = defaultSpawnSync,
} = {}) {
  const invocation = createBackupInvocation({ databaseUrl, outputPath });
  const result = spawnSync(invocation.command, invocation.args, { stdio: 'inherit' });
  if (!result || result.status !== 0) {
    throw new Error(`pg_dump failed with status ${result?.status ?? 'unknown'}.`);
  }
  return { backedUp: true, outputPath: String(outputPath) };
}

module.exports = { createBackupInvocation, runBackup };

if (require.main === module) {
  try {
    runBackup();
    process.stdout.write('PostgreSQL backup created.\n');
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
