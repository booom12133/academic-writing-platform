import { createStandaloneOidcAuthBridge } from '../../client/src/auth/standalone-oidc';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('standalone browser OIDC bridge', () => {
  const config = {
    provider: 'Auth0',
    clientId: 'public-client-id',
    issuer: 'https://tenant.example.auth0.com/',
    audience: 'https://academic-writing-platform/api',
    redirectUri: 'https://write.yingrenji.cn/auth/callback',
    postLogoutRedirectUri: 'https://write.yingrenji.cn/login',
    scope: 'openid profile email',
  };

  it('uses code flow, PKCE, and sessionStorage-backed state and user storage', async () => {
    const signinRedirect = jest.fn().mockResolvedValue(undefined);
    const manager = {
      signinRedirect,
      signinRedirectCallback: jest.fn(),
      getUser: jest.fn(),
      signoutRedirect: jest.fn(),
      removeUser: jest.fn(),
    };
    const sessionStorage = {};
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { sessionStorage },
    });
    const createManager = jest.fn((settings: unknown) => {
      expect(settings).toMatchObject({
        authority: config.issuer,
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        post_logout_redirect_uri: config.postLogoutRedirectUri,
        response_type: 'code',
        scope: config.scope,
      });
      expect(settings).toHaveProperty('extraQueryParams', {
        audience: config.audience,
      });
      expect(settings).not.toHaveProperty('client_secret');
      expect(settings).toMatchObject({
        stateStore: { _store: sessionStorage },
        userStore: { _store: sessionStorage },
      });
      return manager;
    });

    const bridge = createStandaloneOidcAuthBridge(config, createManager);
    await bridge.beginLogin?.('/tools?from=login');

    expect(signinRedirect).toHaveBeenCalledWith({
      state: { returnUrl: '/tools?from=login' },
    });
  });

  it('completes callback, restores a sanitized return path, and exposes session token', async () => {
    const manager = {
      signinRedirect: jest.fn(),
      signinRedirectCallback: jest.fn().mockResolvedValue({
        access_token: 'real-access-token',
        expired: false,
        profile: { sub: 'auth0|user-1', name: 'User One' },
        state: { returnUrl: 'https://evil.example/' },
      }),
      getUser: jest.fn().mockResolvedValue({
        access_token: 'real-access-token',
        expired: false,
        profile: { sub: 'auth0|user-1', name: 'User One' },
      }),
      signoutRedirect: jest.fn(),
      removeUser: jest.fn(),
    };
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { sessionStorage: {} },
    });

    const bridge = createStandaloneOidcAuthBridge(config, () => manager);
    await expect(bridge.completeLogin?.()).resolves.toEqual({
      session: {
        status: 'authenticated',
        userId: 'auth0|user-1',
        displayName: 'User One',
      },
      returnUrl: '/',
    });
    await expect(bridge.getAccessToken()).resolves.toBe('real-access-token');
    await expect(bridge.getSession?.()).resolves.toEqual({
      status: 'authenticated',
      userId: 'auth0|user-1',
      displayName: 'User One',
    });
  });

  it('clears the session through the provider logout flow', async () => {
    const signoutRedirect = jest.fn().mockResolvedValue(undefined);
    const removeUser = jest.fn().mockResolvedValue(undefined);
    const manager = {
      signinRedirect: jest.fn(),
      signinRedirectCallback: jest.fn(),
      getUser: jest.fn(),
      signoutRedirect,
      removeUser,
    };
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { sessionStorage: {} },
    });

    const bridge = createStandaloneOidcAuthBridge(config, () => manager);
    await bridge.signOut?.();

    expect(signoutRedirect).toHaveBeenCalledWith({
      post_logout_redirect_uri: config.postLogoutRedirectUri,
    });
    expect(removeUser).toHaveBeenCalledTimes(1);
  });

  it('fails closed for expired or malformed callback sessions', async () => {
    const manager = {
      signinRedirect: jest.fn(),
      signinRedirectCallback: jest.fn().mockResolvedValue({
        access_token: 'expired-token',
        expired: true,
        profile: { sub: 'auth0|user-1' },
      }),
      getUser: jest.fn().mockResolvedValue(null),
      signoutRedirect: jest.fn(),
      removeUser: jest.fn(),
    };
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { sessionStorage: {} },
    });
    const bridge = createStandaloneOidcAuthBridge(config, () => manager);

    await expect(bridge.completeLogin?.()).rejects.toThrow();
    await expect(bridge.getAccessToken()).resolves.toBeNull();
    await expect(bridge.getSession?.()).resolves.toEqual({ status: 'anonymous' });
  });

  it('contains no browser client secret or localStorage credential path', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../client/src/auth/standalone-oidc.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/client[_-]?secret/i);
    expect(source).not.toMatch(/localStorage/);
    expect(source).not.toContain('https://academic-writing-platform/api');
  });
});
