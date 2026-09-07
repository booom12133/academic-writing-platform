import { validateRuntimeConfig } from './config-validation';
import { loadRuntimeConfig, type RuntimeConfig } from './production-config';
import { RuntimeProfileConfigurationError } from './runtime-profile';

type EnvironmentOverrides = Record<string, string | undefined>;

// Runtime-profile tests exercise AppModule composition only.  Its business
// modules are outside WP1 and include decorators that are not loaded by the
// isolated ts-jest module registry used below.
jest.mock('../modules/view/view.module', () => ({
  ViewModule: class ViewModule {},
}));
jest.mock('../modules/users/users.module', () => ({
  UsersModule: class UsersModule {},
}));
jest.mock('../modules/tasks/tasks.module', () => ({
  TasksModule: class TasksModule {},
}));
jest.mock('../modules/points/points.module', () => ({
  PointsModule: class PointsModule {},
}));
jest.mock('../modules/orders/orders.module', () => ({
  OrdersModule: class OrdersModule {},
}));
jest.mock('../modules/ai-tools/ai-tools.module', () => ({
  AiToolsModule: class AiToolsModule {},
}));
jest.mock('../modules/document-input/document-input.module', () => ({
  DocumentInputModule: class DocumentInputModule {},
}));
jest.mock('../modules/knowledge/knowledge.module', () => ({
  KnowledgeModule: class KnowledgeModule {},
}));
jest.mock('../modules/zotero/zotero.module', () => ({
  ZoteroModule: class ZoteroModule {},
}));
jest.mock('../modules/academic-search/academic-search.module', () => ({
  AcademicSearchModule: class AcademicSearchModule {},
}));
jest.mock('../modules/grounded-generation/grounded-generation.module', () => ({
  GroundedGenerationModule: class GroundedGenerationModule {},
}));
jest.mock('../modules/health/health.module', () => ({
  HealthModule: { forRoot: jest.fn(() => class HealthModule {}) },
}));

const RUNTIME_ENV_KEYS = [
  'NODE_ENV',
  'RUNTIME_PROFILE',
  'MIAODA_LOCAL_DEV',
  'FORCE_AUTHN_INNERAPI_DOMAIN',
  'DOCUMENT_STORAGE_DRIVER',
  'DOCUMENT_STORAGE_ROOT',
  'DATABASE_URL',
  'OIDC_ISSUER_URL',
  'OIDC_AUDIENCE',
  'OIDC_JWKS_URL',
  'OIDC_USER_ID_CLAIM',
  'OIDC_ALLOWED_ALGORITHMS',
  'OIDC_TIMEOUT_MS',
  'CORS_ALLOWED_ORIGINS',
  'TRUST_PROXY_HOPS',
  'LOG_REQUEST_BODY',
  'LOG_RESPONSE_BODY',
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_BASE_URL',
  'DEEPSEEK_DEFAULT_MODEL',
  'OPENALEX_API_BASE_URL',
  'ACADEMIC_SEARCH_CURSOR_SECRET',
  'ZOTERO_API_BASE_URL',
  'ZOTERO_CREDENTIAL_ENCRYPTION_KEY',
  'ZOTERO_CREDENTIAL_ENCRYPTION_KEY_VERSION',
] as const;

function withRuntimeEnvironment<T>(
  overrides: EnvironmentOverrides,
  action: () => T,
): T {
  const previous = new Map(
    RUNTIME_ENV_KEYS.map((key) => [key, process.env[key]]),
  );

  try {
    for (const key of RUNTIME_ENV_KEYS) {
      const value = overrides[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return action();
  } finally {
    for (const key of RUNTIME_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function loadAppModule(
  overrides: EnvironmentOverrides,
): typeof import('../app.module').AppModule {
  return withRuntimeEnvironment(overrides, () => {
    let appModule: typeof import('../app.module').AppModule | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      appModule = require('../app.module').AppModule;
    });
    return appModule as typeof import('../app.module').AppModule;
  });
}

function appModuleImportNames(overrides: EnvironmentOverrides): string[] {
  const AppModule = loadAppModule(overrides);
  const imports = Reflect.getMetadata('imports', AppModule) as Array<{
    name?: string;
    module?: { name?: string };
  }>;

  return imports.map((entry) => entry.module?.name || entry.name || 'unknown');
}

function configureAppModule(overrides: EnvironmentOverrides) {
  const AppModule = loadAppModule(overrides);
  const forRoutes = jest.fn();
  const apply = jest.fn((_middleware: unknown) => ({ forRoutes }));

  new AppModule().configure({ apply } as never);

  return { apply, forRoutes };
}

describe('runtime profile bootstrap boundary', () => {
  it('does not force a local runtime profile from the generic npm test script', () => {
    const packageJson = require('../../package.json') as {
      scripts?: { test?: string };
    };

    expect(packageJson.scripts?.test || '').not.toMatch(
      /RUNTIME_PROFILE=local/,
    );
  });

  it('fails startup when production omits RUNTIME_PROFILE', () => {
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: 'production',
      }),
    ).toThrow(
      new RuntimeProfileConfigurationError(
        'RUNTIME_PROFILE is required and must be local, platform, or standalone.',
      ),
    );
  });

  it('fails startup when production selects the local runtime profile', () => {
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: 'production',
        RUNTIME_PROFILE: 'local',
      }),
    ).toThrow(
      new RuntimeProfileConfigurationError(
        'RUNTIME_PROFILE=local cannot be used when NODE_ENV=production.',
      ),
    );
  });

  it('fails startup for an unknown runtime profile', () => {
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: 'development',
        RUNTIME_PROFILE: 'preview',
      }),
    ).toThrow(
      new RuntimeProfileConfigurationError(
        'Unsupported RUNTIME_PROFILE: preview. Expected local, platform, or standalone.',
      ),
    );
  });

  it('requires development launchers to provide the local profile explicitly', () => {
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: 'development',
      }),
    ).toThrow(
      new RuntimeProfileConfigurationError(
        'RUNTIME_PROFILE is required and must be local, platform, or standalone.',
      ),
    );
  });

  it('does not infer the local profile for test bootstrap', () => {
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: 'test',
      }),
    ).toThrow(
      new RuntimeProfileConfigurationError(
        'RUNTIME_PROFILE is required and must be local, platform, or standalone.',
      ),
    );
  });

  it('passes the explicit local profile through the sandbox development launcher', () => {
    const previousSandboxId = process.env.SANDBOX_ID;
    const previousRuntimeProfile = process.env.RUNTIME_PROFILE;
    const on = jest.fn();
    const spawn = jest.fn(
      (_command: unknown, _args: unknown, _options: unknown) => ({ on }),
    );

    try {
      process.env.SANDBOX_ID = 'runtime-profile-test';
      delete process.env.RUNTIME_PROFILE;
      jest.doMock('node:child_process', () => ({
        spawn,
        spawnSync: jest.fn(),
      }));

      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../scripts/dev-entry.js');
      });

      expect(spawn).toHaveBeenCalledTimes(1);
      const options = spawn.mock.calls[0]?.[2] as {
        env: NodeJS.ProcessEnv;
      };
      expect(options.env.RUNTIME_PROFILE).toBe('local');
    } finally {
      jest.dontMock('node:child_process');
      if (previousSandboxId === undefined) delete process.env.SANDBOX_ID;
      else process.env.SANDBOX_ID = previousSandboxId;
      if (previousRuntimeProfile === undefined)
        delete process.env.RUNTIME_PROFILE;
      else process.env.RUNTIME_PROFILE = previousRuntimeProfile;
    }
  });

  it('loads local fixed-auth and local database topology only for the local profile', () => {
    const environment = {
      NODE_ENV: 'development',
      RUNTIME_PROFILE: 'local',
    };
    const imports = appModuleImportNames(environment);
    const middleware = configureAppModule(environment);

    expect(imports).toEqual(
      expect.arrayContaining(['LocalDevelopmentDatabaseModule']),
    );
    expect(imports).not.toEqual(
      expect.arrayContaining([
        'PlatformModule',
        'StandardPostgresDatabaseModule',
      ]),
    );
    expect(middleware.apply).toHaveBeenCalledTimes(2);
    expect(middleware.apply.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ name: 'RequestLoggingMiddleware' }),
    );
    expect(middleware.apply.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ name: 'LocalDevelopmentAuthMiddleware' }),
    );
    expect(middleware.forRoutes).toHaveBeenCalledWith('*');
  });

  it('keeps platform topology when filesystem variables are present', () => {
    const imports = appModuleImportNames({
      NODE_ENV: 'development',
      RUNTIME_PROFILE: 'platform',
      DOCUMENT_STORAGE_DRIVER: 'filesystem',
      DOCUMENT_STORAGE_ROOT: '/var/lib/academic-writing-platform/documents',
    });

    expect(imports).toEqual(expect.arrayContaining(['PlatformModule']));
    expect(imports).not.toEqual(
      expect.arrayContaining([
        'LocalDevelopmentDatabaseModule',
        'StandardPostgresDatabaseModule',
      ]),
    );
    const middleware = configureAppModule({
      NODE_ENV: 'development',
      RUNTIME_PROFILE: 'platform',
      DOCUMENT_STORAGE_DRIVER: 'filesystem',
      DOCUMENT_STORAGE_ROOT: '/var/lib/academic-writing-platform/documents',
    });
    expect(middleware.apply).toHaveBeenCalledTimes(1);
    expect(middleware.apply.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ name: 'RequestLoggingMiddleware' }),
    );
  });

  it('fails standalone startup when its PostgreSQL and filesystem boundary is absent', () => {
    expect(() =>
      loadAppModule({
        NODE_ENV: 'production',
        RUNTIME_PROFILE: 'standalone',
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('requires standalone filesystem storage after PostgreSQL is configured', () => {
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: 'production',
        RUNTIME_PROFILE: 'standalone',
        DATABASE_URL: 'postgresql://db.example/academic_writing',
      }),
    ).toThrow(/DOCUMENT_STORAGE_ROOT/);
  });

  it('loads standalone PostgreSQL without local or platform modules', () => {
    const environment = {
      NODE_ENV: 'production',
      RUNTIME_PROFILE: 'standalone',
      DATABASE_URL: 'postgresql://db.example/academic_writing',
      DOCUMENT_STORAGE_ROOT: '/var/lib/academic-writing-platform/documents',
      OIDC_ISSUER_URL: 'https://issuer.example.com',
      OIDC_AUDIENCE: 'academic-writing-platform',
      OIDC_JWKS_URL: 'https://issuer.example.com/.well-known/jwks.json',
      CORS_ALLOWED_ORIGINS: 'https://app.example.com',
      DEEPSEEK_API_KEY: 'deepseek-secret',
      DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
      DEEPSEEK_DEFAULT_MODEL: 'deepseek-v4-flash',
      OPENALEX_API_BASE_URL: 'https://api.openalex.org',
      ACADEMIC_SEARCH_CURSOR_SECRET: 'cursor-secret',
      ZOTERO_API_BASE_URL: 'https://api.zotero.org',
      ZOTERO_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      ZOTERO_CREDENTIAL_ENCRYPTION_KEY_VERSION: 'v1',
    };
    const imports = appModuleImportNames(environment);

    expect(imports).toEqual(
      expect.arrayContaining(['StandardPostgresDatabaseModule']),
    );
    expect(imports).not.toEqual(
      expect.arrayContaining([
        'LocalDevelopmentDatabaseModule',
        'PlatformModule',
      ]),
    );
    const middleware = configureAppModule(environment);
    expect(middleware.apply).toHaveBeenCalledTimes(1);
    expect(middleware.apply.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ name: 'RequestLoggingMiddleware' }),
    );
  });

  it.each([
    {
      unsafeBoundary: 'local fixed authentication',
      override: { auth: { mode: 'local-fixed' as const } },
      expectedMessage: 'local-fixed authentication',
    },
    {
      unsafeBoundary: 'local in-memory database',
      override: { database: { mode: 'local-memory' as const } },
      expectedMessage: 'local-memory database',
    },
  ])(
    'rejects $unsafeBoundary in production independently of the selected profile',
    ({ override, expectedMessage }) => {
      const baseConfig: RuntimeConfig = {
        nodeEnv: 'production',
        profile: 'platform',
        auth: { mode: 'platform' },
        database: { mode: 'platform' },
        storage: { mode: 'platform' },
        security: {
          corsAllowedOrigins: [],
          bodySizeLimit: '1mb',
          trustProxyHops: 0,
          rateLimit: {
            windowMs: 60_000,
            maxRequests: 120,
            expensiveMaxRequests: 30,
          },
        },
      };

      expect(() =>
        validateRuntimeConfig({ ...baseConfig, ...override }, {}),
      ).toThrow(expectedMessage);
    },
  );
});
