#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const { spawn } = require('node:child_process');

const SERVICE_NAME = 'pm2-academic-writing.service';
const PM2_PID_FILE = '/var/lib/academic-writing-platform/pm2/pm2.pid';
const EXPECTED_CONTROL_GROUP = `/system.slice/${SERVICE_NAME}`;

function executeCommand(command, args, { env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      shell: false,
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
    child.once('error', reject);
    child.once('close', (code, signal) => {
      resolve({ code, signal, stdout, stderr });
    });
  });
}

function parseSystemdState(output) {
  const state = {};
  for (const line of String(output || '').split(/\r?\n/u)) {
    const separator = line.indexOf('=');
    if (separator > 0) {
      state[line.slice(0, separator)] = line.slice(separator + 1);
    }
  }
  return state;
}

function assertSystemdOwnedState(output) {
  const state = parseSystemdState(output);
  const expected = {
    ActiveState: 'active',
    SubState: 'running',
    Result: 'success',
    ControlGroup: EXPECTED_CONTROL_GROUP,
  };
  for (const [property, value] of Object.entries(expected)) {
    if (state[property] !== value) {
      throw new Error(
        `PM2 systemd handoff failed: ${property} must be ${value}, received ${state[property] || 'missing'}`,
      );
    }
  }
  return state;
}

async function runPm2SystemdHandoff({
  execute = executeCommand,
  pidFileExists = fs.existsSync,
  scriptsRoot = __dirname,
} = {}) {
  const pm2Cli = `${scriptsRoot.replace(/[\\/]+$/u, '')}/pm2-service-cli.sh`;
  const pm2Environment = {
    ...process.env,
    P3_SECURITY_SECRET_ROTATION_REQUIRED: 'YES',
  };
  const runChecked = async (label, command, args, options) => {
    const result = await execute(command, args, options);
    if (result.code !== 0) {
      const resultText = result.signal
        ? `signal ${result.signal}`
        : `status ${result.code ?? 'unknown'}`;
      throw new Error(`PM2 systemd handoff ${label} failed (${resultText})`);
    }
    return result;
  };

  const activeProbe = await execute('systemctl', [
    'is-active',
    '--quiet',
    SERVICE_NAME,
  ]);
  if (activeProbe.code === 0) {
    throw new Error(
      'PM2 systemd handoff refused: pm2-academic-writing.service is already active',
    );
  }
  if (activeProbe.code !== 3) {
    throw new Error(
      `PM2 systemd handoff could not establish inactive service state (status ${activeProbe.code ?? 'unknown'})`,
    );
  }

  await runChecked('save', pm2Cli, ['save'], { env: pm2Environment });
  await runChecked('kill', pm2Cli, ['kill'], { env: pm2Environment });
  if (pidFileExists(PM2_PID_FILE)) {
    throw new Error(
      `PM2 systemd handoff failed: PID file still exists after clean daemon stop: ${PM2_PID_FILE}`,
    );
  }
  await runChecked('reset-failed', 'systemctl', [
    'reset-failed',
    SERVICE_NAME,
  ]);
  await runChecked('start', 'systemctl', ['start', SERVICE_NAME]);
  const state = await runChecked('state verification', 'systemctl', [
    'show',
    SERVICE_NAME,
    '--property=ActiveState',
    '--property=SubState',
    '--property=Result',
    '--property=ControlGroup',
  ]);
  assertSystemdOwnedState(state.stdout);
  await runChecked('PM2 status', pm2Cli, ['status'], {
    env: pm2Environment,
  });
}

module.exports = {
  EXPECTED_CONTROL_GROUP,
  PM2_PID_FILE,
  SERVICE_NAME,
  assertSystemdOwnedState,
  executeCommand,
  parseSystemdState,
  runPm2SystemdHandoff,
};

if (require.main === module) {
  if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
    process.stderr.write('PM2 systemd handoff failed: root invocation is required\n');
    process.exitCode = 1;
  } else {
    runPm2SystemdHandoff()
      .then(() => {
        process.stdout.write('PM2 systemd ownership handoff verified\n');
      })
      .catch((error) => {
        process.stderr.write(
          `${error instanceof Error ? error.message : 'PM2 systemd handoff failed'}\n`,
        );
        process.exitCode = 1;
      });
  }
}
