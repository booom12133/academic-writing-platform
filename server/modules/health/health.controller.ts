import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';

import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  live() {
    return this.health.live();
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response) {
    const result = await this.health.ready();
    if (result.status === 'not_ready') response.statusCode = 503;
    return result;
  }

  @Get('providers')
  providers() {
    return this.health.providers();
  }
}

// Apply the existing authentication metadata using the legacy method-decorator
// calling convention.  This keeps the controller compatible with the project's
// TypeScript decorator transform while retaining the frozen NeedLogin contract.
NeedLogin()(
  HealthController.prototype,
  'providers',
  Object.getOwnPropertyDescriptor(HealthController.prototype, 'providers')!,
);
