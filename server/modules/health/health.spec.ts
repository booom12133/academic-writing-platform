import { HealthService } from './health.service';

const config = {
  nodeEnv: 'production',
  profile: 'standalone' as const,
  auth: { mode: 'standalone-jwt' as const },
  database: { mode: 'postgres' as const },
  storage: {
    mode: 'persistent-filesystem' as const,
    root: '/var/lib/documents',
  },
  security: {
    corsAllowedOrigins: ['https://app.example.com'],
    bodySizeLimit: '1mb',
    trustProxyHops: 0,
    rateLimit: { windowMs: 60_000, maxRequests: 120, expensiveMaxRequests: 30 },
  },
};

describe('HealthService', () => {
  it('keeps liveness successful while dependencies are unavailable', async () => {
    const health = new HealthService(config, {
      database: jest
        .fn()
        .mockResolvedValue({
          ready: false,
          reasonCode: 'database_unreachable',
        }),
      storage: jest
        .fn()
        .mockResolvedValue({
          ready: false,
          reasonCode: 'storage_root_missing',
        }),
    });

    await expect(health.live()).resolves.toEqual({ status: 'ok' });
  });

  it('returns the first stable readiness failure without dependency details', async () => {
    const health = new HealthService(config, {
      database: jest
        .fn()
        .mockResolvedValue({
          ready: false,
          reasonCode: 'database_unreachable',
        }),
      storage: jest.fn(),
    });

    await expect(health.ready()).resolves.toEqual({
      status: 'not_ready',
      reasonCode: 'database_unreachable',
    });
  });

  it('returns only sanitized provider health fields', async () => {
    const health = new HealthService(
      {
        ...config,
        database: { mode: 'platform' as const },
        storage: { mode: 'platform' as const },
      },
      {
        llm: {
          checkHealth: jest
            .fn()
            .mockResolvedValue({
              configured: true,
              provider: 'deepseek',
              reachable: false,
              error: 'token=secret',
            }),
        },
        embedding: {
          checkHealth: jest
            .fn()
            .mockResolvedValue({
              configured: true,
              provider: 'embedding',
              reachable: true,
              model: 'model',
              dimensions: 3,
              apiKey: 'secret',
            }),
        },
      },
    );

    await expect(health.providers()).resolves.toEqual({
      llm: {
        configured: true,
        provider: 'deepseek',
        reachable: false,
        error: 'provider_unreachable',
      },
      embedding: {
        configured: true,
        provider: 'embedding',
        reachable: true,
        model: 'model',
        dimensions: 3,
      },
    });
  });
});
