import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  createLocalAuthAdapter,
  createPlatformAuthAdapter,
  createStandaloneAuthAdapter,
  logoutWithAdapter,
} from '../../client/src/auth/session-provider';

describe('client auth session adapters', () => {
  it('maps an authenticated local profile to an authenticated session', async () => {
    const adapter = createLocalAuthAdapter(async () => ({
      userId: 'local-user',
      username: 'Local User',
    }));

    await expect(adapter.getSession()).resolves.toEqual({
      status: 'authenticated',
      userId: 'local-user',
      displayName: 'Local User',
    });
  });

  it('maps an unavailable local profile to an auth provider error', async () => {
    const adapter = createLocalAuthAdapter(async () => {
      throw new Error('profile unavailable');
    });

    await expect(adapter.getSession()).resolves.toEqual({
      status: 'error',
      errorCode: 'AUTH_PROVIDER_ERROR',
    });
  });

  it('does not strand a local-fixed session when logout has no provider operation', async () => {
    const adapter = createLocalAuthAdapter(async () => ({
      userId: 'local-user',
      username: 'Local User',
    }));
    const refreshSession = jest.fn(() => adapter.getSession());

    await expect(logoutWithAdapter(adapter, refreshSession)).resolves.toEqual({
      status: 'authenticated',
      userId: 'local-user',
      displayName: 'Local User',
    });
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('sets an anonymous session only after a real provider sign-out', async () => {
    const signOut = jest.fn().mockResolvedValue(undefined);
    const adapter = createLocalAuthAdapter(async () => ({ userId: 'local-user' }));
    const adapterWithSignOut = { ...adapter, signOut };
    const refreshSession = jest.fn(() => adapter.getSession());

    await expect(
      logoutWithAdapter(adapterWithSignOut, refreshSession),
    ).resolves.toEqual({ status: 'anonymous' });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('maps an authenticated platform cookie session without fabricating a bearer token', async () => {
    const sessionClient = {
      getUserInfo: jest.fn().mockResolvedValue({
        data: { user_info: { user_id: 42, name: [{ text: 'Platform User' }] } },
        error: null,
        status: 200,
        statusText: 'OK',
      }),
      redirectToLogin: jest.fn().mockReturnValue({
        data: 'success',
        error: null,
        status: 200,
        statusText: 'OK',
      }),
      signOut: jest.fn().mockResolvedValue({
        data: null,
        error: null,
        status: 200,
        statusText: 'OK',
      }),
    };
    const adapter = createPlatformAuthAdapter(sessionClient);

    await expect(adapter.getSession()).resolves.toEqual({
      status: 'authenticated',
      userId: '42',
      displayName: 'Platform User',
    });
    await expect(adapter.getAccessToken()).resolves.toBeNull();
    await adapter.beginLogin?.('/tools');
    await adapter.signOut?.();
    expect(sessionClient.redirectToLogin).toHaveBeenCalledWith({
      returnUrl: '/tools',
    });
    expect(sessionClient.signOut).toHaveBeenCalledTimes(1);
  });

  it('maps an unauthenticated platform response to anonymous', async () => {
    const adapter = createPlatformAuthAdapter({
      getUserInfo: jest.fn().mockResolvedValue({
        data: null,
        error: { code: 401, message: 'Authentication required.' },
        status: 401,
        statusText: 'Unauthorized',
      }),
    });

    await expect(adapter.getSession()).resolves.toEqual({
      status: 'anonymous',
    });
  });

  it('fails closed when standalone has no host auth bridge', async () => {
    const adapter = createStandaloneAuthAdapter();

    await expect(adapter.getSession()).resolves.toEqual({
      status: 'error',
      errorCode: 'AUTH_CONFIGURATION_UNAVAILABLE',
    });
    await expect(adapter.getAccessToken()).resolves.toBeNull();
    expect(adapter.beginLogin).toBeUndefined();
    expect(adapter.signOut).toBeUndefined();
  });

  it('does not write a token while loading any session state', async () => {
    const setItem = jest.fn();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { setItem },
    });

    const adapter = createLocalAuthAdapter(async () => ({
      userId: 'local-user',
    }));
    await adapter.getSession();

    expect(setItem).not.toHaveBeenCalled();
  });

  it('removes the legacy simulated login and registration flows', () => {
    const loginSource = fs.readFileSync(
      path.resolve(__dirname, '../../client/src/pages/Login/LoginPage.tsx'),
      'utf8',
    );
    const registerSource = fs.readFileSync(
      path.resolve(__dirname, '../../client/src/pages/Register/RegisterPage.tsx'),
      'utf8',
    );

    expect(loginSource).not.toContain('aw_user_token');
    expect(loginSource).not.toContain('ensureUser');
    expect(registerSource).not.toContain('模拟注册成功');
    expect(registerSource).not.toContain('setTimeout');
  });
});
