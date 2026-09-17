import { resolve } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  ACTIVATION_PASS_LINE,
  FIRST_DEPLOY_STEPS,
  runFirstDeploy,
} = require('../../deploy/scripts/first-deploy.js');

interface RecordedCall {
  command: string;
  args: string[];
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    step: string;
  };
}

const reviewedCommitSha = '0123456789abcdef0123456789abcdef01234567';
const invocationOptions = {
  reviewedCommitSha,
  appArtifactDirectory: resolve('dist'),
  deployMetadataDirectory: resolve('deploy'),
};

function createRecordingExecutor(failStep?: string) {
  const calls: RecordedCall[] = [];
  const execute = jest.fn(
    async (command: string, args: string[], options: RecordedCall['options']) => {
      calls.push({ command, args, options });
      if (options.step === failStep) {
        throw new Error(`synthetic ${failStep} failure`);
      }
    },
  );
  return { calls, execute };
}

describe('P3 first-deploy executable composition', () => {
  it('executes the exact frozen sequence with fixed release paths and no secret arguments', async () => {
    const { calls, execute } = createRecordingExecutor();

    await expect(runFirstDeploy(invocationOptions, execute)).resolves.toBeUndefined();

    expect(calls.map(({ options }) => options.step)).toEqual(FIRST_DEPLOY_STEPS);
    expect(FIRST_DEPLOY_STEPS).toEqual([
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

    const releaseRoot = `/opt/academic-writing-platform/releases/${reviewedCommitSha}`;
    const currentRoot = '/opt/academic-writing-platform/current';
    const call = (step: string) => calls.find(({ options }) => options.step === step)!;
    expect(call('release-install').command).toMatch(/release-install\.sh$/u);
    expect(call('release-install').args).toEqual([
      reviewedCommitSha,
      invocationOptions.appArtifactDirectory,
      invocationOptions.deployMetadataDirectory,
    ]);
    expect(call('manifest-verify').args).toEqual([
      `${releaseRoot}/deploy/scripts/release-manifest.js`,
      releaseRoot,
    ]);
    expect(call('offline-select')).toMatchObject({
      command: `${releaseRoot}/deploy/scripts/release-activate.sh`,
      args: [reviewedCommitSha],
    });
    expect(call('initial-rotation')).toMatchObject({
      command: `${currentRoot}/deploy/scripts/rotate-production-env.sh`,
      args: [
        '/etc/academic-writing-platform/rotation-input/production.env',
        `${currentRoot}/app`,
        'INITIAL_COMPROMISE_ROTATION',
      ],
    });
    expect(call('env-verify').args).toEqual([
      '/etc/academic-writing-platform/production.env',
      `${currentRoot}/app`,
    ]);
    expect(call('migration').args).toEqual([
      '--env-file=/etc/academic-writing-platform/production.env',
      `${currentRoot}/app/scripts/db-migrate.js`,
    ]);
    expect(call('database-verify').args).toEqual([
      '--env-file=/etc/academic-writing-platform/production.env',
      `${currentRoot}/app/scripts/verify-production-database.js`,
    ]);
    expect(call('migration').options.cwd).toBe(`${currentRoot}/app`);
    expect(call('database-verify').options.cwd).toBe(`${currentRoot}/app`);
    expect(call('pm2-start').args).toEqual([
      'start',
      `${currentRoot}/deploy/pm2/ecosystem.config.cjs`,
      '--only',
      'academic-writing-platform',
    ]);
    expect(call('pm2-systemd-handoff')).toMatchObject({
      command: process.execPath,
      args: [`${currentRoot}/deploy/scripts/pm2-systemd-handoff.js`],
    });
    expect(call('live-ready-verify').command).toBe(
      `${currentRoot}/deploy/scripts/verify-live.sh`,
    );

    const argumentText = calls.flatMap(({ args }) => args).join('\n');
    expect(argumentText).not.toMatch(/password|token|secret|\/health\/providers/iu);
    expect(ACTIVATION_PASS_LINE).toBe('P3_PART_A_ACTIVATION_PASS');
    expect(ACTIVATION_PASS_LINE).not.toMatch(/accepted/iu);
  });

  it.each([
    [
      'migration',
      ['database-verify', 'pm2-prepare', 'pm2-start', 'systemd-install', 'pm2-save', 'live-ready-verify'],
    ],
    [
      'database-verify',
      ['pm2-prepare', 'pm2-start', 'systemd-install', 'pm2-save', 'live-ready-verify'],
    ],
  ])('stops after a %s failure before every later activation step', async (failStep, absentSteps) => {
    const { calls, execute } = createRecordingExecutor(failStep);

    await expect(runFirstDeploy(invocationOptions, execute)).rejects.toThrow(
      `synthetic ${failStep} failure`,
    );
    const calledSteps = calls.map(({ options }) => options.step);
    for (const absentStep of absentSteps) {
      expect(calledSteps).not.toContain(absentStep);
    }
  });

  it('does not reverse the database or release after PM2 start failure', async () => {
    const { calls, execute } = createRecordingExecutor('pm2-start');

    await expect(runFirstDeploy(invocationOptions, execute)).rejects.toThrow(
      'synthetic pm2-start failure',
    );
    expect(calls.map(({ options }) => options.step)).toEqual(
      FIRST_DEPLOY_STEPS.slice(0, FIRST_DEPLOY_STEPS.indexOf('pm2-start') + 1),
    );
    const invocationText = calls
      .flatMap(({ command, args }) => [command, ...args])
      .join('\n');
    expect(invocationText).not.toMatch(
      /rollback|migration[ -]?down|drop[ _-]?schema|pg_restore|release-activate.*previous/iu,
    );
  });

  it.each(['systemd-install', 'pm2-systemd-handoff', 'live-ready-verify'])(
    'does not emit an accepted result when %s fails',
    async (failStep) => {
      const { execute } = createRecordingExecutor(failStep);
      const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      try {
        await expect(runFirstDeploy(invocationOptions, execute)).rejects.toThrow(
          `synthetic ${failStep} failure`,
        );
        expect(stdout).not.toHaveBeenCalled();
      } finally {
        stdout.mockRestore();
      }
    },
  );

  it('rejects non-full SHAs and non-path option fields before executing', async () => {
    const { execute } = createRecordingExecutor();

    await expect(
      runFirstDeploy({ ...invocationOptions, reviewedCommitSha: 'abc123' }, execute),
    ).rejects.toThrow(/full 40-character/);
    await expect(
      runFirstDeploy({ ...invocationOptions, password: 'forbidden' }, execute),
    ).rejects.toThrow(/unsupported first-deploy option/);
    expect(execute).not.toHaveBeenCalled();
  });
});
