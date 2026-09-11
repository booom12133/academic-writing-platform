import {
  createStep5BFixture,
  type RotationResult,
} from '../support/p3-wp6-step5b-fixture';

const integrationEnabled =
  process.env.P3_WP6_INTEGRATION === 'YES';

const describeStep5B =
  integrationEnabled ? describe : describe.skip;

if (integrationEnabled) {
  jest.setTimeout(120_000);
}

async function expectRoleLogin(
  fixture: ReturnType<typeof createStep5BFixture>,
  role: 'academic_writing_app' | 'academic_writing_migrator',
  password: string,
): Promise<void> {
  const client = await fixture.connectRole(role, password);
  try {
    const result = await client.query('SELECT current_user AS current_user');
    expect(result.rows[0].current_user).toBe(role);
  } finally {
    await client.end();
  }
}

async function expectRoleLoginFailure(
  fixture: ReturnType<typeof createStep5BFixture>,
  role: 'academic_writing_app' | 'academic_writing_migrator',
  password: string,
): Promise<void> {
  await expect(fixture.connectRole(role, password)).rejects.toThrow();
}

function combinedOutput(result: RotationResult): string {
  return `${result.stdout}${result.stderr}`;
}

function parseEnvText(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/).filter(Boolean)) {
    const separator = line.indexOf('=');
    if (separator <= 0) throw new Error('invalid production env line');
    const key = line.slice(0, separator);
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      throw new Error(`duplicate production env key: ${key}`);
    }
    values[key] = line.slice(separator + 1);
  }
  return values;
}

function assertExactEnv(
  actual: Record<string, string>,
  expected: Record<string, string>,
  label: string,
): void {
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error(`${label} key set mismatch`);
  }
  for (const key of expectedKeys) {
    if (actual[key] !== expected[key]) {
      throw new Error(`${label} value mismatch for ${key}`);
    }
  }
}

function assertSecretAbsent(text: string, source: string, secret: string): void {
  if (text.includes(secret)) {
    throw new Error(`${source} contains a forbidden secret`);
  }
}

function assertNoSecretLeakage(
  fixture: ReturnType<typeof createStep5BFixture>,
  result: RotationResult,
  extraSecrets: string[] = [],
  options: { checkServiceLogs?: boolean } = {},
): void {
  const secrets = fixture.secretValues(extraSecrets);
  const serviceLogs = options.checkServiceLogs ? fixture.databaseServiceLogs() : undefined;
  for (const secret of secrets) {
    assertSecretAbsent(result.stdout, 'rotation stdout', secret);
    assertSecretAbsent(result.stderr, 'rotation stderr', secret);
    if (serviceLogs !== undefined) {
      assertSecretAbsent(serviceLogs, 'PostgreSQL service logs', secret);
    }
  }
  const currentEnv = fixture.readFile(fixture.currentEnvPath);
  assertSecretAbsent(currentEnv, 'current production.env', fixture.adminPassword);
  for (const secret of extraSecrets) {
    assertSecretAbsent(currentEnv, 'current production.env', secret);
  }
  if (fixture.state(fixture.candidateEnvPath).exists) {
    const candidateEnv = fixture.readFile(fixture.candidateEnvPath);
    assertSecretAbsent(candidateEnv, 'candidate production.env', fixture.adminPassword);
    for (const secret of extraSecrets) {
      assertSecretAbsent(candidateEnv, 'candidate production.env', secret);
    }
  }
}

describeStep5B('P3 WP6 Step5B disposable PostgreSQL integration', () => {
  let fixture: ReturnType<typeof createStep5BFixture>;

  beforeAll(async () => {
    fixture = createStep5BFixture();
    await fixture.setup();
  });

  afterAll(async () => {
    await fixture?.teardown();
  });

  beforeEach(async () => {
    await fixture.reset();
  });

  it('S1 completes the real rotation chain and activates the candidate', async () => {
    const result = await fixture.runRotation();
    expect(result.code).toBe(0);
    assertNoSecretLeakage(fixture, result);

    const finalEnv = parseEnvText(fixture.readFile(fixture.currentEnvPath));
    assertExactEnv(finalEnv, fixture.candidateEnv(), 'final production.env');
    expect(finalEnv.CORS_ALLOWED_ORIGINS).toBe('https://write.yingrenji.cn');
    expect(finalEnv.EMBEDDING_BASE_URL).toBe('https://api.siliconflow.cn/v1');
    expect(finalEnv.EMBEDDING_MODEL).toBe('BAAI/bge-m3');
    expect(finalEnv.EMBEDDING_DIMENSIONS).toBe('1024');
    expect(finalEnv).not.toHaveProperty('P3_DB_ADMIN_PASSWORD');
    expect(fixture.state(fixture.currentEnvPath)).toEqual({
      exists: true,
      owner: 'root:academic-writing',
      mode: '640',
    });
    expect(fixture.state(fixture.markerPath)).toEqual({
      exists: true,
      owner: 'root:root',
      mode: '600',
    });
    expect(fixture.state(fixture.candidateEnvPath).exists).toBe(false);

    await expectRoleLoginFailure(fixture, 'academic_writing_app', fixture.appOldPassword);
    await expectRoleLoginFailure(fixture, 'academic_writing_migrator', fixture.migratorOldPassword);
    await expectRoleLogin(fixture, 'academic_writing_app', fixture.appNewPassword);
    await expectRoleLogin(fixture, 'academic_writing_migrator', fixture.migratorNewPassword);
  });

  it('S2 rejects an invalid candidate before database mutation', async () => {
    fixture.chmodCandidate('644');
    const result = await fixture.runRotation();
    expect(result.code).not.toBe(0);
    assertNoSecretLeakage(fixture, result);
    expect(fixture.state(fixture.markerPath).exists).toBe(false);
    expect(fixture.state(fixture.candidateEnvPath)).toMatchObject({
      exists: true,
      owner: 'root:root',
      mode: '644',
    });
    await expectRoleLogin(fixture, 'academic_writing_app', fixture.appOldPassword);
    await expectRoleLogin(fixture, 'academic_writing_migrator', fixture.migratorOldPassword);
  });

  it('S3 authenticates the admin over verified TLS with the correct hostname and CA', async () => {
    const client = await fixture.connectAdmin();
    try {
      const result = await client.query('SELECT current_user AS current_user');
      expect(result.rows[0].current_user).toBe('p3_rotation_admin');
    } finally {
      await client.end();
    }
  });

  it('S4 rejects the wrong admin password', async () => {
    await expect(fixture.connectAdmin({ password: fixture.wrongPassword })).rejects.toThrow();
    const result = await fixture.runRotation({ adminPassword: fixture.wrongPassword });
    expect(result.code).not.toBe(0);
    assertNoSecretLeakage(fixture, result, [fixture.wrongPassword], { checkServiceLogs: true });
    assertExactEnv(parseEnvText(fixture.readFile(fixture.currentEnvPath)), fixture.currentEnv(), 'current production.env');
    expect(fixture.state(fixture.markerPath).exists).toBe(false);
    expect(fixture.state(fixture.candidateEnvPath)).toEqual({
      exists: true,
      owner: 'root:root',
      mode: '600',
    });
    await expectRoleLogin(fixture, 'academic_writing_app', fixture.appOldPassword);
    await expectRoleLogin(fixture, 'academic_writing_migrator', fixture.migratorOldPassword);
    await expectRoleLoginFailure(fixture, 'academic_writing_app', fixture.appNewPassword);
    await expectRoleLoginFailure(fixture, 'academic_writing_migrator', fixture.migratorNewPassword);
  });

  it('S5 rejects a wrong TLS CA before database authentication', async () => {
    await fixture.rejectWrongTlsCa();
  });

  it('S6 rejects the certificate hostname mismatch', async () => {
    await expect(fixture.connectAdmin({ host: '127.0.0.1' })).rejects.toThrow();
  });

  it('S7 fails closed when the real Zotero safety query finds a credential', async () => {
    await fixture.insertZoteroRow();
    const result = await fixture.runRotation();
    expect(result.code).not.toBe(0);
    assertNoSecretLeakage(fixture, result, [], { checkServiceLogs: true });
    expect(combinedOutput(result)).toContain('encrypted Zotero credentials exist');
    expect(fixture.state(fixture.markerPath).exists).toBe(false);
    expect(fixture.state(fixture.candidateEnvPath).exists).toBe(true);
    await expectRoleLogin(fixture, 'academic_writing_app', fixture.appOldPassword);
    await expectRoleLogin(fixture, 'academic_writing_migrator', fixture.migratorOldPassword);
  });

  it('S8 rejects a missing app role before beginning rotation', async () => {
    await fixture.dropRole('academic_writing_app');
    const result = await fixture.runRotation();
    expect(result.code).not.toBe(0);
    assertNoSecretLeakage(fixture, result);
    expect(combinedOutput(result)).toContain('required PostgreSQL role is missing');
    expect(fixture.state(fixture.candidateEnvPath).exists).toBe(true);
    expect(fixture.state(fixture.markerPath).exists).toBe(false);
  });

  it('S9 rejects a missing migrator role before beginning rotation', async () => {
    await fixture.dropRole('academic_writing_migrator');
    const result = await fixture.runRotation();
    expect(result.code).not.toBe(0);
    assertNoSecretLeakage(fixture, result);
    expect(combinedOutput(result)).toContain('required PostgreSQL role is missing');
    expect(fixture.state(fixture.candidateEnvPath).exists).toBe(true);
    expect(fixture.state(fixture.markerPath).exists).toBe(false);
  });

  it('S10 rolls back after app ALTER succeeds and migrator ADMIN OPTION fails', async () => {
    await fixture.revokeMigratorAdminOption();
    const result = await fixture.runRotation();
    expect(result.code).not.toBe(0);
    assertNoSecretLeakage(fixture, result, [], { checkServiceLogs: true });
    expect(combinedOutput(result)).toContain('permission denied');
    expect(fixture.state(fixture.markerPath).exists).toBe(false);
    expect(fixture.state(fixture.candidateEnvPath).exists).toBe(true);
    await expectRoleLogin(fixture, 'academic_writing_app', fixture.appOldPassword);
    await expectRoleLogin(fixture, 'academic_writing_migrator', fixture.migratorOldPassword);
    await expectRoleLoginFailure(fixture, 'academic_writing_app', fixture.appNewPassword);
    await expectRoleLoginFailure(fixture, 'academic_writing_migrator', fixture.migratorNewPassword);
  });

  it('S11 retains the old env after app validation fails post-COMMIT', async () => {
    const nextCandidate = fixture.candidateEnv();
    nextCandidate.DATABASE_URL = nextCandidate.DATABASE_URL.replace(':5432/', ':65432/');
    await fixture.setCandidateEnv(nextCandidate);
    const result = await fixture.runRotation();
    expect(result.code).not.toBe(0);
    assertNoSecretLeakage(fixture, result);
    expect(fixture.readFile(fixture.currentEnvPath)).toContain(fixture.currentEnv().DATABASE_URL);
    expect(fixture.state(fixture.markerPath).exists).toBe(false);
    expect(fixture.state(fixture.candidateEnvPath).exists).toBe(true);
    await expectRoleLogin(fixture, 'academic_writing_app', fixture.appNewPassword);
    await expectRoleLogin(fixture, 'academic_writing_migrator', fixture.migratorNewPassword);
  });

  it('S12 retains the old env after migrator validation fails post-COMMIT', async () => {
    const nextCandidate = fixture.candidateEnv();
    nextCandidate.MIGRATION_DATABASE_URL = nextCandidate.MIGRATION_DATABASE_URL.replace(':5432/', ':65432/');
    await fixture.setCandidateEnv(nextCandidate);
    const result = await fixture.runRotation();
    expect(result.code).not.toBe(0);
    assertNoSecretLeakage(fixture, result);
    expect(fixture.readFile(fixture.currentEnvPath)).toContain(fixture.currentEnv().DATABASE_URL);
    expect(fixture.state(fixture.markerPath).exists).toBe(false);
    expect(fixture.state(fixture.candidateEnvPath).exists).toBe(true);
    await expectRoleLogin(fixture, 'academic_writing_app', fixture.appNewPassword);
    await expectRoleLogin(fixture, 'academic_writing_migrator', fixture.migratorNewPassword);
  });

  it('S13 intercepts only activation mv and preserves marker and candidate boundaries', async () => {
    const faultBin = await fixture.createActivationFaultWrapper();
    const result = await fixture.runRotation({ pathPrefix: faultBin });
    expect(result.code).not.toBe(0);
    assertNoSecretLeakage(fixture, result);
    expect(combinedOutput(result)).toContain('synthetic activation failure');
    expect(fixture.readFile(fixture.currentEnvPath)).toContain(fixture.currentEnv().DATABASE_URL);
    expect(fixture.state(fixture.markerPath).exists).toBe(false);
    expect(fixture.state(fixture.candidateEnvPath)).toMatchObject({
      exists: true,
      owner: 'root:root',
      mode: '600',
    });
    await expectRoleLogin(fixture, 'academic_writing_app', fixture.appNewPassword);
    await expectRoleLogin(fixture, 'academic_writing_migrator', fixture.migratorNewPassword);
  });

  it('S14 creates the marker only after success and retains candidate on failure', async () => {
    const success = await fixture.runRotation();
    expect(success.code).toBe(0);
    assertNoSecretLeakage(fixture, success);
    expect(fixture.state(fixture.markerPath).exists).toBe(true);
    expect(fixture.state(fixture.candidateEnvPath).exists).toBe(false);

    await fixture.reset();
    fixture.chmodCandidate('644');
    const failure = await fixture.runRotation();
    expect(failure.code).not.toBe(0);
    assertNoSecretLeakage(fixture, failure);
    expect(fixture.state(fixture.markerPath).exists).toBe(false);
    expect(fixture.state(fixture.candidateEnvPath).exists).toBe(true);
  });
});
