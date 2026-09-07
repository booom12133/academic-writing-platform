import 'reflect-metadata';
jest.mock('@nestjs/common', () => ({
  Body: () => () => undefined,
  Controller: () => () => undefined,
  Get: () => () => undefined,
  Post: () => () => undefined,
  Req: () => () => undefined,
}));
jest.mock('@lark-apaas/fullstack-nestjs-core', () => ({
  NeedLogin: () => () => undefined,
}));

import { AiToolsController } from './ai-tools.controller';
import type { ProductToolCapability } from '../../../shared/product-capability.interface';

describe('AiToolsController capability discovery', () => {
  it('returns readiness metadata from the service catalog', async () => {
    const capabilities = [
      {
        type: 'topic-generation',
        readiness: 'production',
      },
      {
        type: 'literature',
        readiness: 'disabled',
        replacementRoute: '/academic-search',
      },
    ] as ProductToolCapability[];
    const service = {
      getToolConfigs: jest.fn().mockReturnValue(capabilities),
    };
    const controller = new AiToolsController(
      service as never,
      {} as never,
    );

    await expect(controller.getTools()).resolves.toBe(capabilities);
    expect(service.getToolConfigs).toHaveBeenCalledTimes(1);
  });
});
