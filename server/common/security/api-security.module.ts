import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import {
  ProcessLocalRateLimitGuard,
  type RateLimitOptions,
} from './rate-limit.guard';

@Module({})
export class ApiSecurityModule {
  static forRoot(rateLimit: RateLimitOptions): DynamicModule {
    return {
      module: ApiSecurityModule,
      providers: [
        {
          provide: ProcessLocalRateLimitGuard,
          useValue: new ProcessLocalRateLimitGuard(rateLimit),
        },
        { provide: APP_GUARD, useExisting: ProcessLocalRateLimitGuard },
      ],
    };
  }
}
