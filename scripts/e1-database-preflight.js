'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DB_SCHEMA_SYNC_PACKAGE = '@lark-apaas/db-schema-sync@latest';
const READ_ONLY_INVENTORY_QUERY = `
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
  ORDER BY table_schema, table_name
`;

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
    throw new Error(`db-schema-sync failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    throw new Error(
      `db-schema-sync exited with status ${result.status}${detail ? `: ${detail}` : ''}`,
    );
  }
  return result;
}

async function queryTableInventory(databaseUrl) {
  if (!databaseUrl) {
    throw new Error(
      'E1_PREFLIGHT_DATABASE_URL is required for the intended database inventory',
    );
  }

  const { Client } = require('pg');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query(READ_ONLY_INVENTORY_QUERY);
    return result.rows.map((row) => `${row.table_schema}.${row.table_name}`);
  } finally {
    await client.end();
  }
}

function normalizeInventory(inventory) {
  return [...inventory].map(String).sort();
}

function inventoryChanged(before, after) {
  return (
    JSON.stringify(normalizeInventory(before)) !==
    JSON.stringify(normalizeInventory(after))
  );
}

function compareSchemaFiles(outputPath, currentSchemaPath) {
  const generated = fs.readFileSync(outputPath);
  const current = fs.readFileSync(currentSchemaPath);
  const generatedHash = crypto
    .createHash('sha256')
    .update(generated)
    .digest('hex');
  const currentHash = crypto.createHash('sha256').update(current).digest('hex');
  return {
    status: generatedHash === currentHash ? 'identical' : 'different',
    generatedSha256: generatedHash,
    currentSha256: currentHash,
    generatedBytes: generated.length,
    currentBytes: current.length,
  };
}

async function runReadOnlyPreflight({
  repoRoot = defaultRepoRoot(),
  databaseUrl,
  platform = process.platform,
  env = process.env,
  getTableInventory = ({ databaseUrl: targetDatabaseUrl }) =>
    queryTableInventory(targetDatabaseUrl),
  runGenerator = ({
    repoRoot: targetRepoRoot,
    outputPath,
    platform: targetPlatform,
    env: targetEnv,
  }) =>
    runSchemaSync({
      repoRoot: targetRepoRoot,
      outputPath,
      platform: targetPlatform,
      env: targetEnv,
    }),
  compareSchema = (outputPath, currentSchemaPath) =>
    compareSchemaFiles(outputPath, currentSchemaPath),
  generatorReadOnlyConfirmed = false,
}) {
  if (!databaseUrl) {
    throw new Error(
      'E1_PREFLIGHT_DATABASE_URL is required; refusing to run against an unspecified environment',
    );
  }
  if (!generatorReadOnlyConfirmed) {
    throw new Error(
      'Generator read-only behavior is not proven; refusing to run the schema generator',
    );
  }

  const temporary = createTemporaryOutput(repoRoot);
  const currentSchemaPath = protectedSchemaPath(repoRoot);
  let tableInventoryBefore;
  let tableInventoryAfter;
  let generatorResult;
  let schemaComparison;

  try {
    tableInventoryBefore = await getTableInventory({
      databaseUrl,
      query: READ_ONLY_INVENTORY_QUERY,
    });
    generatorResult = await runGenerator({
      repoRoot,
      outputPath: temporary.outputPath,
      platform,
      env,
    });
    if (generatorResult && generatorResult.status !== 0) {
      throw new Error(
        `db-schema-sync exited with status ${generatorResult.status}`,
      );
    }
    schemaComparison = await compareSchema(
      temporary.outputPath,
      currentSchemaPath,
    );
    tableInventoryAfter = await getTableInventory({
      databaseUrl,
      query: READ_ONLY_INVENTORY_QUERY,
    });

    if (inventoryChanged(tableInventoryBefore, tableInventoryAfter)) {
      const error = new Error(
        'Table inventory changed during read-only preflight',
      );
      error.details = { tableInventoryBefore, tableInventoryAfter };
      throw error;
    }

    return {
      temporaryOutputPath: temporary.outputPath,
      schemaComparison,
      tableInventoryBefore: normalizeInventory(tableInventoryBefore),
      tableInventoryAfter: normalizeInventory(tableInventoryAfter),
      generatorStatus:
        generatorResult && generatorResult.status !== undefined
          ? generatorResult.status
          : 0,
      databaseMutation: 'none-observed',
    };
  } finally {
    temporary.cleanup();
  }
}

async function main() {
  const databaseUrl = process.env.E1_PREFLIGHT_DATABASE_URL;
  const generatorReadOnlyConfirmed =
    process.env.E1_PREFLIGHT_GENERATOR_READ_ONLY_CONFIRMED === 'true';
  const result = await runReadOnlyPreflight({
    databaseUrl,
    generatorReadOnlyConfirmed,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(
      `${JSON.stringify(
        {
          status: 'BLOCKED',
          reason: error.message,
          details: error.details,
          databaseMutation: 'not-established',
        },
        null,
        2,
      )}\n`,
    );
    process.exitCode = 1;
  });
}

module.exports = {
  READ_ONLY_INVENTORY_QUERY,
  assertSafeOutputPath,
  buildSchemaSyncInvocation,
  compareSchemaFiles,
  createTemporaryOutput,
  inventoryChanged,
  protectedSchemaPath,
  queryTableInventory,
  runReadOnlyPreflight,
  runSchemaSync,
};
