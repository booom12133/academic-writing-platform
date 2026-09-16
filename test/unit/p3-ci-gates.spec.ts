import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const workflow = readFileSync(
  join(root, '.github', 'workflows', 'ci.yml'),
  'utf8',
);

function job(name: string): string {
  const startMarker = `  ${name}:`;
  const start = workflow.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`missing required CI job: ${name}`);
  }

  const remainder = workflow.slice(start + startMarker.length);
  const nextJob = remainder.search(/^  [a-z0-9-]+:\r?$/m);

  return workflow.slice(
    start,
    nextJob === -1 ? workflow.length : start + startMarker.length + nextJob,
  );
}

describe('P3 Part A remediation CI gates', () => {
  it('runs every environment-gated Linux integration with explicit prerequisites', () => {
    const nginx = job('nginx-upload-boundary');
    const rotation = job('wp6-step5b');
    const postgres = job('postgres-schema');

    expect(nginx).toContain('P3_NGINX_UPLOAD_INTEGRATION: YES');
    expect(nginx).toContain(
      'test/integration/p3-upload-boundary.integration.spec.ts',
    );
    expect(rotation).toContain('P3_WP6_INTEGRATION: YES');
    expect(rotation).toContain('test/unit/p3-wp6-step5b.integration.spec.ts');
    expect(postgres).toContain('P3_POSTGRES_ROLE_INTEGRATION: YES');
    expect(postgres).toContain('test/unit/postgres-schema.integration.spec.ts');
    expect(postgres).toContain(
      'test/unit/postgres-database-readiness.integration.spec.ts',
    );
    expect(postgres).toContain('P3_PRODUCTION_DATABASE_VERIFY_SCRIPT:');
    expect(postgres).toContain(
      'P3_ROLLBACK_COMPAT_PREVIOUS_SHA: 666f40309b42f2c0d44e4fd6ecbcd1e81f869a8d',
    );
    expect(postgres).toContain(
      'test/integration/p3-rollback-compatibility.integration.spec.ts',
    );

    for (const requiredJob of [nginx, rotation, postgres]) {
      expect(requiredJob).not.toContain('continue-on-error: true');
    }
  });

  it('runs the remediation contract, failure-composition, health-auth, and artifact suites explicitly', () => {
    const gates = job('production-gates');

    expect(gates).toContain('- name: Validate production shell syntax');
    expect(gates).toContain(
      'test/unit/p3-deployment-shell-syntax.spec.ts',
    );

    for (const suite of [
      'test/unit/db-migrate.spec.ts',
      'test/unit/db-migration-schema-contract.spec.ts',
      'test/unit/postgres-role-grants.spec.ts',
      'test/unit/verify-production-database.spec.ts',
      'test/integration/p3-first-deploy-composition.spec.ts',
      'test/unit/p3-health-auth-contract.spec.ts',
      'test/unit/p3-wp6-security-contract.spec.ts',
      'test/unit/p3-deployment-contract.spec.ts',
      'test/unit/p3-release-integrity.spec.ts',
      'test/unit/production-artifact-closure.spec.ts',
    ]) {
      expect(gates).toContain(suite);
    }
  });

  it('makes the final production gate depend on every required evidence job', () => {
    const gates = job('production-gates');

    expect(gates).toContain(
      'needs: [verify, wp6-step5b, nginx-upload-boundary, postgres-schema]',
    );
    expect(gates).not.toContain('continue-on-error: true');

    const baseline = job('verify');
    expect(baseline).toContain('run: npm test -- --runInBand');
    expect(baseline).toContain('run: npm run lint');
    expect(baseline).toContain('run: npm run type:check:server');
    expect(baseline).toContain('run: npm run type:check:client');
    expect(baseline).toContain('run: npm run build:server');
    expect(baseline).toContain('run: npm run build:client');
  });
});
