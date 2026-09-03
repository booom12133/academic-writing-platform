jest.mock('../tasks/tasks.service', () => ({ TasksService: class {} }));
jest.mock('../tasks/tasks.module', () => ({ TasksModule: class {} }));
jest.mock('../document-input/document-input.module', () => ({ DocumentInputModule: class {} }));
jest.mock('../document-parsing/document-parsing.module', () => ({ DocumentParsingModule: class {} }));
jest.mock('../context-builder/context-builder.module', () => ({ ContextBuilderModule: class {} }));
jest.mock('../chunking/chunking.module', () => ({ ChunkingModule: class {} }));
jest.mock('./ai-tools.controller', () => ({ AiToolsController: class {} }));
jest.mock('@shared/api.interface', () => ({ TOOL_CONFIGS: [] }), { virtual: true });

import { Test } from '@nestjs/testing';
import { TOOL_CONFIGS } from '../../../shared/api.interface';

import { InvariantExtractor } from './skills/validators/invariant.extractor';
import { InvariantValidator } from './skills/validators/invariant.validator';
import { SKILLS_ROOT } from './skills/skills-root.token';
import { SkillLoader } from './skills/skill.loader';
import { PaperRevisionChunkExecutor } from './paper-revision/paper-revision-chunk.executor';
import { PaperRevisionResultAggregator } from './paper-revision/paper-revision-result.aggregator';
import { PaperRevisionSubmissionService } from './paper-revision/paper-revision-submission.service';
import { PaperRevisionGenerator } from './generators/paper-revision.generator';
import { ToolSubmissionPreparationService } from './execution/tool-submission-preparation.service';
import { AcademicToolExecutionService } from './execution/academic-tool-execution.service';
import { TasksService } from '../tasks/tasks.service';
import { AiToolsModule } from './ai-tools.module';
import { DeepSeekProvider } from './llm/deepseek.provider';
import { TEXT_GENERATION_PROVIDER } from './llm/text-generation.provider';

describe('AI tools runtime dependency bootstrap', () => {
  it('binds the sole production generation seam to DeepSeek', () => {
    const providers = Reflect.getMetadata('providers', AiToolsModule);

    expect(providers).toContainEqual({
      provide: TEXT_GENERATION_PROVIDER,
      useClass: DeepSeekProvider,
    });
    expect(providers).not.toContain(DeepSeekProvider);
  });

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

  it('resolves the Paper Revision D3 provider chain', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: PaperRevisionGenerator, useValue: {} },
        { provide: ToolSubmissionPreparationService, useValue: {} },
        { provide: TasksService, useValue: {} },
        { provide: AcademicToolExecutionService, useValue: {} },
        PaperRevisionChunkExecutor,
        PaperRevisionResultAggregator,
        PaperRevisionSubmissionService,
      ],
    }).compile();

    expect(moduleRef.get(PaperRevisionChunkExecutor)).toBeInstanceOf(PaperRevisionChunkExecutor);
    expect(moduleRef.get(PaperRevisionResultAggregator)).toBeInstanceOf(PaperRevisionResultAggregator);
    expect(moduleRef.get(PaperRevisionSubmissionService)).toBeInstanceOf(PaperRevisionSubmissionService);
  });

  it('keeps Paper Revision billing at the existing fixed 30 points', () => {
    expect(TOOL_CONFIGS.find((tool) => tool.type === 'paper-revision')?.basePoints)
      .toBe(30);
  });
});
