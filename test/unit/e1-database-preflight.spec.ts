import {
  buildSchemaSyncInvocation,
  createTemporaryOutput,
  runReadOnlyPreflight,
  runSchemaSync,
  READ_ONLY_INVENTORY_QUERY,
} from '../../scripts/e1-database-preflight';

describe('E1 read-only database preflight wrapper', () => {
  const repoRoot = 'D:\\academic-writing-platform';
  const protectedSchemaPath = `${repoRoot}\\server\\database\\schema.ts`;

  it('rejects an output path equal to the accepted generated schema path', () => {
    expect(() =>
      createTemporaryOutput(repoRoot, {
        requestedOutputPath: protectedSchemaPath,
      }),
    ).toThrow(/protected|schema\.ts/i);
  });

  it('uses a temporary directory outside the repository schema path', () => {
    const output = createTemporaryOutput(repoRoot);

    try {
      expect(output.outputPath).not.toBe(protectedSchemaPath);
      expect(output.outputPath).not.toContain('server\\database\\schema.ts');
      expect(output.tempDir).not.toBe(repoRoot);
    } finally {
      output.cleanup();
    }
  });

  it('invokes db-schema-sync with the exact read-only argument vector', () => {
    const invocation = buildSchemaSyncInvocation({
      outputPath: 'C:\\Temp\\e1-db-preflight\\schema.ts',
      platform: 'linux',
    });

    expect(invocation.command).toBe('npx');
    expect(invocation.args).toEqual([
      '-y',
      '@lark-apaas/db-schema-sync@latest',
      '--output',
      'C:\\Temp\\e1-db-preflight\\schema.ts',
      '--export-custom-types',
    ]);
  });

  it('does not execute database DDL or DML operations', () => {
    expect(READ_ONLY_INVENTORY_QUERY).toMatch(/^\s*SELECT\b/i);
    expect(READ_ONLY_INVENTORY_QUERY).not.toMatch(
      /\b(CREATE|ALTER|DROP|TRUNCATE|INSERT|UPDATE|DELETE)\b/i,
    );

    const invocation = buildSchemaSyncInvocation({
      outputPath: 'C:\\Temp\\e1-db-preflight\\schema.ts',
      platform: 'linux',
    });
    expect(invocation.args.join(' ')).not.toMatch(
      /\b(CREATE|ALTER|DROP|TRUNCATE|INSERT|UPDATE|DELETE)\b/i,
    );
  });

  it('returns failure when the schema generator exits non-zero', () => {
    expect(() =>
      runSchemaSync({
        repoRoot,
        outputPath: 'C:\\Temp\\e1-db-preflight\\schema.ts',
        platform: 'linux',
        spawnSync: () => ({
          status: 17,
          stdout: '',
          stderr: 'generator failed',
        }),
      }),
    ).toThrow(/exited with status 17|generator failed/i);
  });

  it('fails when the before and after inventories differ', async () => {
    const inventories = [
      ['app_users', 'tasks'],
      ['app_users', 'tasks', 'knowledge_documents'],
    ];

    await expect(
      runReadOnlyPreflight({
        repoRoot,
        databaseUrl: 'postgres://preflight.invalid/database',
        generatorReadOnlyConfirmed: true,
        runGenerator: () => ({ status: 0, stdout: '', stderr: '' }),
        getTableInventory: async () => inventories.shift() ?? [],
        compareSchema: () => ({ status: 'not-compared' }),
      }),
    ).rejects.toThrow(/table inventory changed/i);
  });
});
