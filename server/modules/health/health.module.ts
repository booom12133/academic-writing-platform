import { DynamicModule, Module } from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type AppDatabase,
} from '../../database/database.types';
import { checkDatabaseReadiness } from '../../database/database-readiness';
import type { RuntimeConfig } from '../../config/production-config';
import {
  EMBEDDING_PROVIDER,
  type EmbeddingProvider,
} from '../knowledge/indexing/embedding.provider';
import { LlmService } from '../ai-tools/llm/llm.service';
import { checkFilesystemStorageReadiness } from '../document-input/storage-readiness';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { AiToolsModule } from '../ai-tools/ai-tools.module';
import { KnowledgeIndexingModule } from '../knowledge/indexing/knowledge-indexing.module';

export const HEALTH_RUNTIME_CONFIG = Symbol('HEALTH_RUNTIME_CONFIG');

@Module({ controllers: [HealthController] })
export class HealthModule {
  static forRoot(config: RuntimeConfig): DynamicModule {
    return {
      module: HealthModule,
      providers: [
        { provide: HEALTH_RUNTIME_CONFIG, useValue: config },
        {
          provide: HealthService,
          useFactory: (
            runtimeConfig: RuntimeConfig,
            database?: AppDatabase,
            embedding?: EmbeddingProvider,
            llm?: LlmService,
          ) =>
            new HealthService(runtimeConfig, {
              database: database
                ? () => checkDatabaseReadiness(database)
                : undefined,
              storage: runtimeConfig.storage.root
                ? () =>
                    checkFilesystemStorageReadiness(
                      runtimeConfig.storage.root as string,
                    )
                : undefined,
              embedding,
              llm,
            }),
          inject: [
            HEALTH_RUNTIME_CONFIG,
            { token: DRIZZLE_DATABASE, optional: true },
            { token: EMBEDDING_PROVIDER, optional: true },
            { token: LlmService, optional: true },
          ],
        },
      ],
      imports: [AiToolsModule, KnowledgeIndexingModule],
      exports: [HealthService],
    };
  }
}
