'use strict';

const fs = require('node:fs');
const path = require('node:path');

const APPROVED_STAGING_ROOT = '/etc/academic-writing-platform/rotation-input';

function validateCandidateMetadata({
  candidatePath,
  metadata,
  approvedRoot = APPROVED_STAGING_ROOT,
}) {
  const candidate = path.resolve(candidatePath);
  const root = path.resolve(approvedRoot);
  if (path.dirname(candidate) !== root || path.basename(candidate) !== 'production.env') {
    throw new Error('candidate must be production.env directly under the approved staging root');
  }
  if (!metadata.parent?.isDirectory || metadata.parent.isSymbolicLink) {
    throw new Error('candidate staging directory must be a real directory');
  }
  if (metadata.parent.uid !== 0 || metadata.parent.gid !== 0) {
    throw new Error('candidate staging directory must be root-owned');
  }
  if ((metadata.parent.mode & 0o777) !== 0o700) {
    throw new Error('candidate staging directory mode must be 700');
  }
  if (metadata.isSymbolicLink) throw new Error('candidate must not be a symlink');
  if (!metadata.isRegularFile) throw new Error('candidate must be a regular file');
  if (metadata.uid !== 0 || metadata.gid !== 0) {
    throw new Error('candidate must be root-owned');
  }
  if ((metadata.mode & 0o777) !== 0o600) {
    throw new Error('candidate mode must be 600');
  }
  return { approved: true, candidatePath: candidate, approvedRoot: root };
}

function validateCandidateFile(candidatePath, approvedRoot = APPROVED_STAGING_ROOT) {
  const candidate = path.resolve(candidatePath);
  const root = path.resolve(approvedRoot);
  const rootStat = fs.lstatSync(root);
  const candidateStat = fs.lstatSync(candidate);
  const parentStat = fs.lstatSync(path.dirname(candidate));
  return validateCandidateMetadata({
    candidatePath: candidate,
    approvedRoot: root,
    metadata: {
      isRegularFile: candidateStat.isFile(),
      isSymbolicLink: candidateStat.isSymbolicLink(),
      uid: candidateStat.uid,
      gid: candidateStat.gid,
      mode: candidateStat.mode,
      parent: {
        isDirectory: rootStat.isDirectory() && parentStat.isDirectory(),
        isSymbolicLink: rootStat.isSymbolicLink() || parentStat.isSymbolicLink(),
        uid: parentStat.uid,
        gid: parentStat.gid,
        mode: parentStat.mode,
      },
    },
  });
}

if (require.main === module) {
  try {
    const [, , candidatePath] = process.argv;
    if (!candidatePath) throw new Error('candidate path is required');
    validateCandidateFile(candidatePath);
    process.stdout.write('candidate=approved\n');
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'candidate validation failed'}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  APPROVED_STAGING_ROOT,
  validateCandidateFile,
  validateCandidateMetadata,
};
