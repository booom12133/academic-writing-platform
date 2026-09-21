'use strict';

const { spawnSync: defaultSpawnSync } = require('node:child_process');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { databaseIdentity, writeProtectedJsonAtomic } = require('./db-backup.js');

const REQUIRED_PGSSLROOTCERT = '/etc/academic-writing-platform/postgres-ca.pem';
const REQUIRED_MIGRATION_COUNT = 5;
const REQUIRED_TABLE_COUNT = 19;
const IDENTITY_QUERY = "SELECT COALESCE(inet_server_addr()::text, '<local>') || '|' || COALESCE(inet_server_port()::text, '<local>') || '|' || current_database();";
const VERIFY_QUERY = `SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN 't' ELSE 'f' END || '|' || (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('app_users','tasks','point_records','recharge_orders','knowledge_documents','knowledge_document_versions','knowledge_chunks','knowledge_source_records','knowledge_source_external_links','knowledge_metadata_assertions','knowledge_imports','knowledge_embedding_indexes','knowledge_chunk_embeddings','zotero_connections','paper_projects','paper_outline_nodes','paper_sections','paper_section_revisions','paper_project_sources')) || '|' || (SELECT count(*) FROM drizzle.__drizzle_migrations) || '|' || current_database();`;

function verifiedLibpqEnvironment(env, databaseUrl) {
  if (env.PGSSLMODE !== 'verify-full') throw new Error('PGSSLMODE=verify-full is required for PostgreSQL tools.');
  if (env.PGSSLROOTCERT !== REQUIRED_PGSSLROOTCERT) throw new Error(`PGSSLROOTCERT=${REQUIRED_PGSSLROOTCERT} is required for PostgreSQL tools.`);
  const parsed = new URL(databaseUrl);
  const sslmode = parsed.searchParams.get('sslmode');
  if (sslmode && sslmode !== 'verify-full') throw new Error('database URL sslmode must be verify-full.');
  const sslrootcert = parsed.searchParams.get('sslrootcert');
  if (sslrootcert && sslrootcert !== REQUIRED_PGSSLROOTCERT) throw new Error('database URL sslrootcert must use the trusted PostgreSQL CA.');
  return { ...env, PGSSLMODE: 'verify-full', PGSSLROOTCERT: REQUIRED_PGSSLROOTCERT };
}

function databaseName(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const name = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!name) throw new Error('Restore database name is required.');
  return name;
}

function createRestoreVerifyInvocations({ liveDatabaseUrl, restoreDatabaseUrl, backupPath }) {
  if (!liveDatabaseUrl || !String(liveDatabaseUrl).trim()) throw new Error('DATABASE_URL is required to identify the live database.');
  if (!restoreDatabaseUrl || !String(restoreDatabaseUrl).trim()) throw new Error('RESTORE_DATABASE_URL is required.');
  if (!backupPath || !String(backupPath).trim()) throw new Error('A backup path is required.');
  return [
    { command: 'psql', args: ['--no-psqlrc', '--set=ON_ERROR_STOP=1', '--dbname', String(liveDatabaseUrl), '--tuples-only', '--no-align', '--command', IDENTITY_QUERY] },
    { command: 'psql', args: ['--no-psqlrc', '--set=ON_ERROR_STOP=1', '--dbname', String(restoreDatabaseUrl), '--tuples-only', '--no-align', '--command', IDENTITY_QUERY] },
    { command: 'pg_restore', args: ['--clean', '--if-exists', '--no-owner', '--dbname', String(restoreDatabaseUrl), String(backupPath)] },
    { command: 'psql', args: ['--no-psqlrc', '--dbname', String(restoreDatabaseUrl), '--tuples-only', '--no-align', '--command', VERIFY_QUERY] },
  ];
}

function assertIsolatedRestore({ liveDatabaseUrl, restoreDatabaseUrl, restoreDatabaseNameConfirm, confirmIsolatedRestore }) {
  if (confirmIsolatedRestore !== true) throw new Error('Restore requires --confirm-isolated-restore.');
  if (!liveDatabaseUrl || !String(liveDatabaseUrl).trim()) throw new Error('DATABASE_URL is required to identify the live database.');
  if (!restoreDatabaseUrl || !String(restoreDatabaseUrl).trim()) throw new Error('RESTORE_DATABASE_URL is required.');
  const liveIdentity = databaseIdentity(liveDatabaseUrl);
  const restoreIdentity = databaseIdentity(restoreDatabaseUrl);
  if (liveIdentity === restoreIdentity) throw new Error('Restore target must not be the live database.');
  const restoreName = databaseName(restoreDatabaseUrl);
  if (!restoreDatabaseNameConfirm || restoreName !== restoreDatabaseNameConfirm) throw new Error('Restore database name confirmation does not match the target.');
  return { liveIdentity, restoreIdentity, restoreName };
}

function parseActualDatabaseIdentity(output, description) {
  const [address, port, databaseName, ...extra] = String(output || '').trim().split('|');
  if (!address || !port || !databaseName || extra.length > 0) throw new Error(`${description} identity check returned an invalid response.`);
  return { identity: `${address}:${port}/${databaseName}`, databaseName };
}

function readActualDatabaseIdentity(invocation, env, spawnSync, description) {
  const result = spawnSync(invocation.command, invocation.args, { encoding: 'utf8', env });
  if (!result || result.status !== 0) throw new Error(`${description} identity check failed with status ${result?.status ?? 'unknown'}.`);
  return parseActualDatabaseIdentity(result.stdout, description);
}

function runRestoreVerify({
  liveDatabaseUrl = process.env.DATABASE_URL,
  restoreDatabaseUrl = process.env.RESTORE_DATABASE_URL,
  restoreDatabaseNameConfirm = process.env.RESTORE_DATABASE_NAME_CONFIRM,
  backupPath = process.env.BACKUP_INPUT_PATH,
  evidencePath = process.env.RESTORE_EVIDENCE_PATH,
  confirmIsolatedRestore = false,
  env = process.env,
  spawnSync = defaultSpawnSync,
  now = () => new Date().toISOString(),
} = {}) {
  assertIsolatedRestore({ liveDatabaseUrl, restoreDatabaseUrl, restoreDatabaseNameConfirm, confirmIsolatedRestore });
  const liveLibpqEnv = verifiedLibpqEnvironment(env, liveDatabaseUrl);
  const restoreLibpqEnv = verifiedLibpqEnvironment(env, restoreDatabaseUrl);
  const invocations = createRestoreVerifyInvocations({ liveDatabaseUrl, restoreDatabaseUrl, backupPath });
  const actualLive = readActualDatabaseIdentity(invocations[0], liveLibpqEnv, spawnSync, 'Live database');
  const actualRestore = readActualDatabaseIdentity(invocations[1], restoreLibpqEnv, spawnSync, 'Restore database');
  if (actualRestore.databaseName !== restoreDatabaseNameConfirm) throw new Error('Actual restore database name does not match the explicit confirmation.');
  if (actualLive.databaseName === actualRestore.databaseName || actualLive.identity === actualRestore.identity) throw new Error('Actual restore target must not be the live database.');
  const restore = spawnSync(invocations[2].command, invocations[2].args, { stdio: 'inherit', env: restoreLibpqEnv });
  if (!restore || restore.status !== 0) throw new Error(`pg_restore failed with status ${restore?.status ?? 'unknown'}.`);
  const verify = spawnSync(invocations[3].command, invocations[3].args, { encoding: 'utf8', env: restoreLibpqEnv });
  if (!verify || verify.status !== 0) throw new Error(`PostgreSQL restore verification failed with status ${verify?.status ?? 'unknown'}.`);
  const output = String(verify.stdout || '').trim();
  if (output !== `t|${REQUIRED_TABLE_COUNT}|${REQUIRED_MIGRATION_COUNT}|${actualRestore.databaseName}`) throw new Error('PostgreSQL restore verification failed schema checks.');
  const backupSha256 = createHash('sha256').update(fs.readFileSync(String(backupPath))).digest('hex');
  writeProtectedJsonAtomic(evidencePath, {
    version: 1,
    status: 'pass',
    backupSha256,
    liveDatabaseIdentity: actualLive.identity,
    restoreDatabaseIdentity: actualRestore.identity,
    isolatedTarget: true,
    vectorExtension: true,
    tableCount: REQUIRED_TABLE_COUNT,
    migrationCount: REQUIRED_MIGRATION_COUNT,
    verifiedAt: now(),
  });
  return { verified: true };
}

module.exports = { assertIsolatedRestore, createRestoreVerifyInvocations, runRestoreVerify };

if (require.main === module) {
  try {
    runRestoreVerify({ confirmIsolatedRestore: process.argv.includes('--confirm-isolated-restore') });
    process.stdout.write('PostgreSQL isolated restore verification PASS.\n');
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
