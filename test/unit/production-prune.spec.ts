import {
  classifyDependencyEntry,
  copyDependencyTree,
} from '../../scripts/prune-smart-utils';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('production dependency pruning', () => {
  it('skips the npm .bin helper directory', () => {
    expect(classifyDependencyEntry({ name: '.bin', isDirectory: true, isSymbolicLink: false, isFile: false })).toBe('skip');
  });

  it('rejects a symlink outside the npm .bin helper directory', () => {
    expect(classifyDependencyEntry({ name: 'linked-package', isDirectory: false, isSymbolicLink: true, isFile: false })).toBe('reject-symlink');
  });

  it('copies regular dependency files without changing their contents', () => {
    const source = mkdtempSync(join(tmpdir(), 'academic-writing-prune-source-'));
    const destination = mkdtempSync(join(tmpdir(), 'academic-writing-prune-destination-'));
    try {
      mkdirSync(join(source, 'lib'), { recursive: true });
      writeFileSync(join(source, 'lib', 'index.js'), 'module.exports = 1;\n');
      copyDependencyTree(source, destination);
      expect(readFileSync(join(destination, 'lib', 'index.js'), 'utf8')).toBe('module.exports = 1;\n');
    } finally {
      rmSync(source, { recursive: true, force: true });
      rmSync(destination, { recursive: true, force: true });
    }
  });

  it('does not copy the .bin directory into the output tree', () => {
    const source = mkdtempSync(join(tmpdir(), 'academic-writing-prune-source-'));
    const destination = mkdtempSync(join(tmpdir(), 'academic-writing-prune-destination-'));
    try {
      mkdirSync(join(source, '.bin'), { recursive: true });
      writeFileSync(join(source, '.bin', 'uuid'), 'helper');
      copyDependencyTree(source, destination);
      expect(existsSync(join(destination, '.bin'))).toBe(false);
    } finally {
      rmSync(source, { recursive: true, force: true });
      rmSync(destination, { recursive: true, force: true });
    }
  });
});
