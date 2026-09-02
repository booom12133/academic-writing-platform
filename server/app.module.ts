import { APP_FILTER } from '@nestjs/core';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '@lark-apaas/nestjs-logger';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import {
  createPlatformModuleImports,
  resolveDocumentStorageConfig,
} from './modules/document-input/document-storage.config';
import { isLocalDevelopmentWithoutPlatformDomain } from './config/local-development';
import { LocalDevelopmentDatabaseModule } from './database/local-development.module';
import { LocalDevelopmentAuthMiddleware } from './middleware/local-development-auth.middleware';
import { ViewModule } from './modules/view/view.module';
import { UsersModule } from './modules/users/users.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { PointsModule } from './modules/points/points.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AiToolsModule } from './modules/ai-tools/ai-tools.module';
import { DocumentInputModule } from './modules/document-input/document-input.module';

const documentStorageConfig = resolveDocumentStorageConfig();
const useLocalDevelopment = isLocalDevelopmentWithoutPlatformDomain();

@Module({
  imports: [
    ...(documentStorageConfig.driver === 'filesystem' && !useLocalDevelopment
      ? [ConfigModule.forRoot({ isGlobal: true }), LoggerModule]
      : []),
    ...(useLocalDevelopment
      ? [
          ConfigModule.forRoot({ isGlobal: true }),
          LoggerModule,
          LocalDevelopmentDatabaseModule,
        ]
      : createPlatformModuleImports(documentStorageConfig)),
    // ====== @route-section: business-modules START ======
    UsersModule,
    TasksModule,
    PointsModule,
    OrdersModule,
    AiToolsModule,
    DocumentInputModule,
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
    if (useLocalDevelopment) {
      consumer.apply(LocalDevelopmentAuthMiddleware).forRoutes('*');
    }
  }
}
