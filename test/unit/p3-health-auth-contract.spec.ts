import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { HealthService } from '../../server/modules/health/health.service';

const root = join(__dirname, '..', '..');
const verifyLivePath = join(root, 'deploy', 'scripts', 'verify-live.sh');

const productionConfig = {
  nodeEnv: 'production',
  profile: 'standalone' as const,
  auth: { mode: 'standalone-jwt' as const },
  database: { mode: 'platform' as const },
  storage: { mode: 'platform' as const },
  security: {
    corsAllowedOrigins: ['https://write.yingrenji.cn'],
    bodySizeLimit: '1mb',
    trustProxyHops: 1,
    rateLimit: {
      windowMs: 60_000,
      maxRequests: 120,
      expensiveMaxRequests: 30,
    },
  },
};

describe('P3 WP-A7 health activation and provider-auth contract', () => {
  it('gates PM2 and systemd before live and ready without provider-auth mechanisms', () => {
    const script = readFileSync(verifyLivePath, 'utf8');
    const pm2 = script.indexOf('pm2-service-cli.sh" status');
    const systemd = script.indexOf('systemctl is-active');
    const live = script.indexOf('/health/live');
    const ready = script.indexOf('/health/ready');

    expect(pm2).toBeGreaterThan(-1);
    expect(systemd).toBeGreaterThan(pm2);
    expect(live).toBeGreaterThan(systemd);
    expect(ready).toBeGreaterThan(live);
    expect(script).toContain('P3_ACTIVATION_CHECK_FAILED:pm2');
    expect(script).toContain('P3_ACTIVATION_CHECK_FAILED:systemd');
    expect(script).toContain('P3_ACTIVATION_CHECK_FAILED:live');
    expect(script).toContain('P3_ACTIVATION_CHECK_FAILED:ready');
    expect(script).not.toMatch(
      /\/health\/providers|header[-_ ]?file|bearer[-_ ]?file|\btoken\b|\bbypass\b/iu,
    );
  });

  it('keeps providers under its real NeedLogin metadata and rejects anonymous access', () => {
    const probe = String.raw`
      require('reflect-metadata');
      const { Reflector } = require('@nestjs/core');
      const { HealthController } = require('./server/modules/health/health.controller.ts');
      const {
        NEED_LOGIN_METADATA_KEY,
        StandaloneAuthGuard,
      } = require('./server/auth/standalone-auth.guard.ts');

      const handler = HealthController.prototype.providers;
      const metadata = Reflect.getMetadata(NEED_LOGIN_METADATA_KEY, handler);
      let verifierCalls = 0;
      const guard = new StandaloneAuthGuard(new Reflector(), {
        verifyBearerToken: async () => {
          verifierCalls += 1;
          return { userId: 'must-not-run' };
        },
      });
      const context = {
        getHandler: () => handler,
        getClass: () => HealthController,
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      };

      guard.canActivate(context).then(
        () => {
          process.stderr.write('anonymous provider health unexpectedly passed');
          process.exitCode = 2;
        },
        (error) => process.stdout.write(JSON.stringify({
          metadataPresent: Boolean(metadata),
          metadataIsOwn: Reflect.hasOwnMetadata(NEED_LOGIN_METADATA_KEY, handler),
          status: error.getStatus(),
          verifierCalls,
        })),
      );
    `;
    const result = spawnSync(
      process.execPath,
      [
        '-r',
        'ts-node/register/transpile-only',
        '-r',
        'tsconfig-paths/register',
        '-e',
        probe,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          TS_NODE_PROJECT: join(root, 'tsconfig.node.json'),
        },
      },
    );

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      metadataPresent: true,
      metadataIsOwn: true,
      status: 401,
      verifierCalls: 0,
    });
  });

  it('exposes only the frozen sanitized provider failure fields', async () => {
    const health = new HealthService(productionConfig, {
      llm: {
        checkHealth: jest.fn().mockRejectedValue(
          new Error('token=secret https://provider.invalid/private'),
        ),
      },
      embedding: {
        checkHealth: jest.fn().mockResolvedValue({
          configured: true,
          provider: 'embedding',
          reachable: false,
          model: 'text-embedding-model',
          dimensions: 1536,
          error: 'apiKey=secret upstream-body',
          apiKey: 'must-not-leak',
          baseUrl: 'https://provider.invalid/private',
        }),
      },
    });

    await expect(health.providers()).resolves.toEqual({
      llm: {
        configured: true,
        provider: 'llm',
        reachable: false,
        error: 'provider_unreachable',
      },
      embedding: {
        configured: true,
        provider: 'embedding',
        reachable: false,
        model: 'text-embedding-model',
        dimensions: 1536,
        error: 'provider_unreachable',
      },
    });
  });
});
