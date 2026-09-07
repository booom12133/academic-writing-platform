import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge.module';
import { EMBEDDING_PROVIDER } from './embedding.provider';
import { DeterministicEmbeddingProvider } from './embedding.fake';
import { EMBEDDING_CONFIG, createEmbeddingConfig } from './embedding.config';
import { resolveEmbeddingProductionConfig } from './embedding-production-config';
import { OpenAiCompatibleEmbeddingProvider } from './openai-compatible-embedding.provider';
import { loadRuntimeConfig } from '../../../config/production-config';
import { KnowledgeIndexRepository } from './knowledge-index.repository';
import { KnowledgeIndexingService } from './knowledge-indexing.service';
import { KnowledgeRepository, type KnowledgeRepositoryPort } from '../knowledge.repository';
import type { EmbeddingConfig } from './embedding.types';
import { type EmbeddingProvider } from './embedding.provider';
import type { KnowledgeIndexRepositoryPort } from './knowledge-index.repository';

export function createEmbeddingProvider(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingProvider {
  const runtimeConfig = loadRuntimeConfig(env);
  if (runtimeConfig.nodeEnv === 'production') {
    return new OpenAiCompatibleEmbeddingProvider(resolveEmbeddingProductionConfig(env));
  }
  return new DeterministicEmbeddingProvider();
}

@Module({
  imports: [KnowledgeModule],
  providers: [
    KnowledgeIndexRepository,
    // Keep the injectable visible to the Nest lint rule; the explicit factory below
    // preserves the constructor's default sleep implementation during bootstrap.
    KnowledgeIndexingService,
    {
      provide: EMBEDDING_PROVIDER,
      useFactory: () => createEmbeddingProvider(),
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
