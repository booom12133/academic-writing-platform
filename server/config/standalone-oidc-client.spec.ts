import { loadStandaloneOidcClientConfig } from './standalone-oidc-client';

const validEnvironment = {
  NODE_ENV: 'production',
  OIDC_PROVIDER: 'Auth0',
  OIDC_CLIENT_ID: 'public-client-id',
  OIDC_ISSUER_URL: 'https://tenant.example.auth0.com/',
  OIDC_REDIRECT_URI: 'https://write.yingrenji.cn/auth/callback',
  OIDC_POST_LOGOUT_REDIRECT_URI: 'https://write.yingrenji.cn/login',
};

describe('standalone public OIDC client configuration', () => {
  it('returns only the reviewed public browser configuration', () => {
    expect(loadStandaloneOidcClientConfig(validEnvironment)).toEqual({
      provider: 'Auth0',
      clientId: 'public-client-id',
      issuer: 'https://tenant.example.auth0.com/',
      redirectUri: 'https://write.yingrenji.cn/auth/callback',
      postLogoutRedirectUri: 'https://write.yingrenji.cn/login',
      scope: 'openid profile email',
    });
  });

  it('fails closed when a required public setting is absent or unsafe', () => {
    expect(() =>
      loadStandaloneOidcClientConfig({
        ...validEnvironment,
        OIDC_CLIENT_ID: '',
      }),
    ).toThrow(/OIDC_CLIENT_ID/);

    expect(() =>
      loadStandaloneOidcClientConfig({
        ...validEnvironment,
        OIDC_ISSUER_URL: 'http://tenant.example.auth0.com/',
      }),
    ).toThrow(/OIDC_ISSUER_URL/);

    expect(() =>
      loadStandaloneOidcClientConfig({
        ...validEnvironment,
        OIDC_REDIRECT_URI: 'https://evil.example/auth/callback',
      }),
    ).toThrow(/OIDC_REDIRECT_URI/);
  });

  it('does not accept a client secret as browser configuration', () => {
    const config = loadStandaloneOidcClientConfig({
      ...validEnvironment,
      OIDC_CLIENT_SECRET: 'must-never-be-used',
    });

    expect(config).not.toHaveProperty('clientSecret');
    expect(JSON.stringify(config)).not.toContain('must-never-be-used');
  });
});
