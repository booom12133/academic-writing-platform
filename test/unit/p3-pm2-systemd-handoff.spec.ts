import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const helperPath = join(
  root,
  'deploy',
  'scripts',
  'pm2-systemd-handoff.js',
);

interface Result {
  code: number;
  stdout?: string;
  stderr?: string;
}

describe('P3 PM2 to systemd ownership handoff', () => {
  it('saves and stops the session daemon before starting the systemd-owned daemon', async () => {
    expect(existsSync(helperPath)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runPm2SystemdHandoff } = require(helperPath);
    const calls: string[] = [];
    const execute = jest.fn(async (command: string, args: string[]): Promise<Result> => {
      calls.push([command, ...args].join(' '));
      if (args[0] === 'is-active') return { code: 3 };
      if (args[0] === 'show') {
        return {
          code: 0,
          stdout: [
            'ActiveState=active',
            'SubState=running',
            'Result=success',
            'ControlGroup=/system.slice/pm2-academic-writing.service',
          ].join('\n'),
        };
      }
      return { code: 0 };
    });

    await expect(
      runPm2SystemdHandoff({
        execute,
        pidFileExists: () => false,
        scriptsRoot: '/release/deploy/scripts',
      }),
    ).resolves.toBeUndefined();

    expect(calls).toEqual([
      'systemctl is-active --quiet pm2-academic-writing.service',
      '/release/deploy/scripts/pm2-service-cli.sh save',
      '/release/deploy/scripts/pm2-service-cli.sh kill',
      'systemctl reset-failed pm2-academic-writing.service',
      'systemctl start pm2-academic-writing.service',
      'systemctl show pm2-academic-writing.service --property=ActiveState --property=SubState --property=Result --property=ControlGroup',
      '/release/deploy/scripts/pm2-service-cli.sh status',
    ]);
  });

  it.each([
    ['save', 1],
    ['kill', 2],
    ['reset-failed', 3],
    ['start', 4],
  ])('fails closed when %s fails', async (failedToken, failedIndex) => {
    expect(existsSync(helperPath)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runPm2SystemdHandoff } = require(helperPath);
    const calls: string[] = [];
    const execute = jest.fn(async (command: string, args: string[]): Promise<Result> => {
      const rendered = [command, ...args].join(' ');
      calls.push(rendered);
      if (args[0] === 'is-active') return { code: 3 };
      return rendered.includes(failedToken) ? { code: 1 } : { code: 0 };
    });

    await expect(
      runPm2SystemdHandoff({
        execute,
        pidFileExists: () => false,
        scriptsRoot: '/release/deploy/scripts',
      }),
    ).rejects.toThrow(new RegExp(failedToken));
    expect(calls).toHaveLength(failedIndex + 1);
    expect(calls.some((call) => call.includes('systemctl show'))).toBe(false);
  });

  it('refuses to stop a daemon when the systemd service is already active', async () => {
    expect(existsSync(helperPath)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runPm2SystemdHandoff } = require(helperPath);
    const execute = jest.fn(async (): Promise<Result> => ({ code: 0 }));

    await expect(
      runPm2SystemdHandoff({
        execute,
        pidFileExists: () => false,
        scriptsRoot: '/release/deploy/scripts',
      }),
    ).rejects.toThrow(/already active/);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale PM2 PID and an invalid systemd ownership state', async () => {
    expect(existsSync(helperPath)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runPm2SystemdHandoff } = require(helperPath);
    const inactive = jest.fn(async (command: string, args: string[]): Promise<Result> => {
      if (args[0] === 'is-active') return { code: 3 };
      return { code: 0 };
    });
    await expect(
      runPm2SystemdHandoff({
        execute: inactive,
        pidFileExists: () => true,
        scriptsRoot: '/release/deploy/scripts',
      }),
    ).rejects.toThrow(/PID file still exists/);

    const wrongCgroup = jest.fn(
      async (command: string, args: string[]): Promise<Result> => {
        if (args[0] === 'is-active') return { code: 3 };
        if (args[0] === 'show') {
          return {
            code: 0,
            stdout: [
              'ActiveState=active',
              'SubState=running',
              'Result=success',
              'ControlGroup=/user.slice/user-1000.slice/session.scope',
            ].join('\n'),
          };
        }
        return { code: 0 };
      },
    );
    await expect(
      runPm2SystemdHandoff({
        execute: wrongCgroup,
        pidFileExists: () => false,
        scriptsRoot: '/release/deploy/scripts',
      }),
    ).rejects.toThrow(/ControlGroup/);
  });
});
