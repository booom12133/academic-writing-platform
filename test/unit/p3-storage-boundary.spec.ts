import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const readProjectFile = (relativePath: string) =>
  readFileSync(join(root, relativePath), 'utf8');

const storageRoot = '/var/lib/academic-writing-platform/documents';

describe('P3 persistent storage deployment boundary', () => {
  it('defines the canonical service-owned mode-700 storage verifier', () => {
    const scriptPath = join(root, 'deploy', 'scripts', 'verify-storage.sh');
    expect(existsSync(scriptPath)).toBe(true);

    const script = readProjectFile('deploy/scripts/verify-storage.sh');
    expect(script).toContain('set -euo pipefail');
    expect(script).toContain(`storage_root="${storageRoot}"`);
    expect(script).toContain('service_user="academic-writing"');
    expect(script).toContain('service_group="academic-writing"');
    expect(script).toContain("stat -c '%U:%G'");
    expect(script).toContain("stat -c '%a'");
    expect(script).toContain('test "$mode" = "700"');
    expect(script).toContain('test ! -L "$storage_root"');
    expect(script).toContain('readlink -f -- "$storage_root"');
    expect(script).toContain('sudo -u "$service_user" -- test -w');
    expect(script).not.toMatch(/^\s*(?:sudo\s+)?(?:rm|cp|mv|ln)\b/mu);
  });

  it('defines idempotent identity and storage provisioning without destructive account changes', () => {
    const scriptPath = join(root, 'deploy', 'scripts', 'prepare-storage.sh');
    expect(existsSync(scriptPath)).toBe(true);

    const script = readProjectFile('deploy/scripts/prepare-storage.sh');
    expect(script).toContain('set -euo pipefail');
    expect(script).toContain('groupadd --system "$service_group"');
    expect(script).toContain('--system');
    expect(script).toContain('--gid "$service_group"');
    expect(script).toContain('--no-create-home');
    expect(script).toContain('--home-dir "$service_home"');
    expect(script).toContain('service_shell="/usr/sbin/nologin"');
    expect(script).toContain('service_home="/nonexistent"');
    expect(script).toContain('install -d -o "$service_user" -g "$service_group" -m 700');
    expect(script).toContain('refusing to alter it');
    expect(script).not.toMatch(/\b(?:userdel|groupdel|usermod|groupmod)\b/u);
    expect(script).not.toMatch(/^\s*(?:sudo\s+)?(?:rm|cp|mv|ln)\b/mu);
  });

  it('documents the exact root and non-conflicting runtime identity', () => {
    const runbook = readProjectFile('docs/deployment/P3_RUNBOOK.md');
    const manifest = readProjectFile('docs/deployment/P3_ENVIRONMENT_MANIFEST.md');

    expect(runbook).toContain(storageRoot);
    expect(runbook).toContain('academic-writing:academic-writing');
    expect(runbook).toContain('mode `700`');
    expect(runbook).toContain('verify-storage.sh');
    expect(manifest).toContain('DOCUMENT_STORAGE_DRIVER=filesystem');
    expect(manifest).toContain(`DOCUMENT_STORAGE_ROOT=${storageRoot}`);

    const provisioning = readProjectFile('deploy/scripts/prepare-storage.sh');
    expect(provisioning).toContain('-m 700');
  });

  it('keeps persistent storage outside build and release mutation paths', () => {
    const build = readProjectFile('scripts/build.sh');
    const install = readProjectFile('deploy/scripts/release-install.sh');
    const activate = readProjectFile('deploy/scripts/release-activate.sh');
    const rollback = readProjectFile('deploy/scripts/rollback.sh');

    expect(build).not.toContain(storageRoot);
    expect(install).not.toContain(storageRoot);
    expect(activate).not.toContain(storageRoot);
    expect(rollback).not.toContain(storageRoot);
    expect(install).toContain('release-manifest.sha256');
    expect(activate).toContain('current');
    expect(rollback).toContain('reload academic-writing-platform');
  });

  it('keeps the persistent root out of the production artifact closure', () => {
    const artifactGate = readProjectFile('scripts/test-production-artifact.js');
    expect(artifactGate).toContain('unexpected top-level artifact entry: ');
    expect(artifactGate).toContain('ALLOWED_PRODUCTION_SCRIPTS');
    expect(artifactGate).not.toContain(storageRoot);
  });
});
