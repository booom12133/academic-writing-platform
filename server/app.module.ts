import { APP_FILTER } from '@nestjs/core';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '@lark-apaas/nestjs-logger';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import {
  loadRuntimeConfig,
  type RuntimeConfig,
} from './config/production-config';
import { createPlatformRuntimeModuleImports } from './modules/document-input/document-storage.config';
import { LocalDevelopmentDatabaseModule } from './database/local-development.module';
import { StandardPostgresDatabaseModule } from './database/standard-postgres.module';
import { LocalDevelopmentAuthMiddleware } from './middleware/local-development-auth.middleware';
import { ViewModule } from './modules/view/view.module';
import { UsersModule } from './modules/users/users.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { PointsModule } from './modules/points/points.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AiToolsModule } from './modules/ai-tools/ai-tools.module';
import { DocumentInputModule } from './modules/document-input/document-input.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { ZoteroModule } from './modules/zotero/zotero.module';
import { AcademicSearchModule } from './modules/academic-search/academic-search.module';
import { GroundedGenerationModule } from './modules/grounded-generation/grounded-generation.module';

const runtimeConfig = loadRuntimeConfig();

export function createRuntimeModuleImports(config: RuntimeConfig) {
  const imports = [ConfigModule.forRoot({ isGlobal: true }), LoggerModule];
  if (config.database.mode === 'local-memory') {
    return [...imports, LocalDevelopmentDatabaseModule];
  }
  if (config.database.mode === 'postgres') {
    return [...imports, StandardPostgresDatabaseModule];
  }
  return [...imports, ...createPlatformRuntimeModuleImports()];
}

@Module({
  imports: [
    ...createRuntimeModuleImports(runtimeConfig),
    // ====== @route-section: business-modules START ======
    UsersModule,
    TasksModule,
    PointsModule,
    OrdersModule,
    AiToolsModule,
    DocumentInputModule,
    KnowledgeModule,
    ZoteroModule,
    AcademicSearchModule,
    GroundedGenerationModule,
    // ====== @route-section: business-modules END ======

    // ⚠️ @route-order: last
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    if (runtimeConfig.auth.mode === 'local-fixed') {
      consumer.apply(LocalDevelopmentAuthMiddleware).forRoutes('*');
    }
  }
}
