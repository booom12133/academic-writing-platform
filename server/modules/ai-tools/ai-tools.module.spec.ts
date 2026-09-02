import { Test } from '@nestjs/testing';

import { InvariantExtractor } from './skills/validators/invariant.extractor';
import { InvariantValidator } from './skills/validators/invariant.validator';
import { SKILLS_ROOT } from './skills/skills-root.token';
import { SkillLoader } from './skills/skill.loader';

describe('AI tools runtime dependency bootstrap', () => {
  it('uses an overridable skills root injection token', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: SKILLS_ROOT, useValue: 'injected-skills-root' },
        {
          provide: SkillLoader,
          useFactory: (skillsRoot: string) => new SkillLoader(skillsRoot),
          inject: [SKILLS_ROOT],
        },
      ],
    }).compile();

    const loader = moduleRef.get(SkillLoader) as unknown as {
      skillsRoot: string;
    };
    expect(loader.skillsRoot).toBe('injected-skills-root');
  });

  it('uses the module-provided invariant extractor', async () => {
    const extractor = { extract: jest.fn().mockReturnValue([]) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: InvariantExtractor, useValue: extractor },
        {
          provide: InvariantValidator,
          useFactory: (injectedExtractor: InvariantExtractor) =>
            new InvariantValidator(injectedExtractor),
          inject: [InvariantExtractor],
        },
      ],
    }).compile();

    expect(moduleRef.get(InvariantExtractor)).toBe(extractor);
    moduleRef.get(InvariantValidator).validate({
      profile: 'polish-strict',
      original: 'source',
      revised: 'revision',
    });

    expect(extractor.extract).toHaveBeenCalledTimes(3);
  });
});
