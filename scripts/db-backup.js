const { spawnSync: defaultSpawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

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
  const databaseUrl = (env.BACKUP_DATABASE_URL || '').trim();
  if (!databaseUrl) {
    throw new Error('BACKUP_DATABASE_URL is required to create a PostgreSQL backup.');
  }
  return databaseUrl;
}

function databaseIdentity(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!parsed.hostname || !database) throw new Error('PostgreSQL database identity is incomplete.');
  return `${parsed.hostname.toLowerCase()}:${parsed.port || '5432'}/${database}`;
}

function writeProtectedJsonAtomic(filePath, value) {
  if (!filePath || !String(filePath).trim()) throw new Error('BACKUP_EVIDENCE_PATH is required.');
  const target = path.resolve(String(filePath));
  const temp = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.chmodSync(temp, 0o600);
    fs.renameSync(temp, target);
  } catch (error) {
    try { fs.unlinkSync(temp); } catch { /* nothing to clean */ }
    throw error;
  }
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

function runBackup(options = {}) {
  const env = options.env || process.env;
  const databaseUrl = databaseUrlFrom(env);
  const outputPath = options.outputPath || env.BACKUP_OUTPUT_PATH;
  const evidencePath = options.evidencePath || env.BACKUP_EVIDENCE_PATH;
  const spawnSync = options.spawnSync || defaultSpawnSync;
  const now = options.now || (() => new Date().toISOString());
  const invocation = createBackupInvocation({ databaseUrl, outputPath });
  const result = spawnSync(invocation.command, invocation.args, {
    stdio: 'inherit',
    env: verifiedLibpqEnvironment(env, databaseUrl),
  });
  if (!result || result.status !== 0) {
    throw new Error(`pg_dump failed with status ${result?.status ?? 'unknown'}.`);
  }
  let stats;
  try {
    stats = fs.statSync(String(outputPath));
  } catch {
    throw new Error('pg_dump did not create a readable backup file.');
  }
  if (!stats.isFile() || stats.size <= 0) throw new Error('pg_dump created an empty or invalid backup file.');
  fs.chmodSync(String(outputPath), 0o600);
  const backupSha256 = createHash('sha256').update(fs.readFileSync(String(outputPath))).digest('hex');
  writeProtectedJsonAtomic(evidencePath, {
    version: 1,
    status: 'pass',
    backupSha256,
    backupSizeBytes: stats.size,
    sourceDatabaseIdentity: databaseIdentity(databaseUrl),
    createdAt: now(),
  });
  return { backedUp: true, outputPath: String(outputPath), evidencePath: String(evidencePath), backupSha256, backupSizeBytes: stats.size };
}

module.exports = { createBackupInvocation, databaseIdentity, runBackup, writeProtectedJsonAtomic };

if (require.main === module) {
  try {
    const result = runBackup();
    process.stdout.write(`PostgreSQL backup PASS bytes=${result.backupSizeBytes} sha256=${result.backupSha256} receipt=${result.evidencePath}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
