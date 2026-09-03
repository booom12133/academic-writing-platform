import { Module } from '@nestjs/common';
import * as path from 'node:path';
import { AiToolsController } from './ai-tools.controller';
import { AiToolsService } from './ai-tools.service';
import { TasksModule } from '../tasks/tasks.module';
import { DeepSeekProvider } from './llm/deepseek.provider';
import { LlmService } from './llm/llm.service';
import { TopicGenerationGenerator } from './generators/topic-generation.generator';
import { PolishGenerator } from './generators/polish.generator';
import { PaperRevisionGenerator } from './generators/paper-revision.generator';
import { SkillLoader } from './skills/skill.loader';
import { SkillRegistry } from './skills/skill.registry';
import { SkillComposer } from './skills/skill.composer';
import { InvariantExtractor } from './skills/validators/invariant.extractor';
import { InvariantValidator } from './skills/validators/invariant.validator';
import { SKILLS_ROOT } from './skills/skills-root.token';
import { DocumentInputModule } from '../document-input/document-input.module';
import { DocumentParsingModule } from '../document-parsing/document-parsing.module';
import { ContextBuilderModule } from '../context-builder/context-builder.module';
import { ChunkingModule } from '../chunking/chunking.module';
import { ToolInputPreparationService } from './execution/tool-input-preparation.service';
import { ToolSubmissionPreparationService } from './execution/tool-submission-preparation.service';
import { AcademicToolExecutionService } from './execution/academic-tool-execution.service';
import { PolishBillingService } from './polish/polish-billing.service';
import { PolishChunkExecutor } from './polish/polish-chunk.executor';
import { PolishResultAggregator } from './polish/polish-result.aggregator';
import { PolishSubmissionService } from './polish/polish-submission.service';
import { PaperRevisionChunkExecutor } from './paper-revision/paper-revision-chunk.executor';
import { PaperRevisionResultAggregator } from './paper-revision/paper-revision-result.aggregator';
import { PaperRevisionSubmissionService } from './paper-revision/paper-revision-submission.service';

@Module({
  imports: [
    TasksModule,
    DocumentInputModule,
    DocumentParsingModule,
    ContextBuilderModule,
    ChunkingModule,
  ],
  controllers: [AiToolsController],
  providers: [
    AiToolsService,
    DeepSeekProvider,
    LlmService,
    TopicGenerationGenerator,
    {
      provide: SkillLoader,
      useFactory: (skillsRoot: string) => new SkillLoader(skillsRoot),
      inject: [SKILLS_ROOT],
    },
    SkillRegistry,
    SkillComposer,
    InvariantExtractor,
    {
      provide: InvariantValidator,
      useFactory: (extractor: InvariantExtractor) =>
        new InvariantValidator(extractor),
      inject: [InvariantExtractor],
    },
    {
      provide: SKILLS_ROOT,
      useFactory: () =>
        path.resolve(process.cwd(), 'server/modules/ai-tools/skills'),
    },
    PolishGenerator,
    PaperRevisionGenerator,
    ToolInputPreparationService,
    ToolSubmissionPreparationService,
    AcademicToolExecutionService,
    PolishBillingService,
    PolishChunkExecutor,
    PolishResultAggregator,
    PolishSubmissionService,
    PaperRevisionChunkExecutor,
    PaperRevisionResultAggregator,
    PaperRevisionSubmissionService,
  ],
})
export class AiToolsModule {}
