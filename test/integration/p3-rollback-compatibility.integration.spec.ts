import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { get } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Pool } from 'pg';
import { createStandardPostgresConfig } from '../../server/database/standard-postgres.module';
import {
  createP3PostgresRoleFixture,
  type P3PostgresRoleFixture,
} from '../support/p3-postgres-role-fixture';

const {
  assertControlledMigrationPreconditions,
  createMigrationPoolConfig,
  runMigrations,
} = require('../../scripts/db-migrate.js');

const APPROVED_PREVIOUS_SHA = '666f40309b42f2c0d44e4fd6ecbcd1e81f869a8d';
const APPROVED_PREVIOUS_TAG = 'phase-p2-accepted';
const CURRENT_MIGRATION_COUNT = 4;
const REPOSITORY_ROOT = resolve(__dirname, '../..');
const integrationEnabled = Boolean(process.env.P3_POSTGRES_ADMIN_URL);
const describeCompatibility = integrationEnabled ? describe : describe.skip;

function requireApprovedPreviousSha(candidate: string | undefined): string {
  if (candidate !== APPROVED_PREVIOUS_SHA) {
    throw new Error(
      `STOP / NO ROLLBACK: P3_ROLLBACK_COMPAT_PREVIOUS_SHA must equal ${APPROVED_PREVIOUS_SHA}.`,
    );
  }

  return candidate;
}

function runChecked(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    const diagnostic = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
      .trim()
      .slice(-2000);
    throw new Error(
      `STOP / NO ROLLBACK: ${command} ${args.join(' ')} failed.\n${diagnostic}`,
    );
  }

  return (result.stdout ?? '').trim();
}

async function reserveLoopbackPort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Unable to reserve a loopback port.'));
        return;
      }

      const port = address.port;
      server.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

function requestHealth(
  port: number,
  path: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolveResponse, reject) => {
    const request = get(
      {
        hostname: '127.0.0.1',
        port,
        path,
        timeout: 1_000,
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          resolveResponse({ status: response.statusCode ?? 0, body });
        });
      },
    );

    request.once('timeout', () =>
      request.destroy(new Error('Health request timed out.')),
    );
    request.once('error', reject);
  });
}

async function waitForLive(
  processHandle: ChildProcess,
  port: number,
): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (processHandle.exitCode !== null) {
      throw new Error(
        'STOP / NO ROLLBACK: previous release exited before liveness.',
      );
    }

    try {
      const response = await requestHealth(port, '/health/live');
      if (response.status === 200) {
        return;
      }
    } catch {
      // The disposable server may still be binding its loopback port.
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }

  throw new Error('STOP / NO ROLLBACK: previous release did not become live.');
}

async function stopPreviousServer(
  processHandle: ChildProcess | undefined,
): Promise<void> {
  if (!processHandle || processHandle.exitCode !== null) {
    return;
  }

  processHandle.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolveExit) =>
      processHandle.once('exit', () => resolveExit()),
    ),
    new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 5_000)),
  ]);

  if (processHandle.exitCode === null) {
    processHandle.kill('SIGKILL');
  }
}

function applicationEnvironment(
  fixture: P3PostgresRoleFixture,
  storageRoot: string,
  port: number,
): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    NODE_ENV: 'production',
    RUNTIME_PROFILE: 'standalone',
    SERVER_PORT: String(port),
    SERVER_HOST: '127.0.0.1',
    DATABASE_URL: fixture.appUrl,
    ...(fixture.caFile
      ? { DATABASE_SSL_CA: readFileSync(fixture.caFile, 'utf8') }
      : {}),
    DOCUMENT_STORAGE_ROOT: storageRoot,
    CORS_ALLOWED_ORIGINS: 'https://academic-writing.example.test',
    OIDC_ISSUER_URL: 'https://issuer.example.test',
    OIDC_AUDIENCE: 'academic-writing-api',
    OIDC_JWKS_URL: 'https://issuer.example.test/.well-known/jwks.json',
    DEEPSEEK_API_KEY: 'a8-disposable-deepseek-key',
    DEEPSEEK_BASE_URL: 'https://api.example.test',
    DEEPSEEK_DEFAULT_MODEL: 'a8-disposable-model',
    EMBEDDING_API_KEY: 'a8-disposable-embedding-key',
    EMBEDDING_BASE_URL: 'https://embedding.example.test',
    EMBEDDING_MODEL: 'a8-disposable-embedding-model',
    EMBEDDING_DIMENSIONS: '3',
    EMBEDDING_TIMEOUT_MS: '1000',
    OPENALEX_API_BASE_URL: 'https://openalex.example.test',
    ACADEMIC_SEARCH_CURSOR_SECRET:
      'a8-disposable-openalex-secret-with-sufficient-length',
    ZOTERO_API_BASE_URL: 'https://zotero.example.test',
    ZOTERO_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 5).toString('base64'),
    ZOTERO_CREDENTIAL_ENCRYPTION_KEY_VERSION: 'v1',
  };
}

describe('P3 rollback compatibility approval guard', () => {
  it('pins the exact approved SHA and targeted command in reviewed CI configuration', () => {
    const ciWorkflow = readFileSync(
      join(REPOSITORY_ROOT, '.github', 'workflows', 'ci.yml'),
      'utf8',
    );

    expect(ciWorkflow).toContain(
      `P3_ROLLBACK_COMPAT_PREVIOUS_SHA: ${APPROVED_PREVIOUS_SHA}`,
    );
    expect(ciWorkflow).toContain(
      'run: npx jest test/integration/p3-rollback-compatibility.integration.spec.ts --runInBand',
    );
  });

  it.each([undefined, '', 'e3511b0000000000000000000000000000000000'])(
    'rejects an absent or different previous release SHA before compatibility work (%p)',
    (candidate) => {
      expect(() => requireApprovedPreviousSha(candidate)).toThrow(
        'STOP / NO ROLLBACK',
      );
    },
  );
});

describeCompatibility('P3 rollback compatibility integration', () => {
  jest.setTimeout(240_000);

  it('starts the exact approved previous release on the current forward-migrated schema', async () => {
    const previousSha = requireApprovedPreviousSha(
      process.env.P3_ROLLBACK_COMPAT_PREVIOUS_SHA,
    );
    const activeHead = runChecked(
      'git',
      ['rev-parse', 'HEAD'],
      REPOSITORY_ROOT,
    );
    const activeStatus = runChecked(
      'git',
      ['status', '--short', '--untracked-files=no'],
      REPOSITORY_ROOT,
    );
    const acceptedTagTarget = runChecked(
      'git',
      ['rev-parse', `${APPROVED_PREVIOUS_TAG}^{}`],
      REPOSITORY_ROOT,
    );
    expect(acceptedTagTarget).toBe(previousSha);

    const disposableRoot = await mkdtemp(
      join(tmpdir(), 'p3-a8-rollback-compat-'),
    );
    const previousRoot = join(disposableRoot, 'previous-release');
    const storageRoot = join(disposableRoot, 'storage');
    let fixture: P3PostgresRoleFixture | undefined;
    let previousServer: ChildProcess | undefined;

    try {
      runChecked(
        'git',
        ['worktree', 'add', '--detach', previousRoot, previousSha],
        REPOSITORY_ROOT,
      );
      expect(runChecked('git', ['rev-parse', 'HEAD'], previousRoot)).toBe(
        previousSha,
      );

      runChecked('npm', ['ci', '--ignore-scripts'], previousRoot);
      runChecked('npm', ['run', 'build:server'], previousRoot);
      const previousEntry = join(previousRoot, 'dist', 'server', 'main.js');
      expect(existsSync(previousEntry)).toBe(true);

      fixture = await createP3PostgresRoleFixture();
      await fixture.applyCanonicalGrants();

      const migrationEnvironment = {
        ...process.env,
        NODE_ENV: 'production',
        DATABASE_URL: fixture.migratorUrl,
        DATABASE_SSL_CA_FILE: process.env.DATABASE_SSL_CA_FILE,
      };
      assertControlledMigrationPreconditions(migrationEnvironment);
      await runMigrations(createMigrationPoolConfig(migrationEnvironment));
      await fixture.applyCanonicalGrants();

      const appPool = new Pool(
        createStandardPostgresConfig({
          ...process.env,
          NODE_ENV: 'production',
          DATABASE_URL: fixture.appUrl,
          DATABASE_SSL_CA_FILE: process.env.DATABASE_SSL_CA_FILE,
        }),
      );
      let currentUser: string;
      let migrationCount: number;
      try {
        const roleResult = await appPool.query<{ current_user: string }>(
          'SELECT current_user',
        );
        const migrationResult = await appPool.query<{ count: string }>(
          'SELECT COUNT(*)::text AS count FROM drizzle.__drizzle_migrations',
        );
        currentUser = roleResult.rows[0].current_user;
        migrationCount = Number(migrationResult.rows[0].count);
      } finally {
        await appPool.end();
      }

      expect(currentUser).toBe('academic_writing_app');
      expect(migrationCount).toBe(CURRENT_MIGRATION_COUNT);

      await mkdir(storageRoot, { recursive: true });
      const port = await reserveLoopbackPort();
      previousServer = spawn(process.execPath, [previousEntry], {
        cwd: previousRoot,
        env: applicationEnvironment(fixture, storageRoot, port),
        stdio: 'ignore',
      });

      await waitForLive(previousServer, port);
      const live = await requestHealth(port, '/health/live');
      const ready = await requestHealth(port, '/health/ready');
      expect(live.status).toBe(200);
      expect(JSON.parse(live.body)).toEqual({ status: 'ok' });
      expect(ready.status).toBe(200);
      expect(JSON.parse(ready.body)).toEqual({ status: 'ok' });

      expect(runChecked('git', ['rev-parse', 'HEAD'], REPOSITORY_ROOT)).toBe(
        activeHead,
      );
      expect(
        runChecked(
          'git',
          ['status', '--short', '--untracked-files=no'],
          REPOSITORY_ROOT,
        ),
      ).toBe(activeStatus);

      console.info(
        'P3_ROLLBACK_COMPAT_EVIDENCE',
        JSON.stringify({
          previousSha,
          currentSha: activeHead,
          databaseRole: currentUser,
          migrationCount,
          liveStatus: live.status,
          readyStatus: ready.status,
        }),
      );
    } finally {
      await stopPreviousServer(previousServer);
      await fixture?.close();
      if (existsSync(previousRoot)) {
        runChecked(
          'git',
          ['worktree', 'remove', '--force', previousRoot],
          REPOSITORY_ROOT,
        );
      }
      await rm(disposableRoot, { recursive: true, force: true });
    }
  });
});
