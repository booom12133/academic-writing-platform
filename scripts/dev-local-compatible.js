#!/usr/bin/env node
// Cross-platform local development launcher.
// The generated scripts/dev-local.js is refreshed by app sync, so this stable
// entry point owns only the Windows-compatible process launching details.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { commandForPlatform, toolInvocation } = require('./platform-command');

process.chdir(path.resolve(__dirname, '..'));

function warn(msg) {
  if (process.stderr.isTTY) process.stderr.write(`\x1b[33mWARNING: ${msg}\x1b[0m\n`);
  else process.stderr.write(`WARNING: ${msg}\n`);
}

if (!process.env.MIAODA_APP_TYPE) process.env.MIAODA_APP_TYPE = '3';
process.env.MIAODA_LOCAL_DEV = '1';

const logDir = process.env.LOG_DIR || 'logs';
fs.mkdirSync(logDir, { recursive: true });

function runNpx(args, options = {}) {
  const npx = toolInvocation('npx');
  return spawnSync(npx.command, [...npx.args, ...args], {
    ...options,
    env: process.env,
    shell: npx.shell,
  });
}

// 1. env pull
console.log('[dev-local] (1/5) env pull...');
const hasLarkCli = process.platform === 'win32'
  ? spawnSync('where.exe', ['lark-cli'], { stdio: 'ignore' }).status === 0
  : spawnSync('command', ['-v', 'lark-cli'], { shell: true, stdio: 'ignore' }).status === 0;
if (hasLarkCli) {
  let appId = '';
  try {
    appId = JSON.parse(fs.readFileSync('.spark/meta.json', 'utf8')).app_id || '';
  } catch {
    /* meta.json 不存在或非法 JSON */
  }
  if (appId) {
    const result = spawnSync(
      commandForPlatform('lark-cli'),
      ['apps', '+env-pull', '--app-id', appId, '--as', 'user'],
      { stdio: 'inherit', shell: process.platform === 'win32', env: process.env },
    );
    if (result.status !== 0) warn('env pull 失败，继续按 .env.local 现状启动');
  } else {
    warn('.spark/meta.json 缺 app_id，请先跑 `miaoda app init --app-id <id>`');
  }
} else {
  warn('lark-cli 未安装，跳过 env pull；请确保 .env.local 已就绪');
}

// 2. action-plugin init
console.log('[dev-local] (2/5) action-plugin init...');
try {
  const result = runNpx(['-y', '@lark-apaas/fullstack-cli@latest', 'action-plugin', 'init'], {
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0) throw result.error || new Error('action-plugin init failed');
} catch {
  warn('action-plugin init 失败，继续启动');
}

// 3. skills sync; failure remains non-blocking as in the generated launcher.
console.log('[dev-local] (3/5) miaoda skills sync...');
try {
  const result = runNpx(['-y', '@lark-apaas/miaoda-cli@latest', 'skills', 'sync', '--local'], {
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0) throw result.error || new Error('skills sync failed');
} catch {
  console.log('  (skills sync 失败，继续启动)');
}

// 4. Load .env.local before .env so local values keep priority.
console.log('[dev-local] (4/5) loading .env / .env.local...');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

if (process.env.SUDA_WEBUSER) {
  const raw = process.env.SUDA_WEBUSER;
  try {
    JSON.parse(raw);
  } catch {
    try {
      const unescaped = raw.replace(/\\"/g, '"');
      JSON.parse(unescaped);
      process.env.SUDA_WEBUSER = unescaped;
    } catch {
      warn(`SUDA_WEBUSER 解析失败,值头部: ${raw.slice(0, 80)}...`);
    }
  }
}

// 5. Start the server and client together, teeing output to the existing log.
const devLogPath = path.join(logDir, 'dev.std.log');
console.log('[dev-local] (5/5) 并发起 dev:server + dev:client');
console.log(`[dev-local] 日志: ${devLogPath}`);
const logFd = fs.openSync(devLogPath, 'a');
const npx = toolInvocation('npx');
const child = spawn(
  npx.command,
  [
    ...npx.args,
    '--no-install',
    'concurrently',
    '--names',
    'server,client',
    '--prefix-colors',
    'blue,green',
    '--kill-others-on-fail',
    'npm run dev:server',
    'npm run dev:client',
  ],
  {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    shell: npx.shell,
  },
);

const tee = (src) =>
  src.on('data', (chunk) => {
    try {
      process.stdout.write(chunk);
    } catch {
      /* terminal gone */
    }
    try {
      fs.writeSync(logFd, chunk);
    } catch {
      /* log fd closed */
    }
  });
tee(child.stdout);
tee(child.stderr);

const forward = (sig) => () => {
  try {
    child.kill(sig);
  } catch {
    /* already gone */
  }
};
process.on('SIGTERM', forward('SIGTERM'));
process.on('SIGHUP', forward('SIGHUP'));

child.on('close', (code) => {
  try {
    fs.closeSync(logFd);
  } catch {
    /* already closed */
  }
  process.exit(code ?? 0);
});
child.on('error', (err) => {
  console.error('[dev-local] 启动失败:', err.message);
  console.error('[dev-local] 如缺 concurrently,运行: npm install');
  process.exit(1);
});
