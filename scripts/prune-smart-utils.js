'use strict';

const fs = require('node:fs');
const path = require('node:path');

function classifyDependencyEntry(entry) {
  if (entry.isSymbolicLink) return 'reject-symlink';
  if (entry.isDirectory) return entry.name === '.bin' ? 'skip' : 'recurse';
  if (entry.isFile) return 'copy';
  return 'reject-entry';
}

function createSymlinkError(sourcePath) {
  const error = new Error(`refusing to copy dependency symlink: ${sourcePath}`);
  error.code = 'PRUNE_SYMLINK';
  return error;
}

function copyDependencyTree(source, destination, stats = { hardLinks: 0, copies: 0 }) {
  const sourceStats = fs.lstatSync(source);
  if (!sourceStats.isDirectory() || sourceStats.isSymbolicLink()) {
    throw createSymlinkError(source);
  }
  if (!fs.existsSync(destination)) fs.mkdirSync(destination, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    const classification = classifyDependencyEntry({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isSymbolicLink: entry.isSymbolicLink(),
      isFile: entry.isFile(),
    });

    if (classification === 'skip') continue;
    if (classification === 'reject-symlink') throw createSymlinkError(sourcePath);
    if (classification === 'reject-entry') {
      throw new Error(`refusing to copy unsupported dependency entry: ${sourcePath}`);
    }
    if (classification === 'recurse') {
      copyDependencyTree(sourcePath, destinationPath, stats);
      continue;
    }

    try {
      fs.linkSync(sourcePath, destinationPath);
      stats.hardLinks++;
    } catch {
      fs.copyFileSync(sourcePath, destinationPath);
      stats.copies++;
    }
  }

  return stats;
}

module.exports = {
  classifyDependencyEntry,
  copyDependencyTree,
};
