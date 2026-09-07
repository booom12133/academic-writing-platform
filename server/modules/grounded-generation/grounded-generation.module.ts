import { Module } from '@nestjs/common';
import { AiToolsModule } from '../ai-tools/ai-tools.module';
import { LlmService } from '../ai-tools/llm/llm.service';
import { KnowledgeRetrievalModule } from '../knowledge/retrieval/knowledge-retrieval.module';
import { GroundedGenerationController } from './grounded-generation.controller';
import { GroundedGenerationService } from './grounded-generation.service';
import { GroundedEvidenceAdapter } from './evidence/grounded-evidence.adapter';

@Module({
  imports: [AiToolsModule, KnowledgeRetrievalModule],
  controllers: [GroundedGenerationController],
  providers: [
    GroundedEvidenceAdapter,
    {
      provide: GroundedGenerationService,
      useFactory: (evidence: GroundedEvidenceAdapter, llm: LlmService) =>
        new GroundedGenerationService(evidence, llm),
      inject: [GroundedEvidenceAdapter, LlmService],
    },
  ],
  exports: [GroundedGenerationService],
})
export class GroundedGenerationModule {}
