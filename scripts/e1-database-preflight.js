'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DB_SCHEMA_SYNC_VERSION = '0.1.18';
const DB_SCHEMA_SYNC_PACKAGE = `@lark-apaas/db-schema-sync@${DB_SCHEMA_SYNC_VERSION}`;
const GENERATOR_ENVIRONMENT_VARIABLES = Object.freeze([
  'app_id',
  'FORCE_DB_BRANCH',
  'FORCE_AUTHN_INNERAPI_DOMAIN',
  'FORCE_FRAMEWORK_CLI_CANARY_ENV',
  'X_TT_ENV',
  'X_LARKGW_SUDA_WEBUSER',
  'FORCE_AUTHN_ACCESS_KEY',
  'FORCE_AUTHN_ACCESS_SECRET',
  'FORCE_AUTHN_TOKEN',
  'MIAODA_AUTHN_CODE',
]);
const SENSITIVE_ENVIRONMENT_VARIABLES = Object.freeze([
  'FORCE_AUTHN_TOKEN',
  'FORCE_AUTHN_ACCESS_SECRET',
  'FORCE_AUTHN_ACCESS_KEY',
  'MIAODA_AUTHN_CODE',
  'X_LARKGW_SUDA_WEBUSER',
  'DOTENV_KEY',
]);

function defaultRepoRoot() {
  return path.resolve(__dirname, '..');
}

function protectedSchemaPath(repoRoot = defaultRepoRoot()) {
  return path.resolve(repoRoot, 'server', 'database', 'schema.ts');
}

function assertSafeOutputPath(outputPath, repoRoot = defaultRepoRoot()) {
  const resolvedOutputPath = path.resolve(outputPath);
  if (
    resolvedOutputPath.toLowerCase() ===
    protectedSchemaPath(repoRoot).toLowerCase()
  ) {
    throw new Error(
      'Refusing to use the protected server/database/schema.ts output path',
    );
  }
  return resolvedOutputPath;
}

function createTemporaryOutput(repoRoot = defaultRepoRoot(), options = {}) {
  if (options.requestedOutputPath !== undefined) {
    assertSafeOutputPath(options.requestedOutputPath, repoRoot);
    throw new Error(
      'E1 preflight output must be created in a temporary directory',
    );
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e1-db-preflight-'));
  const outputPath = assertSafeOutputPath(
    path.join(tempDir, 'schema.ts'),
    repoRoot,
  );
  return {
    tempDir,
    outputPath,
    cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
  };
}

function stableNormalize(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stableNormalize(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableNormalize(value[key])]),
    );
  }
  return value;
}

function sensitiveEnvironmentValues(env = process.env) {
  const values = new Set();
  for (const name of SENSITIVE_ENVIRONMENT_VARIABLES) {
    const value = env[name];
    if (typeof value === 'string' && value.length > 0) values.add(value);
  }
  return [...values].sort((left, right) => right.length - left.length);
}

function redactSecrets(value, env = process.env) {
  let redacted = String(value ?? '');
  for (const secret of sensitiveEnvironmentValues(env)) {
    redacted = redacted.split(secret).join('[REDACTED]');
  }
  return redacted;
}

function redactValue(value, env = process.env) {
  if (typeof value === 'string') return redactSecrets(value, env);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, env));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactValue(item, env)]),
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableNormalize(value));
}

function targetFingerprint(target) {
  const identity = {
    appId: target.appId,
    dbBranch: target.dbBranch,
    apiDomain: target.apiDomain,
    xTtEnv: target.xTtEnv,
    environmentId: target.environmentId,
    authContextId: target.authContextId,
  };
  return crypto.createHash('sha256').update(stableJson(identity)).digest('hex');
}

function createCanonicalTarget({ env = process.env } = {}) {
  const appId = env.E1_PREFLIGHT_APP_ID;
  const dbBranch = env.E1_PREFLIGHT_DB_BRANCH;
  const apiDomain = env.E1_PREFLIGHT_API_DOMAIN;
  const authContextId = env.E1_PREFLIGHT_AUTH_CONTEXT_ID;
  if (!appId || !dbBranch || !apiDomain || !authContextId) {
    throw new Error(
      'E1_PREFLIGHT_APP_ID, E1_PREFLIGHT_DB_BRANCH, E1_PREFLIGHT_API_DOMAIN, and E1_PREFLIGHT_AUTH_CONTEXT_ID are required',
    );
  }

  const target = {
    appId,
    dbBranch,
    apiDomain,
    xTtEnv: env.E1_PREFLIGHT_X_TT_ENV || undefined,
    environmentId: env.E1_PREFLIGHT_ENVIRONMENT_ID || undefined,
    authContextId,
  };
  return { ...target, targetFingerprint: targetFingerprint(target) };
}

function buildGeneratorEnvironment(target, inheritedEnv = process.env) {
  const childEnv = { ...inheritedEnv };
  childEnv.app_id = target.appId;
  childEnv.FORCE_DB_BRANCH = target.dbBranch;
  childEnv.FORCE_AUTHN_INNERAPI_DOMAIN = target.apiDomain;

  delete childEnv.E1_PREFLIGHT_APP_ID;
  delete childEnv.E1_PREFLIGHT_DB_BRANCH;
  delete childEnv.E1_PREFLIGHT_API_DOMAIN;
  delete childEnv.E1_PREFLIGHT_X_TT_ENV;
  delete childEnv.E1_PREFLIGHT_ENVIRONMENT_ID;
  delete childEnv.E1_PREFLIGHT_AUTH_CONTEXT_ID;

  if (target.xTtEnv) {
    childEnv.X_TT_ENV = target.xTtEnv;
    delete childEnv.FORCE_FRAMEWORK_CLI_CANARY_ENV;
  } else {
    delete childEnv.X_TT_ENV;
    delete childEnv.FORCE_FRAMEWORK_CLI_CANARY_ENV;
  }

  return childEnv;
}

function buildSchemaSyncInvocation({
  outputPath,
  platform = process.platform,
  repoRoot = defaultRepoRoot(),
}) {
  const safeOutputPath = assertSafeOutputPath(outputPath, repoRoot);
  return {
    command: platform === 'win32' ? 'npx.cmd' : 'npx',
    args: [
      '-y',
      DB_SCHEMA_SYNC_PACKAGE,
      '--output',
      safeOutputPath,
      '--export-custom-types',
    ],
    shell: platform === 'win32',
  };
}

function runSchemaSync({
  repoRoot = defaultRepoRoot(),
  outputPath,
  platform = process.platform,
  env = process.env,
  spawnSync: spawn = spawnSync,
}) {
  const invocation = buildSchemaSyncInvocation({
    outputPath,
    platform,
    repoRoot,
  });
  const result = spawn(invocation.command, invocation.args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env,
    shell: invocation.shell,
  });

  if (result.error) {
    throw new Error(
      `db-schema-sync failed to start: ${redactSecrets(result.error.message, env)}`,
    );
  }
  if (result.status !== 0) {
    const detail = redactSecrets(
      String(result.stderr || result.stdout || '').trim(),
      env,
    );
    throw new Error(
      `db-schema-sync exited with status ${result.status}${detail ? `: ${detail}` : ''}`,
    );
  }
  return {
    ...result,
    stdout: redactSecrets(result.stdout, env),
    stderr: redactSecrets(result.stderr, env),
  };
}

function authHeaders(env) {
  const headers = {};
  if (env.FORCE_AUTHN_TOKEN) {
    headers.Authorization = `Bearer ${env.FORCE_AUTHN_TOKEN}`;
    if (env.FORCE_AUTHN_ACCESS_KEY) {
      headers['x-api-key'] = env.FORCE_AUTHN_ACCESS_KEY;
    }
  } else if (env.FORCE_AUTHN_ACCESS_KEY && env.FORCE_AUTHN_ACCESS_SECRET) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        access_key: env.FORCE_AUTHN_ACCESS_KEY,
        iss: env.FORCE_AUTHN_ACCESS_KEY,
        iat: nowSeconds,
        nbf: nowSeconds,
        exp: nowSeconds + 30 * 60,
        jti: crypto.randomUUID(),
      }),
    ).toString('base64url');
    const signature = crypto
      .createHmac('sha256', env.FORCE_AUTHN_ACCESS_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');
    headers.Authorization = `Bearer ${header}.${payload}.${signature}`;
    headers['x-api-key'] = env.FORCE_AUTHN_ACCESS_KEY;
  } else {
    throw new Error(
      'A local Miaoda authentication context is required: FORCE_AUTHN_TOKEN or FORCE_AUTHN_ACCESS_KEY plus FORCE_AUTHN_ACCESS_SECRET',
    );
  }
  return headers;
}

async function fetchSchemaMetadata(
  target,
  env = process.env,
  fetchImpl = globalThis.fetch,
) {
  if (typeof fetchImpl !== 'function') {
    throw new Error(
      'The runtime must provide fetch for Miaoda schema metadata',
    );
  }
  const url = new URL(
    `/v1/app/${encodeURIComponent(target.appId)}/dataloom/schema?dbBranch=${encodeURIComponent(target.dbBranch)}`,
    target.apiDomain,
  );
  const headers = {
    Accept: 'application/json',
    'x-supaas-bizsource': 'miaoda',
    ...authHeaders(env),
  };
  if (target.xTtEnv) headers['x-tt-env'] = target.xTtEnv;
  if (env.X_LARKGW_SUDA_WEBUSER) {
    headers['X-Larkgw-Suda-Webuser'] = env.X_LARKGW_SUDA_WEBUSER;
  }

  const response = await fetchImpl(url.toString(), {
    method: 'GET',
    headers,
  });
  if (!response.ok) {
    throw new Error(
      `Miaoda schema metadata request failed with status ${response.status}`,
    );
  }
  const json = await response.json();
  return json?.data?.data ?? json?.data?.schema ?? json?.data ?? json;
}

function schemaObjectSummary(metadata) {
  const categories = [
    'tables',
    'views',
    'materializedViews',
    'enums',
    'sequences',
  ];
  return Object.fromEntries(
    categories.map((category) => {
      const values = Array.isArray(metadata?.[category])
        ? metadata[category]
        : [];
      const names = values
        .map(
          (value) =>
            value.tableName ||
            value.viewName ||
            value.enumName ||
            value.sequenceName,
        )
        .filter(Boolean)
        .sort();
      return [category, { count: values.length, names }];
    }),
  );
}

function stableSchemaSnapshot(metadata, target) {
  const normalized = stableNormalize(metadata);
  return {
    targetFingerprint: target.targetFingerprint,
    normalizedSchemaSha256: crypto
      .createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex'),
    objectSummary: schemaObjectSummary(normalized),
  };
}

function compareSchemaFiles(outputPath, currentSchemaPath) {
  const generated = fs.readFileSync(outputPath);
  const current = fs.readFileSync(currentSchemaPath);
  const generatedSha256 = crypto
    .createHash('sha256')
    .update(generated)
    .digest('hex');
  const currentSha256 = crypto
    .createHash('sha256')
    .update(current)
    .digest('hex');
  return {
    status: generatedSha256 === currentSha256 ? 'identical' : 'different',
    generatedSha256,
    currentSha256,
    generatedBytes: generated.length,
    currentBytes: current.length,
  };
}

function formatPreflightReport(result, env = process.env) {
  return redactSecrets(
    JSON.stringify(
      {
        generatorVersion: DB_SCHEMA_SYNC_VERSION,
        target: {
          appId: result.target.appId,
          dbBranch: result.target.dbBranch,
          apiDomain: result.target.apiDomain,
          xTtEnv: result.target.xTtEnv,
          environmentId: result.target.environmentId,
          authContextId: result.target.authContextId,
          targetFingerprint: result.target.targetFingerprint,
        },
        before: result.before,
        generator: result.generator,
        after: result.after,
      },
      null,
      2,
    ),
    env,
  );
}

async function runReadOnlyPreflight({
  repoRoot = defaultRepoRoot(),
  env = process.env,
  target = createCanonicalTarget({ env }),
  getSchemaMetadata = ({ target: canonicalTarget, env: targetEnv }) =>
    fetchSchemaMetadata(canonicalTarget, targetEnv),
  runGenerator = ({
    repoRoot: targetRepoRoot,
    outputPath,
    platform,
    env: childEnv,
  }) =>
    runSchemaSync({
      repoRoot: targetRepoRoot,
      outputPath,
      platform,
      env: childEnv,
    }),
  compareSchema = (outputPath, currentSchemaPath) =>
    compareSchemaFiles(outputPath, currentSchemaPath),
  generatorReadOnlyConfirmed = false,
}) {
  if (!generatorReadOnlyConfirmed) {
    throw new Error(
      'Generator read-only behavior is not proven; refusing to run the schema generator',
    );
  }
  if (targetFingerprint(target) !== target.targetFingerprint) {
    throw new Error('Canonical target fingerprint is invalid');
  }

  const temporary = createTemporaryOutput(repoRoot);
  const childEnv = buildGeneratorEnvironment(target, env);
  const currentSchemaPath = protectedSchemaPath(repoRoot);
  let before;
  let after;
  let generatorResult;
  let schemaComparison;

  try {
    before = stableSchemaSnapshot(
      await getSchemaMetadata({ target, env, stage: 'before' }),
      target,
    );
    try {
      generatorResult = await runGenerator({
        repoRoot,
        outputPath: temporary.outputPath,
        platform: process.platform,
        env: childEnv,
        target,
      });
    } catch (error) {
      const redactedError = new Error(
        redactSecrets(error instanceof Error ? error.message : error, childEnv),
      );
      redactedError.details = redactValue(error?.details, childEnv);
      throw redactedError;
    }
    if (generatorResult && generatorResult.status !== 0) {
      throw new Error(
        `db-schema-sync exited with status ${generatorResult.status}`,
      );
    }
    schemaComparison = await compareSchema(
      temporary.outputPath,
      currentSchemaPath,
    );
    after = stableSchemaSnapshot(
      await getSchemaMetadata({ target, env, stage: 'after' }),
      target,
    );

    const generatorTargetFingerprint =
      generatorResult?.targetFingerprint ?? target.targetFingerprint;
    const fingerprintsMatch =
      before.targetFingerprint === target.targetFingerprint &&
      generatorTargetFingerprint === target.targetFingerprint &&
      target.targetFingerprint === after.targetFingerprint;
    if (!fingerprintsMatch) {
      const error = new Error(
        'Canonical target fingerprint changed during preflight',
      );
      error.details = redactValue(
        { before, generator: generatorResult, after },
        childEnv,
      );
      throw error;
    }
    if (before.normalizedSchemaSha256 !== after.normalizedSchemaSha256) {
      const error = new Error(
        'Normalized schema hash changed during preflight',
      );
      error.details = redactValue(
        { before, generator: generatorResult, after },
        childEnv,
      );
      throw error;
    }

    const result = {
      target,
      before,
      generator: {
        version: DB_SCHEMA_SYNC_VERSION,
        targetFingerprint: target.targetFingerprint,
        temporaryOutputPath: temporary.outputPath,
        temporaryOutputSha256:
          schemaComparison.generatedSha256 ||
          schemaComparison.temporaryOutputSha256,
        exitCode:
          generatorResult && generatorResult.status !== undefined
            ? generatorResult.status
            : 0,
        schemaComparison,
      },
      after,
      databaseMutation: 'none-observed',
    };
    return result;
  } finally {
    temporary.cleanup();
  }
}

async function main() {
  const result = await runReadOnlyPreflight({
    env: process.env,
    generatorReadOnlyConfirmed:
      process.env.E1_PREFLIGHT_GENERATOR_READ_ONLY_CONFIRMED === 'true',
  });
  process.stdout.write(`${formatPreflightReport(result)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(
      `${redactSecrets(
        JSON.stringify(
          {
            status: 'BLOCKED',
            reason: redactSecrets(error.message, process.env),
            details: redactValue(error.details, process.env),
            databaseMutation: 'not-established',
          },
          null,
          2,
        ),
        process.env,
      )}\n`,
    );
    process.exitCode = 1;
  });
}

module.exports = {
  DB_SCHEMA_SYNC_PACKAGE,
  DB_SCHEMA_SYNC_VERSION,
  GENERATOR_ENVIRONMENT_VARIABLES,
  redactSecrets,
  redactValue,
  assertSafeOutputPath,
  buildGeneratorEnvironment,
  buildSchemaSyncInvocation,
  compareSchemaFiles,
  createCanonicalTarget,
  createTemporaryOutput,
  fetchSchemaMetadata,
  formatPreflightReport,
  protectedSchemaPath,
  runReadOnlyPreflight,
  runSchemaSync,
  stableSchemaSnapshot,
  targetFingerprint,
};
