jest.mock('@nestjs/common', () => ({
  Controller: () => () => undefined,
  Get: () => () => undefined,
  Res: () => () => undefined,
}));
jest.mock('@lark-apaas/fullstack-nestjs-core', () => ({
  NeedLogin: jest.fn(() => () => undefined),
}));

import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('keeps liveness public and maps readiness failure to HTTP 503', async () => {
    const health = {
      live: jest.fn().mockResolvedValue({ status: 'ok' }),
      ready: jest
        .fn()
        .mockResolvedValue({
          status: 'not_ready',
          reasonCode: 'database_unreachable',
        }),
      providers: jest.fn().mockResolvedValue({}),
    };
    const controller = new HealthController(health as never);
    const response = { statusCode: 200 };

    await expect(controller.live()).resolves.toEqual({ status: 'ok' });
    await expect(controller.ready(response as never)).resolves.toEqual({
      status: 'not_ready',
      reasonCode: 'database_unreachable',
    });
    expect(response.statusCode).toBe(503);
    await expect(controller.providers()).resolves.toEqual({});
    expect(NeedLogin).toHaveBeenCalled();
  });
});
