import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authClient } from '@lark-apaas/client-toolkit/auth';
import { getAxiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

import { getProfile } from '../api/user';
import {
  configureBackendHttpClient,
  configureHttpAuth,
} from '../api/http';
import {
  createRuntimeAuthAdapter,
  type RuntimeAuthAdapterDependencies,
} from './session-provider';
import type {
  AuthAdapter,
  AuthSessionSnapshot,
} from './session.types';

export interface AppAuthContextValue extends AuthSessionSnapshot {
  refreshSession: () => Promise<AuthSessionSnapshot>;
  logout: () => Promise<void>;
  beginLogin?: (returnUrl: string) => Promise<void>;
}

const AppAuthContext = createContext<AppAuthContextValue | null>(null);

configureBackendHttpClient(getAxiosForBackend());

export interface AppAuthProviderProps {
  children: React.ReactNode;
  adapter?: AuthAdapter;
  runtimeDependencies?: RuntimeAuthAdapterDependencies;
}

export function AppAuthProvider({
  children,
  adapter: providedAdapter,
  runtimeDependencies,
}: AppAuthProviderProps) {
  const adapter = useMemo(
    () =>
      providedAdapter ??
      createRuntimeAuthAdapter(
        runtimeDependencies ?? {
          loadLocalProfile: getProfile,
          platformClient: authClient.session,
        },
      ),
    [providedAdapter, runtimeDependencies],
  );
  const [session, setSession] = useState<AuthSessionSnapshot>({
    status: 'loading',
  });

  const refreshSession = useCallback(async () => {
    setSession({ status: 'loading' });
    try {
      const nextSession = await adapter.getSession();
      setSession(nextSession);
      return nextSession;
    } catch (_error) {
      const nextSession: AuthSessionSnapshot = {
        status: 'error',
        errorCode: 'AUTH_PROVIDER_ERROR',
      };
      setSession(nextSession);
      return nextSession;
    }
  }, [adapter]);

  useEffect(() => {
    configureHttpAuth({
      getAccessToken: adapter.getAccessToken,
      onUnauthorized: () => setSession({ status: 'anonymous' }),
    });
    void refreshSession();
  }, [adapter, refreshSession]);

  const logout = useCallback(async () => {
    try {
      await adapter.signOut?.();
      setSession({ status: 'anonymous' });
    } catch (_error) {
      setSession({ status: 'error', errorCode: 'AUTH_PROVIDER_ERROR' });
    }
  }, [adapter]);

  const beginLogin = useCallback(
    async (returnUrl: string) => {
      if (!adapter.beginLogin) {
        throw new Error('AUTH_CONFIGURATION_UNAVAILABLE');
      }
      await adapter.beginLogin(returnUrl);
    },
    [adapter],
  );

  const value = useMemo<AppAuthContextValue>(
    () => ({
      ...session,
      refreshSession,
      logout,
      ...(adapter.beginLogin ? { beginLogin } : {}),
    }),
    [adapter.beginLogin, beginLogin, logout, refreshSession, session],
  );

  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>;
}

export function useAppAuth(): AppAuthContextValue {
  const context = useContext(AppAuthContext);
  if (!context) {
    throw new Error('useAppAuth must be used within AppAuthProvider');
  }
  return context;
}
