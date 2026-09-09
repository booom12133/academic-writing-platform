const { spawnSync: defaultSpawnSync } = require('node:child_process');

const REQUIRED_PGSSLROOTCERT = '/etc/academic-writing-platform/postgres-ca.pem';

function verifiedLibpqEnvironment(env, databaseUrl) {
  if (env.PGSSLMODE !== 'verify-full') {
    throw new Error('PGSSLMODE=verify-full is required for PostgreSQL tools.');
  }
  if (env.PGSSLROOTCERT !== REQUIRED_PGSSLROOTCERT) {
    throw new Error(`PGSSLROOTCERT=${REQUIRED_PGSSLROOTCERT} is required for PostgreSQL tools.`);
  }
  const parsed = new URL(databaseUrl);
  const sslmode = parsed.searchParams.get('sslmode');
  if (sslmode && sslmode !== 'verify-full') {
    throw new Error('database URL sslmode must be verify-full.');
  }
  const sslrootcert = parsed.searchParams.get('sslrootcert');
  if (sslrootcert && sslrootcert !== REQUIRED_PGSSLROOTCERT) {
    throw new Error('database URL sslrootcert must use the trusted PostgreSQL CA.');
  }
  return { ...env, PGSSLMODE: 'verify-full', PGSSLROOTCERT: REQUIRED_PGSSLROOTCERT };
}

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
  env = process.env,
  spawnSync = defaultSpawnSync,
} = {}) {
  const invocation = createBackupInvocation({ databaseUrl, outputPath });
  const result = spawnSync(invocation.command, invocation.args, {
    stdio: 'inherit',
    env: verifiedLibpqEnvironment(env, databaseUrl),
  });
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
