import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { findArtifactViolations } from '../../scripts/test-production-artifact';

describe('production artifact gate', () => {
  it('rejects environment files and embedded secret values', () => {
    const root = mkdtempSync(join(tmpdir(), 'academic-writing-artifact-'));
    try {
      mkdirSync(join(root, 'server'));
      writeFileSync(join(root, '.env'), 'DEEPSEEK_API_KEY=artifact-secret');
      writeFileSync(join(root, 'server', 'main.js'), 'artifact-secret');

      expect(findArtifactViolations(root, ['artifact-secret'])).toEqual([
        '.env',
        'server/main.js contains a forbidden secret value',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
