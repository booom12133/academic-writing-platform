'use strict';

const path = require('node:path');
const { spawn } = require('node:child_process');

const RELEASES_ROOT = '/opt/academic-writing-platform/releases';
const CURRENT_ROOT = '/opt/academic-writing-platform/current';
const PRODUCTION_ENV_FILE = '/etc/academic-writing-platform/production.env';
const ROTATION_CANDIDATE_FILE =
  '/etc/academic-writing-platform/rotation-input/production.env';
const SERVICE_NAME = 'academic-writing-platform';
const ACTIVATION_PASS_LINE = 'P3_PART_A_ACTIVATION_PASS';
const FIRST_DEPLOY_STEPS = Object.freeze([
  'release-install',
  'manifest-verify',
  'offline-select',
  'initial-rotation',
  'env-verify',
  'migration',
  'database-verify',
  'pm2-prepare',
  'pm2-start',
  'systemd-install',
  'pm2-systemd-handoff',
  'live-ready-verify',
]);

function executeFile(command, args, { step, cwd, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: env ?? process.env,
      shell: false,
      stdio: 'inherit',
    });
    child.once('error', () => {
      reject(new Error(`First-deploy step could not start: ${step}.`));
    });
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const result = signal ? `signal ${signal}` : `status ${code ?? 'unknown'}`;
      reject(new Error(`First-deploy step failed: ${step} (${result}).`));
    });
  });
}

function validateOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('first-deploy options are required.');
  }
  const allowedOptions = new Set([
    'reviewedCommitSha',
    'appArtifactDirectory',
    'deployMetadataDirectory',
  ]);
  for (const key of Object.keys(options)) {
    if (!allowedOptions.has(key)) {
      throw new Error(`unsupported first-deploy option: ${key}.`);
    }
  }

  const { reviewedCommitSha, appArtifactDirectory, deployMetadataDirectory } = options;
  if (!/^[0-9a-f]{40}$/u.test(reviewedCommitSha ?? '')) {
    throw new Error('reviewedCommitSha must be a full 40-character lowercase Git SHA.');
  }
  for (const [name, value] of [
    ['appArtifactDirectory', appArtifactDirectory],
    ['deployMetadataDirectory', deployMetadataDirectory],
  ]) {
    if (typeof value !== 'string' || !path.isAbsolute(value)) {
      throw new Error(`${name} must be an absolute path.`);
    }
  }
  return { reviewedCommitSha, appArtifactDirectory, deployMetadataDirectory };
}

async function runFirstDeploy(options, execute = executeFile) {
  const {
    reviewedCommitSha,
    appArtifactDirectory,
    deployMetadataDirectory,
  } = validateOptions(options);
  const releaseRoot = path.posix.join(RELEASES_ROOT, reviewedCommitSha);
  const releaseDeployRoot = path.posix.join(releaseRoot, 'deploy');
  const currentAppRoot = path.posix.join(CURRENT_ROOT, 'app');
  const currentDeployRoot = path.posix.join(CURRENT_ROOT, 'deploy');
  const currentScriptsRoot = path.posix.join(currentDeployRoot, 'scripts');
  const rotationEnvironment = {
    ...process.env,
    P3_SECURITY_SECRET_ROTATION_REQUIRED: 'YES',
  };
  const run = (step, command, args = [], executionOptions = {}) =>
    execute(command, args, { ...executionOptions, step });

  await run(
    'release-install',
    path.resolve(__dirname, 'release-install.sh'),
    [reviewedCommitSha, appArtifactDirectory, deployMetadataDirectory],
  );
  await run('manifest-verify', process.execPath, [
    path.posix.join(releaseDeployRoot, 'scripts', 'release-manifest.js'),
    releaseRoot,
  ]);
  await run(
    'offline-select',
    path.posix.join(releaseDeployRoot, 'scripts', 'release-activate.sh'),
    [reviewedCommitSha],
  );
  await run(
    'initial-rotation',
    path.posix.join(currentScriptsRoot, 'rotate-production-env.sh'),
    [ROTATION_CANDIDATE_FILE, currentAppRoot, 'INITIAL_COMPROMISE_ROTATION'],
    { env: rotationEnvironment },
  );
  await run(
    'env-verify',
    path.posix.join(currentScriptsRoot, 'verify-production-env.sh'),
    [PRODUCTION_ENV_FILE, currentAppRoot],
    { env: rotationEnvironment },
  );
  await run(
    'migration',
    process.execPath,
    [
      `--env-file=${PRODUCTION_ENV_FILE}`,
      path.posix.join(currentAppRoot, 'scripts', 'db-migrate.js'),
    ],
    { cwd: currentAppRoot },
  );
  await run(
    'database-verify',
    process.execPath,
    [
      `--env-file=${PRODUCTION_ENV_FILE}`,
      path.posix.join(currentAppRoot, 'scripts', 'verify-production-database.js'),
    ],
    { cwd: currentAppRoot },
  );
  await run(
    'pm2-prepare',
    path.posix.join(currentScriptsRoot, 'prepare-pm2-state.sh'),
  );
  await run(
    'pm2-start',
    path.posix.join(currentScriptsRoot, 'pm2-service-cli.sh'),
    [
      'start',
      path.posix.join(currentDeployRoot, 'pm2', 'ecosystem.config.cjs'),
      '--only',
      SERVICE_NAME,
    ],
    { env: rotationEnvironment },
  );
  await run(
    'systemd-install',
    path.posix.join(currentScriptsRoot, 'install-pm2-systemd.sh'),
  );
  await run(
    'pm2-systemd-handoff',
    process.execPath,
    [path.posix.join(currentScriptsRoot, 'pm2-systemd-handoff.js')],
    { env: rotationEnvironment },
  );
  await run(
    'live-ready-verify',
    path.posix.join(currentScriptsRoot, 'verify-live.sh'),
    [],
    { env: rotationEnvironment },
  );
}

function cliOptions(argv) {
  if (argv.length !== 3) {
    throw new Error(
      'usage: first-deploy.js <full-commit-sha> <app-artifact-dir> <deploy-dir>',
    );
  }
  return {
    reviewedCommitSha: argv[0],
    appArtifactDirectory: path.resolve(argv[1]),
    deployMetadataDirectory: path.resolve(argv[2]),
  };
}

module.exports = {
  ACTIVATION_PASS_LINE,
  FIRST_DEPLOY_STEPS,
  cliOptions,
  executeFile,
  runFirstDeploy,
  validateOptions,
};

if (require.main === module) {
  let options;
  try {
    options = cliOptions(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'invalid first-deploy options'}\n`);
    process.exitCode = 2;
  }
  if (options) {
    runFirstDeploy(options)
      .then(() => {
        process.stdout.write(`${ACTIVATION_PASS_LINE}\n`);
      })
      .catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.message : 'first-deploy failed'}\n`);
        process.exitCode = 1;
      });
  }
}
