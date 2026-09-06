import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge.module';
import { EMBEDDING_PROVIDER } from './embedding.provider';
import { DeterministicEmbeddingProvider } from './embedding.fake';
import { EMBEDDING_CONFIG, createEmbeddingConfig } from './embedding.config';
import { KnowledgeIndexRepository } from './knowledge-index.repository';
import { KnowledgeIndexingService } from './knowledge-indexing.service';

@Module({
  imports: [KnowledgeModule],
  providers: [
    KnowledgeIndexRepository,
    {
      provide: EMBEDDING_PROVIDER,
      useClass: DeterministicEmbeddingProvider,
    },
    {
      provide: EMBEDDING_CONFIG,
      useFactory: () => createEmbeddingConfig(),
    },
    KnowledgeIndexingService,
  ],
  exports: [
    KnowledgeIndexRepository,
    KnowledgeIndexingService,
    EMBEDDING_PROVIDER,
    EMBEDDING_CONFIG,
  ],
})
export class KnowledgeIndexingModule {}
