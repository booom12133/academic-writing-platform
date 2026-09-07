import { ExecutionContext } from '@nestjs/common';

import {
  ProcessLocalRateLimitGuard,
  TooManyRequestsException,
} from './rate-limit.guard';

function context(path: string, ip = '127.0.0.1'): ExecutionContext {
  const request = { ip, path, method: 'POST' };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('ProcessLocalRateLimitGuard', () => {
  it('limits requests per client within the configured window', () => {
    let now = 1_000;
    const guard = new ProcessLocalRateLimitGuard({
      windowMs: 60_000,
      maxRequests: 1,
      expensiveMaxRequests: 1,
      now: () => now,
    });

    expect(guard.canActivate(context('/api/tasks'))).toBe(true);
    expect(() => guard.canActivate(context('/api/tasks'))).toThrow(
      TooManyRequestsException,
    );

    now += 60_001;
    expect(guard.canActivate(context('/api/tasks'))).toBe(true);
  });

  it('uses a stricter bucket for expensive API paths', () => {
    const guard = new ProcessLocalRateLimitGuard({
      windowMs: 60_000,
      maxRequests: 5,
      expensiveMaxRequests: 1,
      now: () => 1_000,
      expensivePrefixes: ['/api/ai-tools'],
    });

    expect(guard.canActivate(context('/api/ai-tools/submit'))).toBe(true);
    expect(() => guard.canActivate(context('/api/ai-tools/submit'))).toThrow(
      TooManyRequestsException,
    );
    expect(guard.canActivate(context('/api/tasks'))).toBe(true);
  });
});
