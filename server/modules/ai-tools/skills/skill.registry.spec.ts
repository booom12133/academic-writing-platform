import { SkillRegistry, SkillRegistryError } from './skill.registry';

describe('SkillRegistry', () => {
  const registry = new SkillRegistry();

  it.each([
    ['academic-polish-en', 'polish', 'en', ['project/academic-polish', 'vendor/codex-academic-humanizer'], 'polish-strict'],
    ['academic-polish-zh', 'polish', 'zh', ['project/academic-polish', 'project/chinese-academic-writing', 'vendor/codex-academic-humanizer'], 'polish-strict'],
    ['academic-revision-en', 'revision', 'en', ['project/academic-revision'], 'revision-conservative'],
    ['academic-revision-zh', 'revision', 'zh', ['project/academic-revision', 'project/chinese-academic-writing'], 'revision-conservative'],
  ] as const)('returns the configured %s stack', (id, task, language, skillIds, validatorProfile) => {
    const stack = registry.getStack(id);

    expect(stack).toMatchObject({ id, task, language, validatorProfile });
    expect(stack.skills.map((skill) => `${skill.source}/${skill.id}`)).toEqual(skillIds);
  });

  it('resolves a stack by task and language', () => {
    expect(registry.getStackFor('polish', 'zh').id).toBe('academic-polish-zh');
    expect(registry.getStackFor('revision', 'en').id).toBe('academic-revision-en');
  });

  it('rejects unsupported stacks explicitly', () => {
    expect(() => registry.getStack('academic-polish-fr')).toThrow(
      new SkillRegistryError('Unsupported skill stack: academic-polish-fr'),
    );
  });
});
