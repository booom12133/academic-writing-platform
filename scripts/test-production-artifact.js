'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const REQUIRED_ARTIFACT_ENTRIES = new Set([
  'api-routes.json',
  'client',
  'page-routes.json',
  'server',
  'shared',
  'sourcemaps',
  'dist',
  'node_modules',
  'package.json',
  'run.sh',
  'scripts',
  'drizzle',
]);
const REQUIRED_ARTIFACT_PATHS = [
  'server/main.js',
  'package.json',
  'run.sh',
  'scripts/db-migrate.js',
  'scripts/db-backup.js',
  'scripts/db-restore-verify.js',
];
const ALLOWED_PRODUCTION_SCRIPTS = new Set([
  'db-migrate.js',
  'db-backup.js',
  'db-restore-verify.js',
]);

function toRelativePath(root, fullPath) {
  return path.relative(root, fullPath).split(path.sep).join('/');
}

function collectFiles(root) {
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (!entry.isSymbolicLink()) {
        files.push(toRelativePath(root, fullPath));
      }
    }
  }
  visit(root);
  return files.sort();
}

function sha256File(filePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex');
}

function assertProductionArtifactLayout(
  root,
  expectedMigrationsRoot = path.resolve(__dirname, '..', 'drizzle', 'migrations'),
) {
  const violations = [];
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error('production artifact root is missing: ' + root);
  }

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!REQUIRED_ARTIFACT_ENTRIES.has(entry.name)) {
      violations.push('unexpected top-level artifact entry: ' + entry.name);
    }
  }

  for (const requiredPath of REQUIRED_ARTIFACT_PATHS) {
    if (!fs.existsSync(path.join(root, requiredPath))) {
      violations.push('missing required artifact path: ' + requiredPath);
    }
  }

  const distRoot = path.join(root, 'dist');
  if (!fs.existsSync(distRoot) || !fs.statSync(distRoot).isDirectory()) {
    violations.push('missing required artifact directory: dist');
  }
  const nodeModulesRoot = path.join(root, 'node_modules');
  if (
    !fs.existsSync(nodeModulesRoot) ||
    !fs.statSync(nodeModulesRoot).isDirectory()
  ) {
    violations.push('missing required artifact directory: node_modules');
  }

  const scriptsRoot = path.join(root, 'scripts');
  if (fs.existsSync(scriptsRoot) && fs.statSync(scriptsRoot).isDirectory()) {
    for (const entry of fs.readdirSync(scriptsRoot, { withFileTypes: true })) {
      if (
        !entry.isFile() ||
        !ALLOWED_PRODUCTION_SCRIPTS.has(entry.name)
      ) {
        violations.push(
          'unexpected production script: ' +
            toRelativePath(root, path.join(scriptsRoot, entry.name)),
        );
      }
    }
  }

  const actualMigrationsRoot = path.join(root, 'drizzle', 'migrations');
  if (
    !fs.existsSync(actualMigrationsRoot) ||
    !fs.statSync(actualMigrationsRoot).isDirectory()
  ) {
    violations.push('missing required artifact directory: drizzle/migrations');
  } else if (
    !fs.existsSync(expectedMigrationsRoot) ||
    !fs.statSync(expectedMigrationsRoot).isDirectory()
  ) {
    violations.push(
      'expected migrations root is missing: ' + expectedMigrationsRoot,
    );
  } else {
    const actualMigrations = collectFiles(actualMigrationsRoot);
    const expectedMigrations = collectFiles(expectedMigrationsRoot);
    if (actualMigrations.join('\n') !== expectedMigrations.join('\n')) {
      violations.push('migration file set mismatch');
    }
    for (const migration of expectedMigrations) {
      const actualPath = path.join(actualMigrationsRoot, migration);
      const expectedPath = path.join(expectedMigrationsRoot, migration);
      if (
        fs.existsSync(actualPath) &&
        sha256File(actualPath) !== sha256File(expectedPath)
      ) {
        violations.push('migration content mismatch: ' + migration);
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      'production artifact layout gate failed: ' + violations.join('; '),
    );
  }
}

function findArtifactViolations(root, forbiddenValues = []) {
  const violations = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      const relativePath = path
        .relative(root, fullPath)
        .split(path.sep)
        .join('/');
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') visit(fullPath);
        continue;
      }
      if (/^\.env(?:\.|$)/u.test(entry.name)) {
        violations.push(relativePath);
        continue;
      }
      if (entry.isSymbolicLink()) continue;
      let content;
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }
      for (const secret of forbiddenValues) {
        if (secret && content.includes(secret)) {
          violations.push(`${relativePath} contains a forbidden secret value`);
          break;
        }
      }
    }
  }
  visit(root);
  return violations;
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

function requestHealth(port, pathname) {
  return new Promise((resolve, reject) => {
    const request = http.get(
      { host: '127.0.0.1', port, path: pathname },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () =>
          resolve({ statusCode: response.statusCode, body }),
        );
      },
    );
    request.once('error', reject);
    request.setTimeout(2_000, () =>
      request.destroy(new Error('health request timed out')),
    );
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForLive(port, child, getStderr = () => '') {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null)
      throw new Error(
        `artifact exited before health check (${child.exitCode}): ${getStderr().slice(-10_000)}`,
      );
    try {
      const result = await requestHealth(port, '/health/live');
      if (result.statusCode === 200 && result.body.includes('"status":"ok"'))
        return;
      lastError = new Error(`unexpected health response: ${result.statusCode}`);
    } catch (error) {
      lastError = error;
    }
    await wait(250);
  }
  throw lastError || new Error('artifact health check timed out');
}

async function run() {
  const root = path.resolve(
    process.env.ARTIFACT_ROOT || path.join(__dirname, '..', 'dist'),
  );
  if (!fs.existsSync(path.join(root, 'server', 'main.js'))) {
    throw new Error(`production artifact is missing server/main.js: ${root}`);
  }
  const expectedMigrationsRoot =
    process.env.EXPECTED_MIGRATIONS_ROOT ||
    path.resolve(__dirname, '..', 'drizzle', 'migrations');
  assertProductionArtifactLayout(root, expectedMigrationsRoot);
  const secrets = [
    'artifact-deepseek-secret',
    'artifact-embedding-secret',
    'artifact-cursor-secret',
    Buffer.alloc(32, 5).toString('base64'),
  ];
  const violations = findArtifactViolations(root, secrets);
  if (violations.length > 0)
    throw new Error(`artifact content gate failed: ${violations.join(', ')}`);

  const storageRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'academic-writing-storage-'),
  );
  const port = await reservePort();
  const child = spawn(process.execPath, ['server/main.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      RUNTIME_PROFILE: 'standalone',
      SERVER_HOST: '127.0.0.1',
      SERVER_PORT: String(port),
      DATABASE_URL:
        'postgresql://postgres:postgres@127.0.0.1:5432/academic_writing_test',
      DOCUMENT_STORAGE_ROOT: storageRoot,
      OIDC_ISSUER_URL: 'https://issuer.example.com',
      OIDC_AUDIENCE: 'academic-writing-platform',
      OIDC_JWKS_URL: 'https://issuer.example.com/.well-known/jwks.json',
      CORS_ALLOWED_ORIGINS: 'https://app.example.com',
      DEEPSEEK_API_KEY: secrets[0],
      DEEPSEEK_DEFAULT_MODEL: 'deepseek-v4-flash',
      EMBEDDING_BASE_URL: 'https://embedding.example.com',
      EMBEDDING_API_KEY: secrets[1],
      EMBEDDING_MODEL: 'embedding-model',
      EMBEDDING_DIMENSIONS: '3',
      EMBEDDING_TIMEOUT_MS: '1000',
      OPENALEX_API_BASE_URL: 'https://api.openalex.org',
      ACADEMIC_SEARCH_CURSOR_SECRET: secrets[2],
      ZOTERO_API_BASE_URL: 'https://api.zotero.org',
      ZOTERO_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 5).toString('base64'),
      ZOTERO_CREDENTIAL_ENCRYPTION_KEY_VERSION: 'v1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  try {
    await waitForLive(port, child, () => stderr);
    child.kill('SIGTERM');
    const exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
    const cleanSignalExit =
      exitCode.code === null && exitCode.signal === 'SIGTERM';
    if (exitCode.code !== 0 && !cleanSignalExit)
      throw new Error(
        `artifact did not shut down cleanly: ${JSON.stringify(exitCode)} ${stderr.slice(-500)}`,
      );
    if (process.platform !== 'win32' && !stdout.includes('Shutdown started'))
      throw new Error(
        `artifact shutdown hook did not report a drain start: ${stdout.slice(-500)} ${stderr.slice(-500)}`,
      );
    console.log('Production artifact startup/health/shutdown PASS.');
  } finally {
    if (child.exitCode === null) child.kill('SIGKILL');
    fs.rmSync(storageRoot, { recursive: true, force: true });
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = {
  assertProductionArtifactLayout,
  findArtifactViolations,
  run,
};
