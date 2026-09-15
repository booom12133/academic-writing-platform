import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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
    expect(verify).toContain('P3_DB_ADMIN_PASSWORD must not be stored');
    expect(rotate).toContain('mktemp');
    expect(rotate).toContain('mv -f');
    const rotationContract = readProjectFile('deploy/scripts/rotation-contract.js');
    const roleRotation = readProjectFile('deploy/scripts/rotate-postgres-roles.js');
    expect(roleRotation).toContain('zotero_connections');
    expect(rotationContract).toContain('controller review required');
    expect(rotate).toContain('secret-rotation-complete');
    expect(rotate).toContain('P3_DB_ADMIN_URL');
    expect(rotate).toContain('/dev/tty');
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

  it('resolves pg from app node_modules in the production sibling layout', () => {
    const releaseRoot = mkdtempSync(join(tmpdir(), 'p3-rotation-layout-'));
    try {
      const appRoot = join(releaseRoot, 'app');
      const deployScriptsRoot = join(releaseRoot, 'deploy', 'scripts');
      const appPgRoot = join(appRoot, 'node_modules', 'pg');
      mkdirSync(appPgRoot, { recursive: true });
      mkdirSync(deployScriptsRoot, { recursive: true });
      writeFileSync(
        join(appRoot, 'package.json'),
        JSON.stringify({
          name: 'reviewed-production-app',
          dependencies: { pg: '8.23.0' },
        }),
      );
      writeFileSync(
        join(appPgRoot, 'index.js'),
        'module.exports = { Client: class Client {} };',
      );
      writeFileSync(
        join(appPgRoot, 'package.json'),
        JSON.stringify({ name: 'pg', main: 'index.js' }),
      );
      writeFileSync(
        join(deployScriptsRoot, 'rotation-contract.js'),
        readProjectFile('deploy/scripts/rotation-contract.js'),
      );
      writeFileSync(
        join(deployScriptsRoot, 'rotate-postgres-roles.js'),
        readProjectFile('deploy/scripts/rotate-postgres-roles.js'),
      );

      expect(existsSync(join(releaseRoot, 'deploy', 'node_modules'))).toBe(false);
      expect(readProjectFile('deploy/scripts/rotate-production-env.sh')).toContain(
        '"$role_rotation_script" "$env_file" "$temp_env" "$rotation_mode" "$app_root"',
      );
      const helper = require(join(deployScriptsRoot, 'rotate-postgres-roles.js'));
      expect(helper.loadPgClient(appRoot)).toEqual(expect.any(Function));
    } finally {
      rmSync(releaseRoot, { recursive: true, force: true });
    }
  });

  it('builds a discrete pg admin client config with the runtime-only password', () => {
    const { Client } = require('pg');
    const { createAdminClientConfig } = require('../../deploy/scripts/rotate-postgres-roles.js');
    const runtimeAdminPassword = 'runtime-only-admin-password';
    const config = createAdminClientConfig(
      'postgresql://admin@127.0.0.1:5432/academic_writing',
      runtimeAdminPassword,
      { DATABASE_SSL_CA: 'synthetic-ca' },
    );

    expect(config).toEqual({
      user: 'admin',
      host: '127.0.0.1',
      port: 5432,
      database: 'academic_writing',
      password: runtimeAdminPassword,
      ssl: { ca: 'synthetic-ca', rejectUnauthorized: true },
      connectionTimeoutMillis: 10_000,
    });
    expect(config).not.toHaveProperty('connectionString');

    const client = new Client(config);
    expect(client.connectionParameters.password).toBe(runtimeAdminPassword);
  });

  it('rejects an administrative password when it is present in the candidate env file', () => {
    const { createRotationPlan } = require('../../deploy/scripts/rotation-contract.js');
    const { loadRotationInputs } = require('../../deploy/scripts/rotate-postgres-roles.js');
    const tempRoot = mkdtempSync(join(tmpdir(), 'p3-rotation-candidate-admin-'));
    const currentPath = join(tempRoot, 'current.env');
    const candidatePath = join(tempRoot, 'candidate.env');
    const currentEnv = {
      DATABASE_URL: 'postgresql://academic_writing_app:current@db.example/academic_writing',
      MIGRATION_DATABASE_URL:
        'postgresql://academic_writing_migrator:current@db.example/academic_writing',
      ACADEMIC_SEARCH_CURSOR_SECRET: 'cursor-current',
      ZOTERO_CREDENTIAL_ENCRYPTION_KEY: 'zotero-current',
    };
    const candidateEnv = {
      DATABASE_URL: 'postgresql://academic_writing_app:rotated@db.example/academic_writing',
      MIGRATION_DATABASE_URL:
        'postgresql://academic_writing_migrator:rotated@db.example/academic_writing',
      ACADEMIC_SEARCH_CURSOR_SECRET: 'cursor-rotated',
      ZOTERO_CREDENTIAL_ENCRYPTION_KEY: 'zotero-rotated',
      P3_DB_ADMIN_PASSWORD: 'synthetic-admin-password',
    };
    writeFileSync(currentPath, Object.entries(currentEnv).map(([key, value]) => `${key}=${value}`).join('\n'));
    writeFileSync(candidatePath, Object.entries(candidateEnv).map(([key, value]) => `${key}=${value}`).join('\n'));

    try {
      const inputs = loadRotationInputs(currentPath, candidatePath, {
        P3_DB_ADMIN_PASSWORD: 'runtime-only-admin-password',
      });

      expect(() => createRotationPlan({
        mode: 'INITIAL_COMPROMISE_ROTATION',
        currentEnv: inputs.currentEnv,
        candidateEnv: inputs.candidateEnv,
      })).toThrow(/P3_DB_ADMIN_PASSWORD must not be stored/);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('keeps a runtime-only administrative password out of candidate rotation inputs', () => {
    const { createRotationPlan } = require('../../deploy/scripts/rotation-contract.js');
    const { loadRotationInputs } = require('../../deploy/scripts/rotate-postgres-roles.js');
    const tempRoot = mkdtempSync(join(tmpdir(), 'p3-rotation-runtime-admin-'));
    const currentPath = join(tempRoot, 'current.env');
    const candidatePath = join(tempRoot, 'candidate.env');
    const currentEnv = {
      DATABASE_URL: 'postgresql://academic_writing_app:current@db.example/academic_writing',
      MIGRATION_DATABASE_URL:
        'postgresql://academic_writing_migrator:current@db.example/academic_writing',
      ACADEMIC_SEARCH_CURSOR_SECRET: 'cursor-current',
      ZOTERO_CREDENTIAL_ENCRYPTION_KEY: 'zotero-current',
    };
    const candidateEnv = {
      DATABASE_URL: 'postgresql://academic_writing_app:rotated@db.example/academic_writing',
      MIGRATION_DATABASE_URL:
        'postgresql://academic_writing_migrator:rotated@db.example/academic_writing',
      ACADEMIC_SEARCH_CURSOR_SECRET: 'cursor-rotated',
      ZOTERO_CREDENTIAL_ENCRYPTION_KEY: 'zotero-rotated',
    };
    writeFileSync(currentPath, Object.entries(currentEnv).map(([key, value]) => `${key}=${value}`).join('\n'));
    writeFileSync(candidatePath, Object.entries(candidateEnv).map(([key, value]) => `${key}=${value}`).join('\n'));

    const previousAdminPassword = process.env.P3_DB_ADMIN_PASSWORD;
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.P3_DB_ADMIN_PASSWORD = 'runtime-only-admin-password';
    process.env.DATABASE_URL = 'postgresql://runtime-value@runtime.example/runtime';
    try {
      const inputs = loadRotationInputs(currentPath, candidatePath);

      expect(inputs.adminPassword).toBe('runtime-only-admin-password');
      expect(inputs.candidateEnv).toEqual(candidateEnv);
      expect(inputs.candidateEnv).not.toHaveProperty('P3_DB_ADMIN_PASSWORD');
      expect(inputs.candidateEnv.DATABASE_URL).toBe(candidateEnv.DATABASE_URL);
      expect(createRotationPlan({
        mode: 'INITIAL_COMPROMISE_ROTATION',
        currentEnv: inputs.currentEnv,
        candidateEnv: inputs.candidateEnv,
      }).rolesToRotate).toEqual([
        'academic_writing_app',
        'academic_writing_migrator',
      ]);
    } finally {
      if (previousAdminPassword === undefined) {
        delete process.env.P3_DB_ADMIN_PASSWORD;
      } else {
        process.env.P3_DB_ADMIN_PASSWORD = previousAdminPassword;
      }
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('executes the helper with a runtime-only admin password without printing that password', () => {
    const { spawnSync } = require('node:child_process');
    const tempRoot = mkdtempSync(join(tmpdir(), 'p3-rotation-runtime-output-'));
    const appRoot = join(tempRoot, 'app');
    const appPgRoot = join(appRoot, 'node_modules', 'pg');
    const deployScriptsRoot = join(tempRoot, 'deploy', 'scripts');
    const currentPath = join(tempRoot, 'current.env');
    const candidatePath = join(tempRoot, 'candidate.env');
    const observedPath = join(tempRoot, 'observed.json');
    const syntheticAdminSecret = `synthetic-admin-${process.pid}-${Date.now()}`;
    const envLine = (revision: string) => [
      `DATABASE_URL=postgresql://academic_writing_app:${revision}-app@db.example/academic_writing`,
      `MIGRATION_DATABASE_URL=postgresql://academic_writing_migrator:${revision}-migrator@db.example/academic_writing`,
      `ACADEMIC_SEARCH_CURSOR_SECRET=cursor-${revision}`,
      `ZOTERO_CREDENTIAL_ENCRYPTION_KEY=zotero-${revision}`,
      'DATABASE_SSL_CA=synthetic-ca',
    ].join('\n');

    mkdirSync(appPgRoot, { recursive: true });
    mkdirSync(deployScriptsRoot, { recursive: true });
    writeFileSync(
      join(appRoot, 'package.json'),
      JSON.stringify({
        name: 'reviewed-production-app',
        dependencies: { pg: '8.23.0' },
      }),
    );
    writeFileSync(
      join(appPgRoot, 'package.json'),
      JSON.stringify({ name: 'pg', main: 'index.js' }),
    );
    writeFileSync(
      join(appPgRoot, 'index.js'),
      [
        "const fs = require('node:fs');",
        'class Client {',
        '  constructor(config) {',
        '    fs.writeFileSync(process.env.P3_TEST_OBSERVED_PATH, JSON.stringify({',
        '      adminPasswordWasPassed: config.password === process.env.P3_DB_ADMIN_PASSWORD,',
        '      adminPasswordLength: typeof config.password === \'string\' ? config.password.length : 0,',
        '    }));',
        '  }',
        "  async connect() { throw new Error('synthetic admin connection refusal'); }",
        '  async end() {}',
        '}',
        'module.exports = { Client };',
      ].join('\n'),
    );
    writeFileSync(
      join(deployScriptsRoot, 'rotation-contract.js'),
      readProjectFile('deploy/scripts/rotation-contract.js'),
    );
    writeFileSync(
      join(deployScriptsRoot, 'rotate-postgres-roles.js'),
      readProjectFile('deploy/scripts/rotate-postgres-roles.js'),
    );
    writeFileSync(currentPath, envLine('baseline'));
    writeFileSync(candidatePath, envLine('rotated'));
    expect(readFileSync(candidatePath, 'utf8')).not.toContain('P3_DB_ADMIN_PASSWORD');

    try {
      const result = spawnSync(
        process.execPath,
        [
          join(deployScriptsRoot, 'rotate-postgres-roles.js'),
          currentPath,
          candidatePath,
          'INITIAL_COMPROMISE_ROTATION',
          appRoot,
        ],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            P3_DB_ADMIN_URL: 'postgresql://admin@127.0.0.1:1/academic_writing',
            P3_DB_ADMIN_PASSWORD: syntheticAdminSecret,
            P3_TEST_OBSERVED_PATH: observedPath,
          },
        },
      );
      const output = `${result.stdout}${result.stderr}`;
      expect(result.status).not.toBe(0);
      expect(JSON.parse(readFileSync(observedPath, 'utf8'))).toEqual({
        adminPasswordWasPassed: true,
        adminPasswordLength: syntheticAdminSecret.length,
      });
      expect(output).toContain('synthetic admin connection refusal');
      expect(output).not.toContain(syntheticAdminSecret);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('keeps the admin password inside the hidden runtime boundary and unsets it after the helper', () => {
    const rotationScript = readProjectFile('deploy/scripts/rotate-production-env.sh');

    expect(rotationScript).toContain('read -r -s admin_password </dev/tty');
    expect(rotationScript).toContain('export P3_DB_ADMIN_PASSWORD="$admin_password"');
    expect(rotationScript).toContain('unset P3_DB_ADMIN_PASSWORD');
    expect(rotationScript).not.toContain('P3_DB_ADMIN_PASSWORD="$admin_password" >');
    expect(rotationScript).not.toContain('P3_DB_ADMIN_PASSWORD="${admin_password}" >');
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
    ).toThrow(/MIGRATION_DATABASE_URL password must be changed/);

    expect(() =>
      createRotationPlan({
        mode: 'INITIAL_COMPROMISE_ROTATION',
        currentEnv,
        candidateEnv: {
          ...candidateEnv,
          DATABASE_URL: connection('academic_writing_app', 'baseline'),
        },
      }),
    ).toThrow(/DATABASE_URL password must be changed/);

    expect(() =>
      createRotationPlan({
        mode: 'INITIAL_COMPROMISE_ROTATION',
        currentEnv,
        candidateEnv: {
          ...candidateEnv,
          DATABASE_URL: [
            'postgresql://',
            'academic_writing_app',
            ':',
            Buffer.from('academic_writing_app-baseline').toString('base64url'),
            '@other-db.example/other_database?target_session_attrs=read-write',
          ].join(''),
        },
      }),
    ).toThrow(/DATABASE_URL password must be changed/);

    const passwordRotated = createRotationPlan({
      mode: 'INITIAL_COMPROMISE_ROTATION',
      currentEnv,
      candidateEnv,
    });
    expect(passwordRotated.rolesToRotate).toEqual([
      'academic_writing_app',
      'academic_writing_migrator',
    ]);
    expect(() =>
      createRotationPlan({
        mode: 'INITIAL_COMPROMISE_ROTATION',
        currentEnv,
        candidateEnv: { ...candidateEnv, P3_DB_ADMIN_PASSWORD: 'synthetic-admin-value' },
      }),
    ).toThrow(/P3_DB_ADMIN_PASSWORD must not be stored/);

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

  it('does not print synthetic database password values from the rotation contract CLI', () => {
    const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
    const { tmpdir } = require('node:os');
    const { spawnSync } = require('node:child_process');
    const tempRoot = mkdtempSync(join(tmpdir(), 'p3-rotation-contract-'));
    const currentPath = join(tempRoot, 'current.env');
    const candidatePath = join(tempRoot, 'candidate.env');
    const syntheticPassword = Buffer.from('synthetic-only-password').toString('base64url');
    const envLine = (revision: string) => [
      `DATABASE_URL=postgresql://academic_writing_app:${syntheticPassword}@db.example/academic_writing`,
      `MIGRATION_DATABASE_URL=postgresql://academic_writing_migrator:${syntheticPassword}-${revision}@db.example/academic_writing`,
      `ACADEMIC_SEARCH_CURSOR_SECRET=cursor-${revision}`,
      `ZOTERO_CREDENTIAL_ENCRYPTION_KEY=zotero-${revision}`,
    ].join('\n');
    writeFileSync(currentPath, envLine('baseline'));
    writeFileSync(candidatePath, envLine('rotated'));

    const result = spawnSync(
      process.execPath,
      [join(root, 'deploy/scripts/rotation-contract.js'), currentPath, candidatePath, 'INITIAL_COMPROMISE_ROTATION'],
      { encoding: 'utf8' },
    );
    try {
      expect(`${result.stdout}${result.stderr}`).not.toContain(syntheticPassword);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('requires a root-only candidate staging file before reading production secrets', () => {
    const rotationScript = readProjectFile('deploy/scripts/rotate-production-env.sh');
    const runbook = readProjectFile('docs/deployment/P3_RUNBOOK.md');
    const {
      APPROVED_STAGING_ROOT,
      validateCandidateMetadata,
    } = require('../../deploy/scripts/candidate-input-contract.js');
    const baseMetadata = {
      isRegularFile: true,
      isSymbolicLink: false,
      uid: 0,
      gid: 0,
      mode: 0o600,
      parent: {
        isDirectory: true,
        isSymbolicLink: false,
        uid: 0,
        gid: 0,
        mode: 0o700,
      },
    };

    expect(validateCandidateMetadata({
      candidatePath: `${APPROVED_STAGING_ROOT}/production.env`,
      metadata: baseMetadata,
    })).toMatchObject({ approved: true });
    expect(() => validateCandidateMetadata({
      candidatePath: `${APPROVED_STAGING_ROOT}/production.env`,
      metadata: { ...baseMetadata, mode: 0o644 },
    })).toThrow(/mode.*600/);
    expect(() => validateCandidateMetadata({
      candidatePath: `${APPROVED_STAGING_ROOT}/production.env`,
      metadata: { ...baseMetadata, uid: 1000 },
    })).toThrow(/root-owned/);
    expect(() => validateCandidateMetadata({
      candidatePath: `${APPROVED_STAGING_ROOT}/production.env`,
      metadata: { ...baseMetadata, isSymbolicLink: true },
    })).toThrow(/symlink/);
    expect(() => validateCandidateMetadata({
      candidatePath: '/tmp/production.env',
      metadata: baseMetadata,
    })).toThrow(/approved staging root/);
    expect(rotationScript).toContain('candidate-input-contract.js');
    expect(rotationScript).toContain('rm -f -- "$candidate_file"');
    expect(runbook).toContain('rotation-input');
    expect(runbook).toContain('candidate source is deleted');
    expect(runbook).toContain('0600');
  });

  it('uses a root-only PM2 startup command and validates generated systemd semantics', () => {
    const startupHelper = readProjectFile('deploy/scripts/install-pm2-systemd.sh');
    const serviceCli = readProjectFile('deploy/scripts/pm2-service-cli.sh');
    const {
      PM2_HOME,
      SERVICE_NAME,
      buildRootStartupCommand,
      parseSystemdUnit,
      assertSystemdUnit,
    } = require('../../deploy/scripts/pm2-systemd-contract.js');

    expect(startupHelper).toContain('test "$(id -u)" = "0"');
    expect(startupHelper).toContain('PM2_HOME="$pm2_home"');
    expect(startupHelper).toContain('startup systemd -u "$service_user"');
    expect(startupHelper).not.toContain('pm2-service-cli.sh');
    expect(startupHelper).toContain('systemctl cat "$service_name"');
    expect(startupHelper).toContain('systemctl disable "$service_name"');
    expect(startupHelper).toContain('rm -f -- "$unit_path"');
    expect(startupHelper).toContain('systemctl daemon-reload');
    expect(startupHelper).toContain('systemctl is-enabled "$service_name"');
    expect(startupHelper).not.toContain('--hp');
    expect(serviceCli).toContain('test "$1" != "startup"');

    const command = buildRootStartupCommand('/usr/bin/pm2');
    expect(command.env).toEqual({ PM2_HOME });
    expect(command.args).toEqual([
      '/usr/bin/pm2',
      'startup',
      'systemd',
      '-u',
      'academic-writing',
    ]);
    expect(command.args).not.toContain('--hp');

    const validUnit = [
      '# /etc/systemd/system/pm2-academic-writing.service',
      '[Service]',
      'User=academic-writing',
      'Environment=PM2_HOME=/var/lib/academic-writing-platform/pm2',
      'PIDFile=/var/lib/academic-writing-platform/pm2/pm2.pid',
    ].join('\n');
    expect(parseSystemdUnit(validUnit)).toMatchObject({
      user: 'academic-writing',
      pm2Home: PM2_HOME,
      pidFile: `${PM2_HOME}/pm2.pid`,
    });
    expect(assertSystemdUnit({ serviceName: SERVICE_NAME, unitText: validUnit })).toEqual({
      serviceName: SERVICE_NAME,
      user: 'academic-writing',
      pm2Home: PM2_HOME,
      pidFile: `${PM2_HOME}/pm2.pid`,
    });
    expect(() => assertSystemdUnit({
      serviceName: SERVICE_NAME,
      unitText: validUnit.replace('User=academic-writing', 'User=root'),
    })).toThrow(/User=academic-writing/);
    expect(() => assertSystemdUnit({
      serviceName: SERVICE_NAME,
      unitText: validUnit.replace(`PM2_HOME=${PM2_HOME}`, 'PM2_HOME=/tmp/pm2'),
    })).toThrow(/PM2_HOME/);
    expect(() => assertSystemdUnit({
      serviceName: SERVICE_NAME,
      unitText: validUnit.replace(
        'PIDFile=/var/lib/academic-writing-platform/pm2/pm2.pid',
        'PIDFile=/tmp/pm2.pid',
      ),
    })).toThrow(/PIDFile/);
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
      'scripts/db-migrate.js',
      'scripts/verify-production-database.js',
      'prepare-pm2-state.sh',
      'pm2-service-cli.sh start',
      'install-pm2-systemd.sh',
      'pm2-service-cli.sh save',
      '/health/live',
      '/health/ready',
    ];

    const planSequence = plan.slice(
      plan.indexOf('Commands after authorization [C: production host OS + B: production release app]'),
      plan.indexOf('Tests Before Change:', plan.indexOf('Commands after authorization [C: production host OS + B: production release app]')),
    );
    const runbookSequence = runbook.slice(
      runbook.indexOf('The first deployment command sequence is frozen'),
      runbook.indexOf('The admin/bootstrap process executes'),
    );

    for (const document of [planSequence, runbookSequence]) {
      const positions = requiredOrder.map((token) => document.indexOf(token));
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      expect(document).not.toContain('/health/providers');
    }
    for (const document of [plan, runbook]) {
      expect(document).toContain('current = offline selected release');
      expect(document).toContain('current != deployment accepted');
      expect(document).toContain('systemctl cat pm2-academic-writing.service');
      expect(document).toContain(
        'Environment=PM2_HOME=/var/lib/academic-writing-platform/pm2',
      );
      expect(document).toContain('PM2 startup may enable');
      expect(document).toContain('cleanup');
      expect(document).toContain('deploy/scripts/first-deploy.js');
    }
    const firstDeploy = readProjectFile('deploy/scripts/first-deploy.js');
    expect(firstDeploy).toContain('P3_PART_A_ACTIVATION_PASS');
    expect(firstDeploy).not.toContain('/health/providers');
    expect(firstDeploy).not.toMatch(/migration down|DROP SCHEMA|pg_restore/iu);
    for (const document of [planSequence, runbookSequence]) {
      for (const helper of [
        'rotate-production-env.sh',
        'verify-production-env.sh',
        'prepare-pm2-state.sh',
        'pm2-service-cli.sh',
        'install-pm2-systemd.sh',
      ]) {
        expect(document).toContain(`/opt/academic-writing-platform/current/deploy/scripts/${helper}`);
      }
    }
  });
});
