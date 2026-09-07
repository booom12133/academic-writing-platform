'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { toolInvocation } = require('./platform-command');

const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);

function runNodeScript(script, args = []) {
  const child = spawn(process.execPath, [path.join(__dirname, script), ...args], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 0);
  });
  child.on('error', (error) => {
    console.error(`[dev] failed to start ${script}: ${error.message}`);
    process.exit(1);
  });
}

function main() {
  process.env.RUNTIME_PROFILE = 'local';

  if (process.env.MIAODA_DEP_CACHE_DIR || process.env.SANDBOX_ID) {
    runNodeScript('dev.js', process.argv.slice(2));
    return;
  }

  const localScript = path.join(__dirname, 'dev-local.js');
  if (!fs.existsSync(localScript)) {
    console.error('[dev] scripts/dev-local.js missing; run the project sync first');
    process.exit(1);
  }

  const npx = toolInvocation('npx');
  const syncResult = spawnSync(
    npx.command,
    [...npx.args, '-y', '@lark-apaas/miaoda-cli@latest', 'app', 'sync'],
    { cwd: projectRoot, stdio: 'inherit', env: process.env, shell: npx.shell },
  );
  if (syncResult.error || syncResult.status !== 0) {
    console.error('[dev] miaoda app sync failed; continuing with the current project files');
  }

  runNodeScript('dev-local-compatible.js', process.argv.slice(2));
}

main();
