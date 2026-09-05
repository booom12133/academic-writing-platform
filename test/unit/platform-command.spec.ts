import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commandForPlatform, toolInvocation } from '../../scripts/platform-command';

describe('commandForPlatform', () => {
  it('uses Windows command shims for npm tools', () => {
    expect(commandForPlatform('npx', 'win32')).toBe('npx.cmd');
    expect(commandForPlatform('npm', 'win32')).toBe('npm.cmd');
  });

  it('keeps Unix command names unchanged', () => {
    expect(commandForPlatform('npx', 'linux')).toBe('npx');
    expect(commandForPlatform('npm', 'darwin')).toBe('npm');
  });

  it('uses npm cli scripts when npm provides its executable path', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'platform-command-'));
    try {
      const npmBin = join(tempRoot, 'node_modules', 'npm', 'bin');
      mkdirSync(npmBin, { recursive: true });
      const npmExecPath = join(npmBin, 'npm-cli.js');
      const npxCliPath = join(npmBin, 'npx-cli.js');
      writeFileSync(npmExecPath, '');
      writeFileSync(npxCliPath, '');

      const invocation = toolInvocation('npx', process.platform, { npm_execpath: npmExecPath });
      expect(invocation.command).toBe(process.execPath);
      expect(invocation.args[0]).toBe(npxCliPath);
      expect(invocation.shell).toBe(false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
