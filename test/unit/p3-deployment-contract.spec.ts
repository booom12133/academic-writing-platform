import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const readProjectFile = (relativePath: string) =>
  readFileSync(join(root, relativePath), 'utf8');

describe('P3 deployment contract', () => {
  it('defines a single-fork PM2 process with external env loading', () => {
    const config = readProjectFile('deploy/pm2/ecosystem.config.cjs');

    expect(config).toContain("name: 'academic-writing-platform'");
    expect(config).toContain("script: 'server/main.js'");
    expect(config).toContain("cwd: '/opt/academic-writing-platform/current/app'");
    expect(config).toContain('instances: 1');
    expect(config).toContain("exec_mode: 'fork'");
    expect(config).toContain('autorestart: true');
    expect(config).toContain(
      "'--env-file=/etc/academic-writing-platform/production.env'",
    );
    expect(config).not.toMatch(/DATABASE_URL|API_KEY|PASSWORD|SECRET/u);
  });

  it('defines HTTPS-only public proxying to loopback Node', () => {
    const config = readProjectFile(
      'deploy/nginx/academic-writing-platform.conf',
    );

    expect(config).toContain('server_name write.yingrenji.cn');
    expect(config).toContain('return 301 https://$host$request_uri;');
    expect(config).toContain('proxy_pass http://127.0.0.1:3000;');
    expect(config).toContain('client_max_body_size 1m;');
    expect(config).toContain('ssl_certificate');
    expect(config).toContain('Strict-Transport-Security');
  });

  it('provides the approved host and release helper scripts', () => {
    for (const script of [
      'host-preflight.sh',
      'release-install.sh',
      'release-activate.sh',
      'verify-live.sh',
      'rollback.sh',
      'prepare-storage.sh',
      'verify-storage.sh',
      'prepare-pm2-state.sh',
      'pm2-service-cli.sh',
      'verify-production-env.sh',
      'rotate-production-env.sh',
    ]) {
      expect(existsSync(join(root, 'deploy', 'scripts', script))).toBe(true);
    }

    const preflight = readProjectFile('deploy/scripts/host-preflight.sh');
    expect(preflight).toContain('ss -ltnp');
    expect(preflight).toContain('NOT_FOUND');
    expect(preflight).toContain('node');
    expect(preflight).toContain('npm');
    expect(preflight).toContain('systemctl');
    expect(preflight).not.toContain('set -euo pipefail');
    expect(readProjectFile('deploy/scripts/release-install.sh')).toContain(
      'release-manifest.sha256',
    );
    expect(readProjectFile('deploy/scripts/release-activate.sh')).toContain(
      'current',
    );
    expect(readProjectFile('deploy/scripts/verify-live.sh')).toContain(
      '/health/live',
    );
    expect(readProjectFile('deploy/scripts/rollback.sh')).toContain(
      'reload academic-writing-platform',
    );
    expect(readProjectFile('deploy/scripts/rollback.sh')).toContain(
      'pm2-service-cli.sh',
    );
    expect(readProjectFile('deploy/scripts/verify-live.sh')).toContain(
      'pm2-service-cli.sh',
    );
    expect(readProjectFile('deploy/scripts/verify-storage.sh')).toContain(
      '/var/lib/academic-writing-platform/documents',
    );
    expect(readProjectFile('deploy/scripts/prepare-storage.sh')).toContain(
      'useradd',
    );
  });

  it('keeps the frozen service identity out of the PM2 home contract', () => {
    const plan = readProjectFile('docs/plans/PHASE_P3_IMPLEMENTATION_PLAN.md');
    const runbook = readProjectFile('docs/deployment/P3_RUNBOOK.md');
    const scripts = [
      'deploy/scripts/rollback.sh',
      'deploy/scripts/verify-live.sh',
      'deploy/scripts/pm2-service-cli.sh',
    ].map(readProjectFile).join('\n');

    for (const content of [plan, runbook, scripts]) {
      expect(content).toContain('/var/lib/academic-writing-platform/pm2');
    }
    expect(scripts).not.toContain('/home/academic-writing');
    expect(plan).toContain('--hp /var/lib/academic-writing-platform/pm2');
    expect(runbook).toContain('HOME=/nonexistent');
    expect(runbook).toContain('shell remains `/usr/sbin/nologin`');
  });

  it('defines an external-state Playwright contract without credentials', () => {
    const config = readProjectFile('playwright.config.ts');
    const authHelper = readProjectFile('test/e2e/support/p3-auth.ts');
    const e2e = readProjectFile('test/e2e/p3-production.spec.ts');

    expect(config).toContain('baseURL');
    expect(config).toContain('storageState');
    expect(authHelper).toContain('P3_STORAGE_STATE_USER_A');
    expect(authHelper).toContain('P3_STORAGE_STATE_USER_B');
    expect(authHelper).not.toMatch(/password|clientSecret|apiKey|token\s*:/iu);
    expect(e2e).toContain('E2E-01');
    expect(e2e).toContain('E2E-06');
    expect(e2e).toContain('E2E-10');
  });
});
