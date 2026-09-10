import {
  createStep5BFixture,
  type RotationResult,
} from '../support/p3-wp6-step5b-fixture';

const integrationEnabled =
  process.env.P3_WP6_INTEGRATION === 'YES';

const describeStep5B =
  integrationEnabled ? describe : describe.skip;

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

function assertAdminSecretAbsent(
  fixture: ReturnType<typeof createStep5BFixture>,
  result: RotationResult,
): void {
  expect(combinedOutput(result)).not.toContain(fixture.adminPassword);
  expect(fixture.readFile(fixture.currentEnvPath)).not.toContain(fixture.adminPassword);
  if (fixture.state(fixture.candidateEnvPath).exists) {
    expect(fixture.readFile(fixture.candidateEnvPath)).not.toContain(fixture.adminPassword);
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
    assertAdminSecretAbsent(fixture, result);

    const finalEnv = fixture.readFile(fixture.currentEnvPath);
    expect(finalEnv).toContain(fixture.candidateEnv().DATABASE_URL);
    expect(finalEnv).toContain(fixture.candidateEnv().MIGRATION_DATABASE_URL);
    expect(finalEnv).toContain('CORS_ALLOWED_ORIGINS=https://write.yingrenji.cn');
    expect(finalEnv).toContain('EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1');
    expect(finalEnv).toContain('EMBEDDING_MODEL=BAAI/bge-m3');
    expect(finalEnv).toContain('EMBEDDING_DIMENSIONS=1024');
    expect(finalEnv).not.toContain(fixture.adminPassword);
    expect(combinedOutput(result)).not.toContain(fixture.appNewPassword);
    expect(combinedOutput(result)).not.toContain(fixture.migratorNewPassword);
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
    assertAdminSecretAbsent(fixture, result);
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
  });

  it('S5 rejects a wrong TLS CA before database authentication', async () => {
    await expect(fixture.connectAdmin({ ca: fixture.wrongCa })).rejects.toThrow();
  });

  it('S6 rejects the certificate hostname mismatch', async () => {
    await expect(fixture.connectAdmin({ host: '127.0.0.1' })).rejects.toThrow();
  });

  it('S7 fails closed when the real Zotero safety query finds a credential', async () => {
    await fixture.insertZoteroRow();
    const result = await fixture.runRotation();
    expect(result.code).not.toBe(0);
    assertAdminSecretAbsent(fixture, result);
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
    assertAdminSecretAbsent(fixture, result);
    expect(combinedOutput(result)).toContain('required PostgreSQL role is missing');
    expect(fixture.state(fixture.candidateEnvPath).exists).toBe(true);
    expect(fixture.state(fixture.markerPath).exists).toBe(false);
  });

  it('S9 rejects a missing migrator role before beginning rotation', async () => {
    await fixture.dropRole('academic_writing_migrator');
    const result = await fixture.runRotation();
    expect(result.code).not.toBe(0);
    assertAdminSecretAbsent(fixture, result);
    expect(combinedOutput(result)).toContain('required PostgreSQL role is missing');
    expect(fixture.state(fixture.candidateEnvPath).exists).toBe(true);
    expect(fixture.state(fixture.markerPath).exists).toBe(false);
  });

  it('S10 rolls back after app ALTER succeeds and migrator ADMIN OPTION fails', async () => {
    await fixture.revokeMigratorAdminOption();
    const result = await fixture.runRotation();
    expect(result.code).not.toBe(0);
    assertAdminSecretAbsent(fixture, result);
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
    assertAdminSecretAbsent(fixture, result);
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
    assertAdminSecretAbsent(fixture, result);
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
    assertAdminSecretAbsent(fixture, result);
    expect(combinedOutput(result)).toContain('synthetic activation failure');
    expect(combinedOutput(result)).not.toContain(fixture.adminPassword);
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
    assertAdminSecretAbsent(fixture, success);
    expect(fixture.state(fixture.markerPath).exists).toBe(true);
    expect(fixture.state(fixture.candidateEnvPath).exists).toBe(false);

    await fixture.reset();
    fixture.chmodCandidate('644');
    const failure = await fixture.runRotation();
    expect(failure.code).not.toBe(0);
    assertAdminSecretAbsent(fixture, failure);
    expect(fixture.state(fixture.markerPath).exists).toBe(false);
    expect(fixture.state(fixture.candidateEnvPath).exists).toBe(true);
  });
});
