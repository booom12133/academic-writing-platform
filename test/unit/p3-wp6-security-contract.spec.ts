import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const readProjectFile = (relativePath: string) =>
  readFileSync(join(root, relativePath), 'utf8');

describe('P3 WP6 PM2 state and secret rotation contract', () => {
  const pm2StateRoot = '/var/lib/academic-writing-platform/pm2';
  const envPath = '/etc/academic-writing-platform/production.env';

  it('defines one persistent PM2 state directory for every PM2 lifecycle command', () => {
    const stateScript = readProjectFile('deploy/scripts/prepare-pm2-state.sh');
    const cliScript = readProjectFile('deploy/scripts/pm2-service-cli.sh');
    const pm2Config = readProjectFile('deploy/pm2/ecosystem.config.cjs');
    const plan = readProjectFile('docs/plans/PHASE_P3_IMPLEMENTATION_PLAN.md');
    const runbook = readProjectFile('docs/deployment/P3_RUNBOOK.md');

    expect(stateScript).toContain(`state_root="${pm2StateRoot}"`);
    expect(stateScript).toContain('service_user="academic-writing"');
    expect(stateScript).toContain('service_group="academic-writing"');
    expect(stateScript).toContain('install -d -o "$service_user" -g "$service_group" -m 700');
    expect(stateScript).toContain('service_home="/nonexistent"');
    expect(stateScript).toContain('service_shell="/usr/sbin/nologin"');
    expect(cliScript).toContain(`pm2_home="${pm2StateRoot}"`);
    expect(cliScript).toContain('PM2_HOME="$pm2_home"');
    expect(cliScript).toContain('pm2 "$@"');
    expect(pm2Config).toContain("cwd: '/opt/academic-writing-platform/current/app'");
    expect(plan).toContain(`PM2_HOME=${pm2StateRoot}`);
    expect(runbook).toContain(`PM2_HOME=${pm2StateRoot}`);
  });

  it('defines a root-controlled runtime-readable env file and mandatory rotation gate', () => {
    const verify = readProjectFile('deploy/scripts/verify-production-env.sh');
    const rotate = readProjectFile('deploy/scripts/rotate-production-env.sh');
    const plan = readProjectFile('docs/plans/PHASE_P3_IMPLEMENTATION_PLAN.md');
    const runbook = readProjectFile('docs/deployment/P3_RUNBOOK.md');
    const manifest = readProjectFile('docs/deployment/P3_ENVIRONMENT_MANIFEST.md');

    expect(verify).toContain(`env_file="${envPath}"`);
    expect(verify).toContain('owner="root:academic-writing"');
    expect(verify).toContain('mode="640"');
    expect(verify).toContain('P3_SECURITY_SECRET_ROTATION_REQUIRED');
    expect(verify).toContain('duplicate');
    expect(verify).toContain('sudo -u "$service_user"');
    expect(verify).toContain('node --env-file=');
    expect(rotate).toContain('mktemp');
    expect(rotate).toContain('mv -f');
    expect(rotate).toContain('zotero_connections');
    expect(rotate).toContain('controller review required');
    expect(rotate).toContain('secret-rotation-complete');
    expect(rotate).toContain('DATABASE_URL MIGRATION_DATABASE_URL');
    expect(rotate).toContain('ACADEMIC_SEARCH_CURSOR_SECRET ZOTERO_CREDENTIAL_ENCRYPTION_KEY');
    expect(plan).toContain('P3_SECURITY_SECRET_ROTATION_REQUIRED=YES');
    expect(runbook).toContain('P3_SECURITY_SECRET_ROTATION_REQUIRED=YES');
    expect(manifest).toContain('root:academic-writing');
    expect(manifest).toContain('mode 640');
    expect(manifest).not.toMatch(/owner\s+academic-writing:academic-writing/iu);
  });

  it('keeps the WP6 helper scripts outside the immutable app artifact', () => {
    const artifact = readProjectFile('scripts/test-production-artifact.js');
    expect(existsSync(join(root, 'deploy', 'scripts', 'rotate-production-env.sh'))).toBe(true);
    expect(artifact).toContain('ALLOWED_PRODUCTION_SCRIPTS');
    expect(artifact).not.toContain('rotate-production-env.sh');
  });
});
