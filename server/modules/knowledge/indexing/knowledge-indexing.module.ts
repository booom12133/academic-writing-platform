import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge.module';
import { EMBEDDING_PROVIDER } from './embedding.provider';
import { DeterministicEmbeddingProvider } from './embedding.fake';
import { EMBEDDING_CONFIG, createEmbeddingConfig } from './embedding.config';
import { KnowledgeIndexRepository } from './knowledge-index.repository';
import { KnowledgeIndexingService } from './knowledge-indexing.service';
import { KnowledgeRepository, type KnowledgeRepositoryPort } from '../knowledge.repository';
import type { EmbeddingConfig } from './embedding.types';
import { type EmbeddingProvider } from './embedding.provider';
import type { KnowledgeIndexRepositoryPort } from './knowledge-index.repository';

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
    {
      provide: KnowledgeIndexingService,
      useFactory: (
        knowledge: KnowledgeRepositoryPort,
        repository: KnowledgeIndexRepositoryPort,
        provider: EmbeddingProvider,
        config: EmbeddingConfig,
      ) => new KnowledgeIndexingService(knowledge, repository, provider, config),
      inject: [KnowledgeRepository, KnowledgeIndexRepository, EMBEDDING_PROVIDER, EMBEDDING_CONFIG],
    },
  ],
  exports: [
    KnowledgeIndexRepository,
    KnowledgeIndexingService,
    EMBEDDING_PROVIDER,
    EMBEDDING_CONFIG,
  ],
})
export class KnowledgeIndexingModule {}
