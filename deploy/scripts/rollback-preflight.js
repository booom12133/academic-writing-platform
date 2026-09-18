'use strict';

const fs = require('node:fs');
const { createHash } = require('node:crypto');

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function assertProtectedFile(filePath, description, lstat) {
  if (!filePath) throw new Error(`${description} path is required`);
  const stats = lstat(filePath);
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(`${description} must be a regular non-symlink file`);
  if (stats.uid !== 0) throw new Error(`${description} must be root-owned`);
  if ((stats.mode & 0o777) !== 0o600) throw new Error(`${description} must have mode 600`);
}

function validateRollbackPreflight({
  targetReleaseSha,
  env = process.env,
  lstat = fs.lstatSync,
  readJson = readJsonFile,
  sha256File: digestFile = sha256File,
}) {
  if (env.PRODUCTION_ROLLBACK_AUTHORIZED !== 'YES') throw new Error('PRODUCTION_ROLLBACK_AUTHORIZED=YES is required');
  if (!/^[a-f0-9]{40,64}$/u.test(targetReleaseSha || '')) throw new Error('target release SHA is invalid');
  if (env.P3_REVIEWED_ROLLBACK_SHA !== targetReleaseSha) throw new Error('target release SHA does not equal the reviewed rollback SHA');
  const backupReceiptPath = env.BACKUP_EVIDENCE_PATH;
  const restoreReceiptPath = env.RESTORE_EVIDENCE_PATH;
  const backupPath = env.BACKUP_INPUT_PATH;
  assertProtectedFile(backupReceiptPath, 'backup receipt', lstat);
  assertProtectedFile(restoreReceiptPath, 'restore receipt', lstat);
  assertProtectedFile(backupPath, 'backup dump', lstat);
  const backup = readJson(backupReceiptPath);
  const restore = readJson(restoreReceiptPath);
  if (backup.version !== 1 || backup.status !== 'pass' || restore.version !== 1 || restore.status !== 'pass') throw new Error('recovery receipts must be version 1 PASS evidence');
  if (!/^[a-f0-9]{64}$/u.test(backup.backupSha256 || '') || restore.backupSha256 !== backup.backupSha256) throw new Error('recovery receipt backup SHA values do not match');
  if (digestFile(backupPath) !== backup.backupSha256) throw new Error('current backup dump SHA does not match the recovery receipts');
  if (restore.isolatedTarget !== true || !restore.liveDatabaseIdentity || restore.liveDatabaseIdentity === restore.restoreDatabaseIdentity) throw new Error('isolated restore evidence is invalid');
  return { authorized: true, targetReleaseSha };
}

if (require.main === module) {
  try {
    const [, , targetReleaseSha] = process.argv;
    const result = validateRollbackPreflight({ targetReleaseSha });
    process.stdout.write(`rollback_preflight=PASS target=${result.targetReleaseSha}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'rollback preflight failed'}\n`);
    process.exitCode = 1;
  }
}

module.exports = { validateRollbackPreflight };
