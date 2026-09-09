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
import { KnowledgeProductModule } from './modules/knowledge-product/knowledge-product.module';
import { ZoteroModule } from './modules/zotero/zotero.module';
import { AcademicSearchModule } from './modules/academic-search/academic-search.module';
import { GroundedGenerationModule } from './modules/grounded-generation/grounded-generation.module';
import { StandaloneAuthModule } from './auth/standalone-auth.module';
import { ApiSecurityModule } from './common/security/api-security.module';
import { LifecycleModule } from './common/lifecycle/lifecycle.module';
import { RequestLoggingMiddleware } from './common/logging/request-logging.middleware';
import { HealthModule } from './modules/health/health.module';
import { RuntimeConfigModule } from './modules/runtime-config/runtime-config.module';

const runtimeConfig = loadRuntimeConfig();

export function createRuntimeModuleImports(config: RuntimeConfig) {
  const imports = [ConfigModule.forRoot({ isGlobal: true }), LoggerModule];
  const productionSecurity =
    config.nodeEnv === 'production'
      ? [ApiSecurityModule.forRoot(config.security.rateLimit)]
      : [];
  if (config.database.mode === 'local-memory') {
    return [...imports, LocalDevelopmentDatabaseModule, ...productionSecurity];
  }
  if (config.database.mode === 'postgres') {
    return [
      ...imports,
      StandardPostgresDatabaseModule,
      ...(config.auth.standalone
        ? [StandaloneAuthModule.forRoot(config.auth.standalone)]
        : []),
      ...productionSecurity,
    ];
  }
  return [
    ...imports,
    ...createPlatformRuntimeModuleImports(),
    ...productionSecurity,
  ];
}

@Module({
  imports: [
    ...createRuntimeModuleImports(runtimeConfig),
    LifecycleModule,
    HealthModule.forRoot(runtimeConfig),
    RuntimeConfigModule,
    // ====== @route-section: business-modules START ======
    UsersModule,
    TasksModule,
    PointsModule,
    OrdersModule,
    AiToolsModule,
    DocumentInputModule,
    KnowledgeModule,
    KnowledgeProductModule,
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
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
    if (runtimeConfig.auth.mode === 'local-fixed') {
      consumer.apply(LocalDevelopmentAuthMiddleware).forRoutes('*');
    }
  }
}
