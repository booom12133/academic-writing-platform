import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const readProjectFile = (relativePath: string) =>
  readFileSync(join(root, relativePath), 'utf8');

describe('P3 WP6 PM2 state and secret rotation contract', () => {
  const pm2StateRoot = '/var/lib/academic-writing-platform/pm2';
  const envPath = '/etc/academic-writing-platform/production.env';

  it('defines one persistent PM2 state directory for every PM2 lifecycle command', () => {
    const stateScript = readProjectFile('deploy/scripts/prepare-pm2-state.sh');
    const cliScript = readProjectFile('deploy/scripts/pm2-service-cli.sh');
    const pm2Config = readProjectFile('deploy/pm2/ecosystem.config.cjs');
    const plan = readProjectFile('docs/plans/PHASE_P3_IMPLEMENTATION_PLAN.md');
    const runbook = readProjectFile('docs/deployment/P3_RUNBOOK.md');

    expect(stateScript).toContain(`state_root="${pm2StateRoot}"`);
    expect(stateScript).toContain('service_user="academic-writing"');
    expect(stateScript).toContain('service_group="academic-writing"');
    expect(stateScript).toContain('install -d -o "$service_user" -g "$service_group" -m 700');
    expect(stateScript).toContain('service_home="/nonexistent"');
    expect(stateScript).toContain('service_shell="/usr/sbin/nologin"');
    expect(cliScript).toContain(`pm2_home="${pm2StateRoot}"`);
    expect(cliScript).toContain('PM2_HOME="$pm2_home"');
    expect(cliScript).toContain('pm2 "$@"');
    expect(pm2Config).toContain("cwd: '/opt/academic-writing-platform/current/app'");
    expect(plan).toContain(`PM2_HOME=${pm2StateRoot}`);
    expect(runbook).toContain(`PM2_HOME=${pm2StateRoot}`);
  });

  it('defines a root-controlled runtime-readable env file and mandatory rotation gate', () => {
    const verify = readProjectFile('deploy/scripts/verify-production-env.sh');
    const rotate = readProjectFile('deploy/scripts/rotate-production-env.sh');
    const plan = readProjectFile('docs/plans/PHASE_P3_IMPLEMENTATION_PLAN.md');
    const runbook = readProjectFile('docs/deployment/P3_RUNBOOK.md');
    const manifest = readProjectFile('docs/deployment/P3_ENVIRONMENT_MANIFEST.md');

    expect(verify).toContain(`env_file="${envPath}"`);
    expect(verify).toContain('owner="root:academic-writing"');
    expect(verify).toContain('mode="640"');
    expect(verify).toContain('P3_SECURITY_SECRET_ROTATION_REQUIRED');
    expect(verify).toContain('duplicate');
    expect(verify).toContain('sudo -u "$service_user"');
    expect(verify).toContain('node --env-file=');
    expect(rotate).toContain('mktemp');
    expect(rotate).toContain('mv -f');
    const rotationContract = readProjectFile('deploy/scripts/rotation-contract.js');
    const roleRotation = readProjectFile('deploy/scripts/rotate-postgres-roles.js');
    expect(roleRotation).toContain('zotero_connections');
    expect(rotationContract).toContain('controller review required');
    expect(rotate).toContain('secret-rotation-complete');
    expect(rotationContract).toContain('DATABASE_URL');
    expect(rotationContract).toContain('MIGRATION_DATABASE_URL');
    expect(rotationContract).toContain('ACADEMIC_SEARCH_CURSOR_SECRET');
    expect(rotationContract).toContain('ZOTERO_CREDENTIAL_ENCRYPTION_KEY');
    expect(roleRotation).toContain('academic_writing_app');
    expect(roleRotation).toContain('academic_writing_migrator');
    expect(plan).toContain('P3_SECURITY_SECRET_ROTATION_REQUIRED=YES');
    expect(runbook).toContain('P3_SECURITY_SECRET_ROTATION_REQUIRED=YES');
    expect(manifest).toContain('root:academic-writing');
    expect(manifest).toContain('mode 640');
    expect(manifest).not.toMatch(/owner\s+academic-writing:academic-writing/iu);
  });

  it('keeps the WP6 helper scripts outside the immutable app artifact', () => {
    const artifact = readProjectFile('scripts/test-production-artifact.js');
    expect(existsSync(join(root, 'deploy', 'scripts', 'rotate-production-env.sh'))).toBe(true);
    expect(artifact).toContain('ALLOWED_PRODUCTION_SCRIPTS');
    expect(artifact).not.toContain('rotate-production-env.sh');
  });

  it('keeps initial compromise rotation distinct from normal future rotation', () => {
    const {
      createRotationPlan,
      assertZoteroRotationAllowed,
    } = require('../../deploy/scripts/rotation-contract.js');
    const roleRotation = readProjectFile('deploy/scripts/rotate-postgres-roles.js');
    const connection = (role: string, revision: string) =>
      [
        'postgresql://',
        role,
        ':',
        Buffer.from(`${role}-${revision}`).toString('base64url'),
        '@db.example/academic_writing',
      ].join('');
    const opaque = (name: string, revision: string) =>
      Buffer.from(`${name}-${revision}`).toString('base64url');
    const currentEnv = {
      DATABASE_URL: connection('academic_writing_app', 'baseline'),
      MIGRATION_DATABASE_URL: connection('academic_writing_migrator', 'baseline'),
      ACADEMIC_SEARCH_CURSOR_SECRET: opaque('cursor', 'baseline'),
      ZOTERO_CREDENTIAL_ENCRYPTION_KEY: opaque('zotero', 'baseline'),
    };
    const candidateEnv = {
      DATABASE_URL: connection('academic_writing_app', 'rotated'),
      MIGRATION_DATABASE_URL: connection('academic_writing_migrator', 'rotated'),
      ACADEMIC_SEARCH_CURSOR_SECRET: opaque('cursor', 'rotated'),
      ZOTERO_CREDENTIAL_ENCRYPTION_KEY: opaque('zotero', 'rotated'),
    };

    const initial = createRotationPlan({
      mode: 'INITIAL_COMPROMISE_ROTATION',
      currentEnv,
      candidateEnv,
    });
    expect(initial.changedKeys).toEqual([
      'DATABASE_URL',
      'MIGRATION_DATABASE_URL',
      'ACADEMIC_SEARCH_CURSOR_SECRET',
      'ZOTERO_CREDENTIAL_ENCRYPTION_KEY',
    ]);
    expect(initial.rolesToRotate).toEqual([
      'academic_writing_app',
      'academic_writing_migrator',
    ]);
    expect(initial.createsInitialMarker).toBe(true);
    expect(roleRotation).toMatch(/SELECT rolname FROM pg_catalog\.pg_roles/u);
    expect(roleRotation).toMatch(/ALTER ROLE .* PASSWORD/u);
    expect(roleRotation).toContain("await adminClient.query('BEGIN')");
    expect(roleRotation).toContain("await adminClient.query('COMMIT')");
    expect(roleRotation).toContain('SELECT current_user AS current_user');

    const future = createRotationPlan({
      mode: 'NORMAL_FUTURE_ROTATION',
      currentEnv,
      candidateEnv: {
        ...currentEnv,
        ACADEMIC_SEARCH_CURSOR_SECRET: opaque('cursor', 'future'),
      },
    });
    expect(future.changedKeys).toEqual(['ACADEMIC_SEARCH_CURSOR_SECRET']);
    expect(future.rolesToRotate).toEqual([]);
    expect(future.createsInitialMarker).toBe(false);
    expect(() =>
      createRotationPlan({
        mode: 'INITIAL_COMPROMISE_ROTATION',
        currentEnv,
        candidateEnv: { ...candidateEnv, MIGRATION_DATABASE_URL: currentEnv.MIGRATION_DATABASE_URL },
      }),
    ).toThrow(/MIGRATION_DATABASE_URL must be changed/);

    expect(() =>
      assertZoteroRotationAllowed({
        keyChanged: true,
        databaseCheckSucceeded: false,
        encryptedCredentialCount: null,
      }),
    ).toThrow(/controller review required/);
    expect(() =>
      assertZoteroRotationAllowed({
        keyChanged: true,
        databaseCheckSucceeded: true,
        encryptedCredentialCount: 1,
      }),
    ).toThrow(/encrypted Zotero credentials exist/);
    expect(() =>
      assertZoteroRotationAllowed({
        keyChanged: true,
        databaseCheckSucceeded: true,
        encryptedCredentialCount: 0,
      }),
    ).not.toThrow();
  });

  it('freezes the reviewed activation order before any PM2 start', () => {
    const plan = readProjectFile('docs/plans/PHASE_P3_IMPLEMENTATION_PLAN.md');
    const runbook = readProjectFile('docs/deployment/P3_RUNBOOK.md');
    const requiredOrder = [
      'release-install.sh',
      'release-manifest.js',
      'release-activate.sh',
      'INITIAL_COMPROMISE_ROTATION',
      'verify-production-env.sh',
      'prepare-pm2-state.sh',
      'pm2-service-cli.sh start',
      'pm2-service-cli.sh startup',
      'pm2-service-cli.sh save',
    ];

    const planSequence = plan.slice(
      plan.indexOf('Commands after authorization [C: production host OS + B: production release app]'),
      plan.indexOf('Tests Before Change:', plan.indexOf('Commands after authorization [C: production host OS + B: production release app]')),
    );
    const runbookSequence = runbook.slice(
      runbook.indexOf('The first deployment command sequence is frozen'),
      runbook.indexOf('`systemctl cat` must show'),
    );

    for (const document of [planSequence, runbookSequence]) {
      const positions = requiredOrder.map((token) => document.indexOf(token));
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
    for (const document of [plan, runbook]) {
      expect(document).toContain('systemctl cat pm2-academic-writing.service');
      expect(document).toContain(
        'Environment=PM2_HOME=/var/lib/academic-writing-platform/pm2',
      );
    }
  });
});
