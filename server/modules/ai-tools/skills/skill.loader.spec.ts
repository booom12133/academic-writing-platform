import * as path from 'node:path';
import * as fs from 'node:fs';

import { SkillLoader, SkillLoaderError } from './skill.loader';

const SKILLS_ROOT = path.resolve(__dirname);

describe('SkillLoader', () => {
  it('loads a project skill and parses its frontmatter', () => {
    const loader = new SkillLoader(SKILLS_ROOT);

    const skill = loader.load({ source: 'project', id: 'academic-polish' });

    expect(skill).toMatchObject({
      id: 'academic-polish',
      source: 'project',
      relativePath: 'project/academic-polish/SKILL.md',
      language: 'en',
      metadata: expect.objectContaining({ name: 'academic-polish' }),
    });
    expect(skill.content).toContain('Academic polishing');
  });

  it('loads a vendored skill without allowing the vendor to escape its root', () => {
    const loader = new SkillLoader(SKILLS_ROOT);

    const skill = loader.load({ source: 'vendor', id: 'codex-academic-humanizer' });

    expect(skill.source).toBe('vendor');
    expect(skill.content).toContain('Preserve');
  });

  it('rejects missing skills with an explicit error', () => {
    const loader = new SkillLoader(SKILLS_ROOT);

    expect(() => loader.load({ source: 'project', id: 'missing-skill' })).toThrow(
      new SkillLoaderError('Skill not found: project/missing-skill/SKILL.md'),
    );
  });

  it.each([
    '../outside/SKILL.md',
    '..\\outside\\SKILL.md',
    'C:\\Users\\Administrator\\outside\\SKILL.md',
    '/etc/passwd',
  ])('rejects path traversal or absolute path %s', (relativePath) => {
    const loader = new SkillLoader(SKILLS_ROOT);

    expect(() => loader.load({
      source: 'project',
      id: 'academic-polish',
      relativePath,
    })).toThrow(SkillLoaderError);
  });

  it('returns the cached definition without rereading the file', () => {
    const loader = new SkillLoader(SKILLS_ROOT);
    const readFileSpy = jest.spyOn(fs, 'readFileSync');

    loader.load({ source: 'vendor', id: 'codex-academic-humanizer' });
    const readsAfterFirstLoad = readFileSpy.mock.calls.length;
    loader.load({ source: 'vendor', id: 'codex-academic-humanizer' });

    expect(readFileSpy).toHaveBeenCalledTimes(readsAfterFirstLoad);
    readFileSpy.mockRestore();
  });
});
