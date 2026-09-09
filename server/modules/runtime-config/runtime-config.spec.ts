import { RuntimeConfigService } from './runtime-config.service';
import { RuntimeConfigController } from './runtime-config.controller';

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
      audience: 'https://academic-writing-platform/api',
      redirectUri: 'https://write.yingrenji.cn/auth/callback',
      postLogoutRedirectUri: 'https://write.yingrenji.cn/login',
      scope: 'openid profile email',
    });
    expect(Object.keys(response).sort()).toEqual([
      'audience',
      'clientId',
      'issuer',
      'postLogoutRedirectUri',
      'provider',
      'redirectUri',
      'scope',
    ]);
    expect(JSON.stringify(response)).not.toContain('must-never-be-used');
    expect(response.audience).toBe('https://academic-writing-platform/api');
    expect(response).not.toHaveProperty('client_secret');
    expect(response).not.toHaveProperty('jwksUrl');
    expect(response).not.toHaveProperty('allowedAlgorithms');
    expect(response).not.toHaveProperty('userIdClaim');
    expect(response).not.toHaveProperty('databaseUrl');
    expect(response).not.toHaveProperty('providerApiKey');
  });

  it('fails closed when production browser configuration is incomplete', () => {
    expect(() =>
      new RuntimeConfigService({
        NODE_ENV: 'production',
        OIDC_PROVIDER: 'Auth0',
        OIDC_AUDIENCE: 'https://academic-writing-platform/api',
        OIDC_ISSUER_URL: 'https://tenant.example.auth0.com/',
        OIDC_REDIRECT_URI: 'https://write.yingrenji.cn/auth/callback',
        OIDC_POST_LOGOUT_REDIRECT_URI: 'https://write.yingrenji.cn/login',
      }).getOidcConfig(),
    ).toThrow(/OIDC_CLIENT_ID/);
  });
});
