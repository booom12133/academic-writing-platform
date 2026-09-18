import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

import { RuntimeConfigService } from './runtime-config.service';

@Controller('api/runtime-config')
export class RuntimeConfigController {
  constructor(private readonly runtimeConfig: RuntimeConfigService) {}

  @Get('oidc')
  getOidcConfig(@Res({ passthrough: true }) response?: Response) {
    response?.setHeader('Cache-Control', 'no-store');
    return this.runtimeConfig.getOidcConfig();
  }
}
