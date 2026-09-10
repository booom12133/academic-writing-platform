'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function relativeReleasePath(releaseRoot, fullPath) {
  return path.relative(releaseRoot, fullPath).split(path.sep).join('/');
}

function collectReleaseFiles(releaseRoot) {
  const files = [];
  function visit(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error('release contains a symlink');
      }
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      } else {
        throw new Error('release contains a non-regular entry');
      }
    }
  }
  for (const rootName of ['app', 'deploy']) {
    const root = path.join(releaseRoot, rootName);
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      throw new Error(`release root is missing: ${rootName}`);
    }
    visit(root);
  }
  return files.sort();
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function assertRuntimeMode(mode) {
  if ((mode & 0o022) !== 0) {
    throw new Error('release tree is runtime-writable');
  }
  return true;
}

function assertRuntimeReadOnlyRelease(releaseRoot) {
  for (const rootName of ['app', 'deploy']) {
    const root = path.join(releaseRoot, rootName);
    function visit(directory) {
      assertRuntimeMode(fs.statSync(directory).mode);
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error('release contains a symlink');
        if (entry.isDirectory()) visit(fullPath);
        else if (entry.isFile()) assertRuntimeMode(fs.statSync(fullPath).mode);
        else throw new Error('release contains a non-regular entry');
      }
    }
    visit(root);
  }
  return true;
}

function manifestEntries(releaseRoot) {
  return collectReleaseFiles(releaseRoot).map((filePath) => ({
    digest: sha256(filePath),
    relativePath: relativeReleasePath(releaseRoot, filePath),
  }));
}

function writeReleaseManifest(releaseRoot) {
  const manifestPath = path.join(releaseRoot, 'release-manifest.sha256');
  const content = manifestEntries(releaseRoot)
    .map(({ digest, relativePath }) => `${digest}  ${relativePath}`)
    .join('\n') + '\n';
  fs.writeFileSync(manifestPath, content, { encoding: 'utf8', mode: 0o640 });
  fs.chmodSync(manifestPath, 0o640);
  return manifestPath;
}

function readManifest(releaseRoot) {
  const manifestPath = path.join(releaseRoot, 'release-manifest.sha256');
  if (!fs.existsSync(manifestPath) || !fs.statSync(manifestPath).isFile()) {
    throw new Error('release manifest is missing');
  }
  const entries = [];
  for (const line of fs.readFileSync(manifestPath, 'utf8').split(/\r?\n/u)) {
    if (!line) continue;
    const match = /^([0-9a-f]{64})  (.+)$/u.exec(line);
    const relativePath = match?.[2] || '';
    const normalizedPath = path.posix.normalize(relativePath);
    if (
      !match ||
      !/^(?:app|deploy)\/.+/u.test(relativePath) ||
      normalizedPath !== relativePath ||
      relativePath.includes('\0')
    ) {
      throw new Error('release manifest has invalid entries');
    }
    entries.push({ digest: match[1], relativePath });
  }
  if (entries.length === 0) throw new Error('release manifest is empty');
  const paths = entries.map((entry) => entry.relativePath);
  if (new Set(paths).size !== paths.length) throw new Error('release manifest has duplicate entries');
  return entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function verifyReleaseManifest(releaseRoot, { checkRuntimePermissions = true } = {}) {
  if (checkRuntimePermissions) assertRuntimeReadOnlyRelease(releaseRoot);
  const expected = readManifest(releaseRoot);
  const actual = manifestEntries(releaseRoot);
  if (expected.length !== actual.length) throw new Error('release manifest file set mismatch');
  for (let index = 0; index < expected.length; index += 1) {
    if (
      expected[index].relativePath !== actual[index].relativePath ||
      expected[index].digest !== actual[index].digest
    ) {
      throw new Error(`release manifest mismatch: ${expected[index].relativePath}`);
    }
  }
  return true;
}

if (require.main === module) {
  try {
    const [mode, releaseRoot] = process.argv.slice(2);
    if (mode === '--write') {
      writeReleaseManifest(releaseRoot);
      process.stdout.write('release manifest written\n');
    } else {
      verifyReleaseManifest(mode);
      process.stdout.write('release manifest verified\n');
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'release manifest verification failed'}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  assertRuntimeMode,
  assertRuntimeReadOnlyRelease,
  collectReleaseFiles,
  verifyReleaseManifest,
  writeReleaseManifest,
};
