const { spawnSync: defaultSpawnSync } = require('node:child_process');

const REQUIRED_MIGRATION_COUNT = 4;
const REQUIRED_TABLE_COUNT = 14;
const VERIFY_QUERY = `SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN 't' ELSE 'f' END || '|' || (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('app_users','tasks','point_records','recharge_orders','knowledge_documents','knowledge_document_versions','knowledge_chunks','knowledge_source_records','knowledge_source_external_links','knowledge_metadata_assertions','knowledge_imports','knowledge_embedding_indexes','knowledge_chunk_embeddings','zotero_connections')) || '|' || (SELECT count(*) FROM drizzle.__drizzle_migrations);`;

function createRestoreVerifyInvocations({ databaseUrl, backupPath }) {
  if (!databaseUrl || !String(databaseUrl).trim()) {
    throw new Error('DATABASE_URL is required to restore a PostgreSQL backup.');
  }
  if (!backupPath || !String(backupPath).trim()) {
    throw new Error('A backup path is required.');
  }
  return [
    {
      command: 'pg_restore',
      args: ['--clean', '--if-exists', '--no-owner', '--dbname', String(databaseUrl), String(backupPath)],
    },
    {
      command: 'psql',
      args: ['--no-psqlrc', '--dbname', String(databaseUrl), '--tuples-only', '--no-align', '--command', VERIFY_QUERY],
    },
  ];
}

function runRestoreVerify({
  databaseUrl,
  backupPath,
  confirmRestore = false,
  spawnSync = defaultSpawnSync,
} = {}) {
  if (confirmRestore !== true) {
    throw new Error('Restore requires confirmRestore=true.');
  }
  const invocations = createRestoreVerifyInvocations({ databaseUrl, backupPath });
  const restore = spawnSync(invocations[0].command, invocations[0].args, { stdio: 'inherit' });
  if (!restore || restore.status !== 0) {
    throw new Error(`pg_restore failed with status ${restore?.status ?? 'unknown'}.`);
  }
  const verify = spawnSync(invocations[1].command, invocations[1].args, { encoding: 'utf8' });
  if (!verify || verify.status !== 0) {
    throw new Error(`PostgreSQL restore verification failed with status ${verify?.status ?? 'unknown'}.`);
  }
  const output = String(verify.stdout || '').trim();
  if (output !== `t|${REQUIRED_TABLE_COUNT}|${REQUIRED_MIGRATION_COUNT}`) {
    throw new Error('PostgreSQL restore verification failed schema checks.');
  }
  return { verified: true };
}

module.exports = { createRestoreVerifyInvocations, runRestoreVerify };

if (require.main === module) {
  try {
    runRestoreVerify({
      databaseUrl: process.env.DATABASE_URL,
      backupPath: process.env.BACKUP_INPUT_PATH,
      confirmRestore: process.argv.includes('--confirm-restore'),
    });
    process.stdout.write('PostgreSQL restore verification PASS.\n');
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
