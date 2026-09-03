import {
  buildGeneratorEnvironment,
  buildSchemaSyncInvocation,
  createCanonicalTarget,
  createTemporaryOutput,
  fetchSchemaMetadata,
  formatPreflightReport,
  runReadOnlyPreflight,
  runSchemaSync,
  stableSchemaSnapshot,
  DB_SCHEMA_SYNC_VERSION,
} from '../../scripts/e1-database-preflight';

describe('E1 read-only database preflight wrapper', () => {
  const repoRoot = 'D:\\academic-writing-platform';
  const protectedSchemaPath = `${repoRoot}\\server\\database\\schema.ts`;
  const targetEnv = {
    E1_PREFLIGHT_APP_ID: 'app-canonical',
    E1_PREFLIGHT_DB_BRANCH: 'main',
    E1_PREFLIGHT_API_DOMAIN: 'https://miaoda.example.test',
    E1_PREFLIGHT_X_TT_ENV: 'production',
    E1_PREFLIGHT_AUTH_CONTEXT_ID: 'local-preflight-auth',
    FORCE_AUTHN_TOKEN: 'secret-token',
  };

  function createTarget() {
    return createCanonicalTarget({ env: targetEnv });
  }

  it('pins the exact inspected db-schema-sync package version', () => {
    const invocation = buildSchemaSyncInvocation({
      outputPath: 'C:\\Temp\\e1-db-preflight\\schema.ts',
      platform: 'linux',
    });

    expect(DB_SCHEMA_SYNC_VERSION).toBe('0.1.18');
    expect(invocation.command).toBe('npx');
    expect(invocation.args).toEqual([
      '-y',
      '@lark-apaas/db-schema-sync@0.1.18',
      '--output',
      'C:\\Temp\\e1-db-preflight\\schema.ts',
      '--export-custom-types',
    ]);
  });

  it('passes canonical appId and dbBranch to the generator child environment', async () => {
    const target = createTarget();
    let generatorEnv: Record<string, string | undefined> | undefined;
    const metadata = { tables: [{ tableName: 'app_users' }] };

    await runReadOnlyPreflight({
      repoRoot,
      target,
      generatorReadOnlyConfirmed: true,
      getSchemaMetadata: async () => metadata,
      runGenerator: ({ env }) => {
        generatorEnv = env;
        return { status: 0 };
      },
      compareSchema: () => ({ status: 'identical', generatedSha256: 'same' }),
    });

    expect(generatorEnv?.app_id).toBe('app-canonical');
    expect(generatorEnv?.FORCE_DB_BRANCH).toBe('main');
  });

  it('cannot be redirected by conflicting inherited target variables', () => {
    const target = createTarget();
    const childEnv = buildGeneratorEnvironment(target, {
      ...targetEnv,
      app_id: 'app-attacker',
      FORCE_DB_BRANCH: 'attacker-branch',
      FORCE_AUTHN_INNERAPI_DOMAIN: 'https://attacker.example.test',
      X_TT_ENV: 'attacker-env',
      FORCE_FRAMEWORK_CLI_CANARY_ENV: 'attacker-env',
    });

    expect(childEnv.app_id).toBe('app-canonical');
    expect(childEnv.FORCE_DB_BRANCH).toBe('main');
    expect(childEnv.FORCE_AUTHN_INNERAPI_DOMAIN).toBe(
      'https://miaoda.example.test',
    );
    expect(childEnv.X_TT_ENV).toBe('production');
    expect(childEnv.FORCE_FRAMEWORK_CLI_CANARY_ENV).toBeUndefined();
  });

  it('uses one canonical target fingerprint for before, generator, and after', async () => {
    const target = createTarget();
    const metadata = { tables: [{ tableName: 'app_users' }] };
    const result = await runReadOnlyPreflight({
      repoRoot,
      target,
      generatorReadOnlyConfirmed: true,
      getSchemaMetadata: async () => metadata,
      runGenerator: ({ target: generatorTarget }) => ({
        status: 0,
        targetFingerprint: generatorTarget.targetFingerprint,
      }),
      compareSchema: () => ({ status: 'identical', generatedSha256: 'same' }),
    });

    expect(result.before.targetFingerprint).toBe(
      result.generator.targetFingerprint,
    );
    expect(result.generator.targetFingerprint).toBe(
      result.after.targetFingerprint,
    );
    expect(result.before.normalizedSchemaSha256).toBe(
      result.after.normalizedSchemaSha256,
    );
  });

  it('fails closed when the before and after normalized schema hashes differ', async () => {
    const target = createTarget();
    const metadata = [
      { tables: [{ tableName: 'app_users' }] },
      { tables: [{ tableName: 'app_users' }, { tableName: 'new_table' }] },
    ];

    await expect(
      runReadOnlyPreflight({
        repoRoot,
        target,
        generatorReadOnlyConfirmed: true,
        getSchemaMetadata: async () => metadata.shift(),
        runGenerator: () => ({ status: 0 }),
        compareSchema: () => ({ status: 'identical', generatedSha256: 'same' }),
      }),
    ).rejects.toThrow(/normalized schema hash|schema metadata changed/i);
  });

  it('preserves order-sensitive schema arrays in normalized hashes', () => {
    const target = createTarget();
    const first = stableSchemaSnapshot(
      { indexes: [{ columns: ['user_id', 'document_id'] }] },
      target,
    );
    const second = stableSchemaSnapshot(
      { indexes: [{ columns: ['document_id', 'user_id'] }] },
      target,
    );

    expect(first.normalizedSchemaSha256).not.toBe(
      second.normalizedSchemaSha256,
    );
  });

  it('rejects an output path equal to the protected generated schema path', () => {
    expect(() =>
      createTemporaryOutput(repoRoot, {
        requestedOutputPath: protectedSchemaPath,
      }),
    ).toThrow(/protected|schema\.ts/i);
  });

  it('performs metadata inventory through GET without a platform mutation request', async () => {
    const target = createTarget();
    let request: { url: string; init?: RequestInit } | undefined;
    const response = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ data: { tables: [] } }),
    } as Response;

    await fetchSchemaMetadata(target, targetEnv, async (url, init) => {
      request = { url, init };
      return response;
    });

    expect(request?.url).toBe(
      'https://miaoda.example.test/v1/app/app-canonical/dataloom/schema?dbBranch=main',
    );
    expect(request?.init?.method).toBe('GET');
    expect(request?.init?.body).toBeUndefined();
  });

  it('returns failure when the pinned schema generator exits non-zero', () => {
    expect(() =>
      runSchemaSync({
        repoRoot,
        outputPath: 'C:\\Temp\\e1-db-preflight\\schema.ts',
        platform: 'linux',
        env: targetEnv,
        spawnSync: () => ({
          status: 17,
          stdout: '',
          stderr: 'generator failed',
        }),
      }),
    ).toThrow(/exited with status 17|generator failed/i);
  });

  it('redacts forwarded authentication secrets from generator errors', () => {
    const secretsEnv = {
      ...targetEnv,
      FORCE_AUTHN_TOKEN: 'token-secret-value',
      FORCE_AUTHN_ACCESS_SECRET: 'access-secret-value',
      FORCE_AUTHN_ACCESS_KEY: 'access-key-value',
      MIAODA_AUTHN_CODE: 'miaoda-code-value',
      X_LARKGW_SUDA_WEBUSER: 'web-user-value',
      DOTENV_KEY: 'dotenv-key-value',
    };

    let thrownError: Error | undefined;
    try {
      runSchemaSync({
        repoRoot,
        outputPath: 'C:\\Temp\\e1-db-preflight\\schema.ts',
        platform: 'linux',
        env: secretsEnv,
        spawnSync: () => ({
          status: 17,
          stdout: 'stdout token-secret-value access-key-value',
          stderr:
            'stderr access-secret-value miaoda-code-value web-user-value dotenv-key-value',
        }),
      });
    } catch (error) {
      thrownError = error as Error;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError?.message).not.toContain('token-secret-value');
    expect(thrownError?.message).not.toContain('access-secret-value');
    expect(thrownError?.message).not.toContain('access-key-value');
    expect(thrownError?.message).not.toContain('miaoda-code-value');
    expect(thrownError?.message).not.toContain('web-user-value');
    expect(thrownError?.message).not.toContain('dotenv-key-value');
  });

  it('never includes authentication secrets in target/report output', () => {
    const target = createTarget();
    const report = formatPreflightReport({
      target,
      before: stableSchemaSnapshot({ tables: [] }, target),
      generator: {
        targetFingerprint: target.targetFingerprint,
        version: '0.1.18',
      },
      after: stableSchemaSnapshot({ tables: [] }, target),
    });

    expect(report).toContain('app-canonical');
    expect(report).toContain('production');
    expect(report).not.toContain('secret-token');
    expect(report).not.toContain('FORCE_AUTHN_TOKEN');
  });
});
