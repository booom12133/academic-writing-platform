import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

import { RuntimeConfigService } from './runtime-config.service';

export class RuntimeConfigController {
  constructor(private readonly runtimeConfig: RuntimeConfigService) {}

  getOidcConfig(response?: Response) {
    response?.setHeader('Cache-Control', 'no-store');
    return this.runtimeConfig.getOidcConfig();
  }
}

Controller('api/runtime-config')(RuntimeConfigController);
Get('oidc')(
  RuntimeConfigController.prototype,
  'getOidcConfig',
  Object.getOwnPropertyDescriptor(
    RuntimeConfigController.prototype,
    'getOidcConfig',
  )!,
);
Res({ passthrough: true })(RuntimeConfigController.prototype, 'getOidcConfig', 0);
