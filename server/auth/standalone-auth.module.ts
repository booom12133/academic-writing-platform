import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import {
  StandaloneAuthAdapter,
  type StandaloneAuthConfiguration,
} from './standalone-auth.adapter';
import { STANDALONE_AUTH_CONFIGURATION } from './standalone-auth.types';
import { StandaloneAuthGuard } from './standalone-auth.guard';

@Module({})
export class StandaloneAuthModule {
  static forRoot(configuration: StandaloneAuthConfiguration): DynamicModule {
    return {
      module: StandaloneAuthModule,
      providers: [
        { provide: STANDALONE_AUTH_CONFIGURATION, useValue: configuration },
        {
          provide: StandaloneAuthAdapter,
          useFactory: (authConfiguration: StandaloneAuthConfiguration) =>
            new StandaloneAuthAdapter(authConfiguration),
          inject: [STANDALONE_AUTH_CONFIGURATION],
        },
        {
          provide: APP_GUARD,
          useClass: StandaloneAuthGuard,
        },
      ],
      exports: [StandaloneAuthAdapter],
    };
  }
}
