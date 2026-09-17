import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const root = join(__dirname, '..', '..');

function findBash(): string {
  const configured = process.env.BASH_BIN?.trim();
  const candidates = configured
    ? [configured]
    : process.platform === 'win32'
      ? [
          'D:\\Git\\bin\\bash.exe',
          join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
          'bash',
        ]
      : ['bash'];

  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (!probe.error && probe.status === 0) {
      return candidate;
    }
  }

  throw new Error('bash is required to validate production shell syntax');
}

function discoverShellScripts(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return discoverShellScripts(entryPath);
    }
    return entry.isFile() && entry.name.endsWith('.sh') ? [entryPath] : [];
  });
}

const bash = findBash();
const shellScripts = [
  ...discoverShellScripts(join(root, 'deploy')),
  join(root, 'scripts', 'run.sh'),
]
  .map((scriptPath) => relative(root, scriptPath).replaceAll('\\', '/'))
  .sort();

describe('P3 production shell syntax gate', () => {
  it('dynamically covers deploy/**/*.sh and scripts/run.sh', () => {
    expect(shellScripts).toContain('deploy/scripts/verify-storage.sh');
    expect(shellScripts).toContain('scripts/run.sh');
    expect(shellScripts.length).toBeGreaterThan(2);
    for (const shellScript of shellScripts) {
      expect(existsSync(join(root, shellScript))).toBe(true);
    }
  });

  it.each(shellScripts)('%s passes bash -n', (shellScript) => {
    const result = spawnSync(bash, ['-n', shellScript], {
      cwd: root,
      encoding: 'utf8',
    });

    if (result.error || result.status !== 0) {
      const detail = [result.error?.message, result.stderr]
        .filter(Boolean)
        .join('\n')
        .trim();
      throw new Error(`${shellScript} failed bash -n${detail ? `:\n${detail}` : ''}`);
    }
  });

  it('moves the PM2 wrapper to a deterministic cwd before privilege drop', () => {
    const wrapperPath = join(root, 'deploy', 'scripts', 'pm2-service-cli.sh');
    const privateCallerRoot = join(tmpdir(), 'p3-private-caller-cwd');
    const fixture = [
      `source "${wrapperPath.replaceAll('\\', '/')}"`,
      `cd "${privateCallerRoot.replaceAll('\\', '/')}"`,
      'enter_pm2_safe_cwd',
      'pwd -P',
    ].join('\n');
    mkdirSync(privateCallerRoot, { recursive: true });
    try {
      const result = spawnSync(bash, ['-c', fixture], {
        cwd: root,
        encoding: 'utf8',
      });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe('/');

      const wrapper = readFileSync(wrapperPath, 'utf8');
      expect(wrapper).toMatch(
        /enter_pm2_safe_cwd\s+exec sudo -u "\$service_user"/u,
      );
    } finally {
      rmSync(privateCallerRoot, { recursive: true, force: true });
    }
  });

  it.each<[string, number]>([
    ['/var/lib/academic-writing-platform/documents', 0],
    ['/opt/academic-writing-platform/releases/release-1', 73],
    ['/opt/academic-writing-platform/current', 73],
    ['/opt/academic-writing-platform/current/app', 73],
    ['/tmp/documents', 73],
    ['/var/tmp/documents', 73],
  ])('keeps the storage path guard result for %s', (resolvedRoot, expectedStatus) => {
    const storageScript = readFileSync(
      join(root, 'deploy', 'scripts', 'verify-storage.sh'),
      'utf8',
    );
    const guard = storageScript.match(
      /case "\$resolved_root" in[\s\S]*?\nesac/u,
    )?.[0];
    expect(guard).toBeDefined();

    const fixture = [
      'set -euo pipefail',
      'fail() { exit 73; }',
      'resolved_root="$1"',
      guard,
    ].join('\n');
    const result = spawnSync(
      bash,
      ['-c', fixture, 'storage-path-guard', resolvedRoot],
      { cwd: root, encoding: 'utf8' },
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(expectedStatus);
  });
});
