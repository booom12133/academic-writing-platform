import { Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';

import { RequestLoggingMiddleware } from './request-logging.middleware';

describe('RequestLoggingMiddleware', () => {
  it('adds a request id and logs only bounded request metadata after completion', () => {
    const middleware = new RequestLoggingMiddleware();
    const logger = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const response = Object.assign(new EventEmitter(), {
      statusCode: 204,
      setHeader: jest.fn(),
    });
    const request = {
      method: 'GET',
      path: '/health/live',
      route: { path: '/health/live' },
      body: { documentText: 'must not be logged' },
    };
    const next = jest.fn();

    middleware.use(request as never, response as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    const requestId = response.setHeader.mock.calls[0]?.[1];
    expect(requestId).toEqual(expect.any(String));

    response.emit('finish');

    expect(logger).toHaveBeenCalledTimes(1);
    const entry = logger.mock.calls[0]?.[0] as string;
    expect(JSON.parse(entry)).toEqual({
      requestId,
      method: 'GET',
      route: '/health/live',
      status: 204,
      latencyMs: expect.any(Number),
    });
    expect(entry).not.toContain('must not be logged');
    logger.mockRestore();
  });
});
