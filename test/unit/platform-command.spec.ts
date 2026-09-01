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
    const invocation = toolInvocation('npx', 'win32', {
      npm_execpath: 'D:\\app\\node_modules\\npm\\bin\\npm-cli.js',
    });
    expect(invocation.command).toBe(process.execPath);
    expect(invocation.args[0]).toContain('npx-cli.js');
    expect(invocation.shell).toBe(false);
  });
});
