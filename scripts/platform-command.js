'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function commandForPlatform(command, platform = process.platform) {
  return platform === 'win32' ? `${command}.cmd` : command;
}

function toolInvocation(command, platform = process.platform, env = process.env) {
  const npmExecPath = env.npm_execpath;
  if (npmExecPath) {
    const cliPath = path.join(path.dirname(npmExecPath), `${command}-cli.js`);
    if (fs.existsSync(cliPath)) {
      return { command: process.execPath, args: [cliPath], shell: false };
    }
  }

  if (platform === 'win32') {
    const whereResult = spawnSync('where.exe', [command], { encoding: 'utf8' });
    if (whereResult.status === 0 && whereResult.stdout) {
      const shimPath = whereResult.stdout.split(/\r?\n/).find(Boolean);
      if (shimPath) {
        const cliPath = path.join(path.dirname(shimPath), 'node_modules', 'npm', 'bin', `${command}-cli.js`);
        if (fs.existsSync(cliPath)) {
          return { command: process.execPath, args: [cliPath], shell: false };
        }
      }
    }
  }

  return {
    command: commandForPlatform(command, platform),
    args: [],
    shell: platform === 'win32',
  };
}

module.exports = { commandForPlatform, toolInvocation };
