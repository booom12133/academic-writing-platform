import { execFileSync, spawn } from 'node:child_process';
import {
  existsSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client, type ClientConfig } from 'pg';

const PROJECT_ROOT = resolve(__dirname, '..', '..');
const ENV_DIR = '/etc/academic-writing-platform';
const CURRENT_ENV_PATH = `${ENV_DIR}/production.env`;
const CANDIDATE_ENV_PATH = `${ENV_DIR}/rotation-input/production.env`;
const ROTATION_MARKER = `${ENV_DIR}/secret-rotation-complete`;
const DEFAULT_CA_PATH = `${ENV_DIR}/postgres-ca.pem`;
const DATABASE_NAME = 'academic_writing';
const DATABASE_PORT = 5432;

type EnvValues = Record<string, string>;

export type RotationResult = {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
};

export type ConnectionOverrides = {
  ca?: string;
  host?: string;
  password?: string;
};

function runSudo(args: string[]): string {
  return execFileSync('sudo', ['-n', ...args], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function requirePrerequisite(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Step5B prerequisite missing: ${message}`);
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

function databaseUrl(role: string, password: string, host: string, caPath: string): string {
  return [
    `postgresql://${role}:${encode(password)}@${host}:${DATABASE_PORT}/${DATABASE_NAME}`,
    `?sslmode=verify-full&sslrootcert=${encode(caPath)}`,
  ].join('');
}

function envText(values: EnvValues): string {
  return `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n')}\n`;
}

function readRootFile(filePath: string): string {
  return runSudo(['cat', '--', filePath]);
}

function installRootFile(sourcePath: string, targetPath: string, owner: string, mode: string): void {
  runSudo(['install', '-o', owner.split(':')[0], '-g', owner.split(':')[1], '-m', mode, sourcePath, targetPath]);
}

export function createStep5BFixture() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'p3-wp6-step5b-'));
  const caPath = process.env.P3_WP6_CA_PATH || DEFAULT_CA_PATH;
  const appRoot = process.env.P3_WP6_APP_ROOT || join(tempRoot, 'app');
  const databaseHost = process.env.P3_WP6_DATABASE_HOST || 'db.academic-writing.internal';
  const bootstrapPassword = process.env.P3_WP6_BOOTSTRAP_PASSWORD || 'synthetic-bootstrap-password';
  const adminPassword = `synthetic-admin-${process.pid}-${Date.now()}`;
  const wrongPassword = `${adminPassword}-wrong`;
  const wrongCa = '-----BEGIN CERTIFICATE-----\nwrong-ca\n-----END CERTIFICATE-----\n';
  const storageRoot = join(tempRoot, 'documents');
  const appOldPassword = `old-app-${process.pid}`;
  const appNewPassword = `new-app-${process.pid}`;
  const migratorOldPassword = `old-migrator-${process.pid}`;
  const migratorNewPassword = `new-migrator-${process.pid}`;

  let currentEnv: EnvValues;
  let candidateEnv: EnvValues;
  let filesystemPrepared = false;

  function buildEnv(revision: 'old' | 'new', appHost = databaseHost): EnvValues {
    const isNew = revision === 'new';
    return {
      NODE_ENV: 'production',
      RUNTIME_PROFILE: 'standalone',
      SERVER_HOST: '127.0.0.1',
      SERVER_PORT: '3000',
      DATABASE_URL: databaseUrl(
        'academic_writing_app',
        isNew ? appNewPassword : appOldPassword,
        appHost,
        caPath,
      ),
      MIGRATION_DATABASE_URL: databaseUrl(
        'academic_writing_migrator',
        isNew ? migratorNewPassword : migratorOldPassword,
        databaseHost,
        caPath,
      ),
      DOCUMENT_STORAGE_ROOT: storageRoot,
      DATABASE_SSL_CA_FILE: caPath,
      PGSSLMODE: 'verify-full',
      PGSSLROOTCERT: caPath,
      OIDC_PROVIDER: 'Auth0',
      OIDC_CLIENT_ID: 'synthetic-client-id',
      OIDC_ISSUER_URL: 'https://auth.example.invalid/',
      OIDC_JWKS_URL: 'https://auth.example.invalid/.well-known/jwks.json',
      OIDC_AUDIENCE: 'synthetic-audience',
      OIDC_USER_ID_CLAIM: 'sub',
      OIDC_ALLOWED_ALGORITHMS: 'RS256',
      OIDC_REDIRECT_URI: 'https://write.yingrenji.cn/auth/callback',
      OIDC_POST_LOGOUT_REDIRECT_URI: 'https://write.yingrenji.cn/login',
      CORS_ALLOWED_ORIGINS: 'https://write.yingrenji.cn',
      DEEPSEEK_API_KEY: 'synthetic-deepseek-key',
      DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
      DEEPSEEK_DEFAULT_MODEL: 'deepseek-chat',
      EMBEDDING_BASE_URL: 'https://api.siliconflow.cn/v1',
      EMBEDDING_API_KEY: 'synthetic-embedding-key',
      EMBEDDING_MODEL: 'BAAI/bge-m3',
      EMBEDDING_DIMENSIONS: '1024',
      EMBEDDING_TIMEOUT_MS: '5000',
      OPENALEX_API_BASE_URL: 'https://api.openalex.org',
      ACADEMIC_SEARCH_CURSOR_SECRET: `synthetic-cursor-${revision}`,
      ZOTERO_API_BASE_URL: 'https://api.zotero.org',
      ZOTERO_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(isNew ? 32 : 32, isNew ? 8 : 7).toString('base64'),
      ZOTERO_CREDENTIAL_ENCRYPTION_KEY_VERSION: 'v1',
    };
  }

  function postgresConfig(
    user: string,
    password: string,
    overrides: ConnectionOverrides = {},
  ): ClientConfig {
    return {
      user,
      password,
      host: overrides.host || databaseHost,
      port: DATABASE_PORT,
      database: DATABASE_NAME,
      ssl: {
        ca: overrides.ca || runSudo(['cat', '--', caPath]),
        rejectUnauthorized: true,
      },
      connectionTimeoutMillis: 5_000,
    };
  }

  async function withBootstrap<T>(operation: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client(postgresConfig('postgres', bootstrapPassword));
    await client.connect();
    try {
      return await operation(client);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  async function setRolePassword(client: Client, role: string, password: string): Promise<void> {
    const literalResult = await client.query(
      'SELECT quote_literal($1) AS literal',
      [password],
    );
    await client.query(`ALTER ROLE "${role}" PASSWORD ${literalResult.rows[0].literal}`);
  }

  async function createRole(
    client: Client,
    role: string,
    options: string,
    password: string,
  ): Promise<void> {
    const literalResult = await client.query(
      'SELECT quote_literal($1) AS literal',
      [password],
    );
    await client.query(
      `CREATE ROLE "${role}" ${options} PASSWORD ${literalResult.rows[0].literal}`,
    );
  }

  async function resetDatabase(): Promise<void> {
    await withBootstrap(async (client) => {
      const roleResult = await client.query(
        `SELECT rolname
         FROM pg_catalog.pg_roles
         WHERE rolname = ANY($1::text[])`,
        [['p3_rotation_admin', 'academic_writing_app', 'academic_writing_migrator']],
      );
      const existingRoles = new Set(roleResult.rows.map((row) => row.rolname));
      if (!existingRoles.has('academic_writing_app')) {
        await createRole(client, 'academic_writing_app', 'LOGIN', appOldPassword);
      }
      if (!existingRoles.has('academic_writing_migrator')) {
        await createRole(client, 'academic_writing_migrator', 'LOGIN', migratorOldPassword);
      }
      if (!existingRoles.has('p3_rotation_admin')) {
        await createRole(
          client,
          'p3_rotation_admin',
          'LOGIN NOINHERIT CREATEROLE',
          adminPassword,
        );
      }
      await setRolePassword(client, 'p3_rotation_admin', adminPassword);
      await setRolePassword(client, 'academic_writing_app', appOldPassword);
      await setRolePassword(client, 'academic_writing_migrator', migratorOldPassword);
      await client.query('GRANT academic_writing_app TO p3_rotation_admin WITH ADMIN OPTION');
      await client.query('GRANT academic_writing_migrator TO p3_rotation_admin WITH ADMIN OPTION');
      await client.query('GRANT SELECT ON TABLE public.zotero_connections TO p3_rotation_admin');
      await client.query('TRUNCATE TABLE public.zotero_connections');
    });
  }

  async function provisionDatabase(): Promise<void> {
    await withBootstrap(async (client) => {
      await client.query('DROP TABLE IF EXISTS public.zotero_connections');
      await client.query('DROP ROLE IF EXISTS p3_rotation_admin');
      await client.query('DROP ROLE IF EXISTS academic_writing_app');
      await client.query('DROP ROLE IF EXISTS academic_writing_migrator');
      await createRole(client, 'academic_writing_app', 'LOGIN', appOldPassword);
      await createRole(client, 'academic_writing_migrator', 'LOGIN', migratorOldPassword);
      await createRole(
        client,
        'p3_rotation_admin',
        'LOGIN NOINHERIT CREATEROLE',
        adminPassword,
      );
      await client.query(`
        CREATE TABLE public.zotero_connections (
          id integer PRIMARY KEY,
          encrypted_credentials text
        )
      `);
      await client.query('GRANT academic_writing_app TO p3_rotation_admin WITH ADMIN OPTION');
      await client.query('GRANT academic_writing_migrator TO p3_rotation_admin WITH ADMIN OPTION');
      await client.query('GRANT SELECT ON TABLE public.zotero_connections TO p3_rotation_admin');
    });
  }

  function prepareFilesystem(): void {
    runSudo(['install', '-d', '-o', 'root', '-g', 'root', '-m', '755', ENV_DIR]);
    runSudo(['install', '-d', '-o', 'root', '-g', 'root', '-m', '700', `${ENV_DIR}/rotation-input`]);
    runSudo(['rm', '-f', '--', ROTATION_MARKER, CURRENT_ENV_PATH, CANDIDATE_ENV_PATH]);

    const currentSource = join(tempRoot, 'current.env');
    const candidateSource = join(tempRoot, 'candidate.env');
    writeFileSync(currentSource, envText(currentEnv));
    writeFileSync(candidateSource, envText(candidateEnv));
    installRootFile(currentSource, CURRENT_ENV_PATH, 'root:academic-writing', '640');
    installRootFile(candidateSource, CANDIDATE_ENV_PATH, 'root:root', '600');
  }

  function assertProductionEnvDoesNotContain(secret: string): void {
    expect(readRootFile(CURRENT_ENV_PATH)).not.toContain(secret);
    expect(readRootFile(CANDIDATE_ENV_PATH)).not.toContain(secret);
  }

  function fileState(filePath: string): { exists: boolean; owner?: string; mode?: string } {
    try {
      return {
        exists: true,
        owner: runSudo(['stat', '-c', '%U:%G', '--', filePath]).trim(),
        mode: runSudo(['stat', '-c', '%a', '--', filePath]).trim(),
      };
    } catch {
      return { exists: false };
    }
  }

  async function connect(
    user: string,
    password: string,
    overrides: ConnectionOverrides = {},
  ): Promise<Client> {
    const client = new Client(postgresConfig(user, password, overrides));
    try {
      await client.connect();
      return client;
    } catch (error) {
      await client.end().catch(() => undefined);
      throw error;
    }
  }

  return {
    adminPassword,
    appNewPassword,
    appOldPassword,
    appRoot,
    caPath,
    candidateEnv: () => ({ ...candidateEnv }),
    candidateEnvPath: CANDIDATE_ENV_PATH,
    currentEnv: () => ({ ...currentEnv }),
    currentEnvPath: CURRENT_ENV_PATH,
    databaseHost,
    migratorNewPassword,
    migratorOldPassword,
    wrongCa,
    wrongPassword,
    markerPath: ROTATION_MARKER,

    async setup(): Promise<void> {
      try {
        runSudo(['true']);
        runSudo(['id', 'academic-writing']);
        runSudo(['getent', 'group', 'academic-writing']);
      } catch {
        throw new Error('Step5B prerequisite missing: passwordless root and academic-writing identity are required');
      }
      requirePrerequisite(existsSync(caPath), `CA file is missing: ${caPath}`);
      requirePrerequisite(existsSync(join(appRoot, 'server', 'config', 'production-config.js')), 'compiled production app root is missing');
      requirePrerequisite(!process.env.P3_DB_ADMIN_PASSWORD, 'P3_DB_ADMIN_PASSWORD must be absent from the initial test environment');
      currentEnv = buildEnv('old');
      candidateEnv = buildEnv('new');
      prepareFilesystem();
      filesystemPrepared = true;
      await provisionDatabase();
      await this.reset();
    },

    async reset(): Promise<void> {
      currentEnv = buildEnv('old');
      candidateEnv = buildEnv('new');
      prepareFilesystem();
      await resetDatabase();
    },

    async connectAdmin(overrides: ConnectionOverrides = {}): Promise<Client> {
      return connect('p3_rotation_admin', overrides.password || adminPassword, overrides);
    },

    async connectRole(role: string, password: string, overrides: ConnectionOverrides = {}): Promise<Client> {
      return connect(role, password, overrides);
    },

    async revokeMigratorAdminOption(): Promise<void> {
      await withBootstrap(async (client) => {
        await client.query(
          'REVOKE ADMIN OPTION FOR academic_writing_migrator FROM p3_rotation_admin',
        );
      });
    },

    async dropRole(role: 'academic_writing_app' | 'academic_writing_migrator'): Promise<void> {
      await withBootstrap(async (client) => {
        await client.query(`DROP ROLE "${role}"`);
      });
    },

    chmodCandidate(mode: string): void {
      runSudo(['chmod', mode, '--', CANDIDATE_ENV_PATH]);
    },

    async insertZoteroRow(): Promise<void> {
      await withBootstrap(async (client) => {
        await client.query(
          'INSERT INTO public.zotero_connections (id, encrypted_credentials) VALUES (1, $1)',
          ['synthetic-encrypted-credential'],
        );
      });
    },

    async setCandidateEnv(nextCandidateEnv: EnvValues): Promise<void> {
      candidateEnv = { ...nextCandidateEnv };
      const candidateSource = join(tempRoot, 'candidate.env');
      writeFileSync(candidateSource, envText(candidateEnv));
      installRootFile(candidateSource, CANDIDATE_ENV_PATH, 'root:root', '600');
    },

    readFile(filePath: string): string {
      return readRootFile(filePath);
    },

    state(filePath: string): { exists: boolean; owner?: string; mode?: string } {
      return fileState(filePath);
    },

    async runRotation(options: {
      adminPassword?: string;
      mode?: 'INITIAL_COMPROMISE_ROTATION' | 'NORMAL_FUTURE_ROTATION';
      pathPrefix?: string;
    } = {}): Promise<RotationResult> {
      const python = process.env.P3_WP6_PYTHON || 'python3';
      const helperPath = join(PROJECT_ROOT, 'test', 'support', 'p3-wp6-pty-runner.py');
      const effectivePath = [
        options.pathPrefix,
        '/usr/local/sbin',
        '/usr/local/bin',
        '/usr/sbin',
        '/usr/bin',
        '/sbin',
        '/bin',
      ].filter(Boolean).join(':');
      const childEnv = { ...process.env };
      delete childEnv.P3_DB_ADMIN_PASSWORD;
      childEnv.P3_SECURITY_SECRET_ROTATION_REQUIRED = 'YES';
      childEnv.P3_DB_ADMIN_URL = `postgresql://p3_rotation_admin@${databaseHost}:${DATABASE_PORT}/${DATABASE_NAME}`;

      const child = spawn(
        python,
        [
          helperPath,
          '--',
          'sudo',
          '-n',
          '--preserve-env=P3_SECURITY_SECRET_ROTATION_REQUIRED,P3_DB_ADMIN_URL',
          '/usr/bin/env',
          `PATH=${effectivePath}`,
          '/bin/bash',
          join(PROJECT_ROOT, 'deploy', 'scripts', 'rotate-production-env.sh'),
          CANDIDATE_ENV_PATH,
          appRoot,
          options.mode || 'INITIAL_COMPROMISE_ROTATION',
        ],
        {
          cwd: PROJECT_ROOT,
          env: childEnv,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );

      let stdout = '';
      let stderr = '';
      let passwordSent = false;
      const readyMarker = 'P3_WP6_PROMPT_READY\n';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => { stdout += chunk; });
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
        if (!passwordSent && stderr.includes(readyMarker)) {
          passwordSent = true;
          child.stdin.write(`${options.adminPassword || adminPassword}\n`);
          child.stdin.end();
        }
      });

      return new Promise((resolveResult, rejectResult) => {
        const timeout = setTimeout(() => {
          child.kill('SIGKILL');
          rejectResult(new Error('Step5B PTY rotation timed out'));
        }, 120_000);
        child.on('error', (error) => {
          clearTimeout(timeout);
          rejectResult(error);
        });
        child.on('close', (code, signal) => {
          clearTimeout(timeout);
          resolveResult({ code, signal, stdout, stderr });
        });
      });
    },

    async createActivationFaultWrapper(): Promise<string> {
      const faultBin = join(tempRoot, 'fault-bin');
      const wrapperPath = join(faultBin, 'mv');
      mkdirSync(faultBin, { recursive: true });
      const wrapper = [
        '#!/usr/bin/env bash',
        'if [ "$1" = "-f" ] && [ "$2" = "--" ] && [ "$4" = "/etc/academic-writing-platform/production.env" ]; then',
        '  echo "synthetic activation failure" >&2',
        '  exit 91',
        'fi',
        'exec /usr/bin/mv "$@"',
        '',
      ].join('\n');
      const sourcePath = join(tempRoot, 'mv');
      writeFileSync(sourcePath, wrapper);
      chmodSync(sourcePath, 0o755);
      writeFileSync(wrapperPath, wrapper);
      chmodSync(wrapperPath, 0o755);
      return faultBin;
    },

    async teardown(): Promise<void> {
      try {
        if (filesystemPrepared) {
          runSudo(['rm', '-rf', '--', ENV_DIR]);
        }
      } finally {
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
  };
}
