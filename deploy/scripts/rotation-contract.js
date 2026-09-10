'use strict';

const fs = require('node:fs');
const { URL } = require('node:url');

const INITIAL_SECRET_KEYS = [
  'DATABASE_URL',
  'MIGRATION_DATABASE_URL',
  'ACADEMIC_SEARCH_CURSOR_SECRET',
  'ZOTERO_CREDENTIAL_ENCRYPTION_KEY',
];
const ROLE_BY_DATABASE_KEY = {
  DATABASE_URL: 'academic_writing_app',
  MIGRATION_DATABASE_URL: 'academic_writing_migrator',
};

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0 || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(line.slice(0, separator))) {
      throw new Error('env file has invalid lines');
    }
    const key = line.slice(0, separator);
    if (Object.hasOwn(values, key)) throw new Error('env file has duplicate keys');
    values[key] = line.slice(separator + 1);
  }
  return values;
}

function assertDatabaseRole(key, value, expectedRole) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid PostgreSQL URL`);
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(`${key} must use PostgreSQL`);
  }
  if (decodeURIComponent(parsed.username) !== expectedRole) {
    throw new Error(`${key} must use role ${expectedRole}`);
  }
  if (!parsed.password) throw new Error(`${key} must contain a rotated credential`);
}

function databasePassword(key, value, expectedRole) {
  assertDatabaseRole(key, value, expectedRole);
  try {
    return decodeURIComponent(new URL(value).password);
  } catch {
    throw new Error(`${key} must contain a valid password component`);
  }
}

function createRotationPlan({ mode, currentEnv = {}, candidateEnv = {} }) {
  if (!['INITIAL_COMPROMISE_ROTATION', 'NORMAL_FUTURE_ROTATION'].includes(mode)) {
    throw new Error('rotation mode is invalid');
  }
  if (Object.hasOwn(candidateEnv, 'P3_DB_ADMIN_PASSWORD')) {
    throw new Error('P3_DB_ADMIN_PASSWORD must not be stored in production.env');
  }
  for (const key of INITIAL_SECRET_KEYS) {
    if (!candidateEnv[key]) throw new Error(`${key} is required`);
  }
  assertDatabaseRole(
    'DATABASE_URL',
    candidateEnv.DATABASE_URL,
    ROLE_BY_DATABASE_KEY.DATABASE_URL,
  );
  assertDatabaseRole(
    'MIGRATION_DATABASE_URL',
    candidateEnv.MIGRATION_DATABASE_URL,
    ROLE_BY_DATABASE_KEY.MIGRATION_DATABASE_URL,
  );

  const currentDatabasePasswords = {};
  const candidateDatabasePasswords = {};
  for (const [key, role] of Object.entries(ROLE_BY_DATABASE_KEY)) {
    if (!Object.hasOwn(currentEnv, key) || !currentEnv[key]) {
      throw new Error(`${key} current value is required for password comparison`);
    }
    currentDatabasePasswords[key] = databasePassword(key, currentEnv[key], role);
    candidateDatabasePasswords[key] = databasePassword(key, candidateEnv[key], role);
  }
  const databasePasswordChanged = Object.keys(ROLE_BY_DATABASE_KEY).filter(
    (key) => currentDatabasePasswords[key] !== candidateDatabasePasswords[key],
  );

  const changedKeys = INITIAL_SECRET_KEYS.filter(
    (key) => currentEnv[key] !== candidateEnv[key],
  );
  if (mode === 'INITIAL_COMPROMISE_ROTATION') {
    for (const key of Object.keys(ROLE_BY_DATABASE_KEY)) {
      if (!databasePasswordChanged.includes(key)) {
        throw new Error(`${key} password must be changed during initial compromise rotation`);
      }
    }
    for (const key of INITIAL_SECRET_KEYS.filter(
      (secretKey) => !Object.hasOwn(ROLE_BY_DATABASE_KEY, secretKey),
    )) {
      if (currentEnv[key] === candidateEnv[key]) {
        throw new Error(`${key} must be changed during initial compromise rotation`);
      }
    }
  }
  const rolesToRotate = Object.keys(ROLE_BY_DATABASE_KEY)
    .filter((key) => databasePasswordChanged.includes(key))
    .map((key) => ROLE_BY_DATABASE_KEY[key]);

  if (mode === 'NORMAL_FUTURE_ROTATION' && changedKeys.length === 0) {
    throw new Error('normal future rotation requires at least one changed secret');
  }

  return {
    mode,
    changedKeys,
    databasePasswordChanged,
    rolesToRotate,
    zoteroKeyChanged: changedKeys.includes('ZOTERO_CREDENTIAL_ENCRYPTION_KEY'),
    createsInitialMarker: mode === 'INITIAL_COMPROMISE_ROTATION',
  };
}

function assertZoteroRotationAllowed({
  keyChanged,
  databaseCheckSucceeded,
  encryptedCredentialCount,
}) {
  if (!keyChanged) return;
  if (!databaseCheckSucceeded || encryptedCredentialCount === null) {
    throw new Error('Zotero database safety check failed; controller review required');
  }
  if (encryptedCredentialCount !== 0) {
    throw new Error('encrypted Zotero credentials exist; controller review required');
  }
}

if (require.main === module) {
  try {
    const [, , currentPath, candidatePath, mode] = process.argv;
    const plan = createRotationPlan({
      mode,
      currentEnv: parseEnvFile(currentPath),
      candidateEnv: parseEnvFile(candidatePath),
    });
    process.stdout.write(`mode=${plan.mode}\n`);
    process.stdout.write(`changed_keys=${plan.changedKeys.join(',')}\n`);
    process.stdout.write(`roles_to_rotate=${plan.rolesToRotate.join(',')}\n`);
    process.stdout.write(`zotero_key_changed=${plan.zoteroKeyChanged ? 'YES' : 'NO'}\n`);
    process.stdout.write(`creates_initial_marker=${plan.createsInitialMarker ? 'YES' : 'NO'}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'rotation contract failed'}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  INITIAL_SECRET_KEYS,
  ROLE_BY_DATABASE_KEY,
  assertZoteroRotationAllowed,
  createRotationPlan,
  parseEnvFile,
};
