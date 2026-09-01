import { APP_FILTER } from '@nestjs/core';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlatformModule } from '@lark-apaas/fullstack-nestjs-core';
import { LoggerModule } from '@lark-apaas/nestjs-logger';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { isLocalDevelopmentWithoutPlatformDomain } from './config/local-development';
import { LocalDevelopmentDatabaseModule } from './database/local-development.module';
import { LocalDevelopmentAuthMiddleware } from './middleware/local-development-auth.middleware';
import { ViewModule } from './modules/view/view.module';
import { UsersModule } from './modules/users/users.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { PointsModule } from './modules/points/points.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AiToolsModule } from './modules/ai-tools/ai-tools.module';

const useLocalDevelopment = isLocalDevelopmentWithoutPlatformDomain();

@Module({
  imports: [
    ...(useLocalDevelopment
      ? [
          ConfigModule.forRoot({ isGlobal: true }),
          LoggerModule,
          LocalDevelopmentDatabaseModule,
        ]
      : [PlatformModule.forRoot()]),
    // ====== @route-section: business-modules START ======
    UsersModule,
    TasksModule,
    PointsModule,
    OrdersModule,
    AiToolsModule,
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
