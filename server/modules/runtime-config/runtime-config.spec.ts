import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { RuntimeConfigModule } from './runtime-config.module';
import { RuntimeConfigService } from './runtime-config.service';
import { RuntimeConfigController } from './runtime-config.controller';

const runtimeOidcEnvironment = {
  OIDC_PROVIDER: 'Auth0',
  OIDC_CLIENT_ID: 'public-client-id',
  OIDC_ISSUER_URL: 'https://tenant.example.auth0.com/',
  OIDC_REDIRECT_URI: 'https://write.yingrenji.cn/auth/callback',
  OIDC_POST_LOGOUT_REDIRECT_URI: 'https://write.yingrenji.cn/login',
};

describe('runtime OIDC public configuration', () => {
  it('exposes an unauthenticated no-store GET route at the frozen path', () => {
    const route = RuntimeConfigController.prototype.getOidcConfig;
    expect(Reflect.getMetadata('path', route)).toBe('oidc');
    expect(Reflect.getMetadata('method', route)).toBe(0);
    expect(Reflect.getMetadata('path', RuntimeConfigController)).toBe(
      'api/runtime-config',
    );

    const response = { setHeader: jest.fn() };
    new RuntimeConfigController({
      getOidcConfig: jest.fn(),
    } as unknown as RuntimeConfigService).getOidcConfig(response as never);
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('returns the narrow public contract and no secret/server policy', () => {
    const service = new RuntimeConfigService({
      NODE_ENV: 'production',
      OIDC_PROVIDER: 'Auth0',
      OIDC_CLIENT_ID: 'public-client-id',
      OIDC_ISSUER_URL: 'https://tenant.example.auth0.com/',
      OIDC_REDIRECT_URI: 'https://write.yingrenji.cn/auth/callback',
      OIDC_POST_LOGOUT_REDIRECT_URI: 'https://write.yingrenji.cn/login',
      OIDC_AUDIENCE: 'https://academic-writing-platform/api',
      OIDC_JWKS_URL: 'https://tenant.example.auth0.com/.well-known/jwks.json',
      OIDC_CLIENT_SECRET: 'must-never-be-used',
    });

    const response = service.getOidcConfig();

    expect(response).toEqual({
      provider: 'Auth0',
      clientId: 'public-client-id',
      issuer: 'https://tenant.example.auth0.com/',
      redirectUri: 'https://write.yingrenji.cn/auth/callback',
      postLogoutRedirectUri: 'https://write.yingrenji.cn/login',
      scope: 'openid profile email',
    });
    expect(Object.keys(response).sort()).toEqual([
      'clientId',
      'issuer',
      'postLogoutRedirectUri',
      'provider',
      'redirectUri',
      'scope',
    ]);
    expect(JSON.stringify(response)).not.toContain('must-never-be-used');
    expect(JSON.stringify(response)).not.toContain('academic-writing-platform/api');
  });

  it('fails closed when production browser configuration is incomplete', () => {
    expect(() =>
      new RuntimeConfigService({
        NODE_ENV: 'production',
        OIDC_PROVIDER: 'Auth0',
        OIDC_ISSUER_URL: 'https://tenant.example.auth0.com/',
        OIDC_REDIRECT_URI: 'https://write.yingrenji.cn/auth/callback',
        OIDC_POST_LOGOUT_REDIRECT_URI: 'https://write.yingrenji.cn/login',
      }).getOidcConfig(),
    ).toThrow(/OIDC_CLIENT_ID/);
  });
});

describe('RuntimeConfigModule Nest integration', () => {
  let app: INestApplication | undefined;
  let baseUrl: string;
  let originalEnvironment: Record<string, string | undefined>;

  beforeEach(async () => {
    originalEnvironment = Object.fromEntries(
      Object.keys(runtimeOidcEnvironment).map((name) => [
        name,
        process.env[name],
      ]),
    );
    Object.assign(process.env, runtimeOidcEnvironment);

    const moduleRef = await Test.createTestingModule({
      imports: [RuntimeConfigModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await app?.close();
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('injects the module RuntimeConfigService into the Nest-created controller', () => {
    const controller = app!.get(RuntimeConfigController);
    const service = app!.get(RuntimeConfigService);
    const injectedService = (
      controller as unknown as {
        runtimeConfig: RuntimeConfigService;
      }
    ).runtimeConfig;

    expect(injectedService === service).toBe(true);
  });

  it('serves the public OIDC config through the real Nest HTTP route', async () => {
    const response = await fetch(`${baseUrl}/api/runtime-config/oidc`);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      provider: 'Auth0',
      clientId: 'public-client-id',
      issuer: 'https://tenant.example.auth0.com/',
      redirectUri: 'https://write.yingrenji.cn/auth/callback',
      postLogoutRedirectUri: 'https://write.yingrenji.cn/login',
      scope: 'openid profile email',
    });
  });
});
