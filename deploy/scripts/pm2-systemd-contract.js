'use strict';

const PM2_HOME = '/var/lib/academic-writing-platform/pm2';
const SERVICE_USER = 'academic-writing';
const SERVICE_NAME = 'pm2-academic-writing.service';
const PID_FILE = `${PM2_HOME}/pm2.pid`;

function buildRootStartupCommand(pm2Binary) {
  if (!pm2Binary || pm2Binary.includes('\n') || pm2Binary.includes('\0')) {
    throw new Error('approved PM2 binary is required');
  }
  return {
    env: { PM2_HOME },
    args: [pm2Binary, 'startup', 'systemd', '-u', SERVICE_USER],
  };
}

function unquote(value) {
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  return value;
}

function parseSystemdUnit(unitText) {
  const result = { user: null, pm2Home: null, pidFile: null };
  for (const rawLine of unitText.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.startsWith('User=')) result.user = line.slice('User='.length);
    if (line.startsWith('PIDFile=')) result.pidFile = line.slice('PIDFile='.length);
    if (line.startsWith('Environment=')) {
      const environment = line.slice('Environment='.length)
        .split(/\s+/u)
        .map(unquote);
      const pm2Home = environment.find((entry) => entry.startsWith('PM2_HOME='));
      if (pm2Home) result.pm2Home = pm2Home.slice('PM2_HOME='.length);
    }
  }
  return result;
}

function assertSystemdUnit({ serviceName, unitText }) {
  if (serviceName !== SERVICE_NAME) {
    throw new Error(`service name must be ${SERVICE_NAME}`);
  }
  const parsed = parseSystemdUnit(unitText);
  if (parsed.user !== SERVICE_USER) throw new Error('systemd unit must contain User=academic-writing');
  if (parsed.pm2Home !== PM2_HOME) {
    throw new Error(`systemd unit must contain Environment=PM2_HOME=${PM2_HOME}`);
  }
  if (parsed.pidFile !== PID_FILE) {
    throw new Error(`systemd unit must contain PIDFile=${PID_FILE}`);
  }
  return { serviceName, ...parsed };
}

if (require.main === module) {
  try {
    const [, , mode, serviceName] = process.argv;
    if (mode !== '--verify-unit') throw new Error('unit verification mode is required');
    process.stdin.setEncoding('utf8');
    let unitText = '';
    process.stdin.on('data', (chunk) => { unitText += chunk; });
    process.stdin.on('end', () => {
      const verified = assertSystemdUnit({ serviceName, unitText });
      process.stdout.write(`service=${verified.serviceName}\n`);
      process.stdout.write(`user=${verified.user}\n`);
      process.stdout.write(`pm2_home=${verified.pm2Home}\n`);
      process.stdout.write(`pid_file=${verified.pidFile}\n`);
    });
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'systemd unit verification failed'}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  PM2_HOME,
  SERVICE_NAME,
  SERVICE_USER,
  PID_FILE,
  assertSystemdUnit,
  buildRootStartupCommand,
  parseSystemdUnit,
};
