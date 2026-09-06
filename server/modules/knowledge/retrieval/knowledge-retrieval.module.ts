import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge.module';
import { KnowledgeIndexingModule } from '../indexing/knowledge-indexing.module';
import { KnowledgeEvidenceService } from './knowledge-evidence.service';
import { EvidenceAssemblyService } from './evidence-assembly';
import { KnowledgeRetrievalRepository } from './knowledge-retrieval.repository';
import { KnowledgeRetrievalService } from './knowledge-retrieval.service';
import { createRetrievalConfig, RETRIEVAL_CONFIG } from './retrieval.config';

@Module({
  imports: [KnowledgeModule, KnowledgeIndexingModule],
  providers: [
    KnowledgeRetrievalRepository,
    {
      provide: RETRIEVAL_CONFIG,
      useFactory: () => createRetrievalConfig(),
      inject: [],
    },
    KnowledgeRetrievalService,
    EvidenceAssemblyService,
    KnowledgeEvidenceService,
  ],
  exports: [KnowledgeRetrievalService, KnowledgeEvidenceService],
})
export class KnowledgeRetrievalModule {}
