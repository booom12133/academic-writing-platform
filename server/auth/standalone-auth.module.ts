import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import {
  StandaloneAuthAdapter,
  type StandaloneAuthConfiguration,
} from './standalone-auth.adapter';
import { STANDALONE_AUTH_CONFIGURATION } from './standalone-auth.types';
import { StandaloneAuthGuard } from './standalone-auth.guard';

@Module({ providers: [StandaloneAuthAdapter] })
export class StandaloneAuthModule {
  static forRoot(configuration: StandaloneAuthConfiguration): DynamicModule {
    return {
      module: StandaloneAuthModule,
      providers: [
        { provide: STANDALONE_AUTH_CONFIGURATION, useValue: configuration },
        {
          provide: APP_GUARD,
          useClass: StandaloneAuthGuard,
        },
      ],
      exports: [StandaloneAuthAdapter],
    };
  }
}
