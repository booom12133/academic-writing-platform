import { Module } from '@nestjs/common';
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

@Module({
  imports: [TasksModule],
  controllers: [AiToolsController],
  providers: [
    AiToolsService,
    DeepSeekProvider,
    LlmService,
    TopicGenerationGenerator,
    SkillLoader,
    SkillRegistry,
    SkillComposer,
    InvariantExtractor,
    InvariantValidator,
    PolishGenerator,
    PaperRevisionGenerator,
  ],
})
export class AiToolsModule {}
