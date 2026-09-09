import {
  UserManager,
  WebStorageStateStore,
  type User,
  type UserManagerSettings,
} from 'oidc-client-ts';
import axios from 'axios';

import { sanitizeReturnPath } from './return-path';
import type {
  AuthSessionSnapshot,
  StandaloneAuthBridge,
} from './session.types';

export interface StandaloneOidcRuntimeConfig {
  provider: string;
  clientId: string;
  issuer: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scope: string;
}

type UserManagerLike = Pick<
  UserManager,
  | 'signinRedirect'
  | 'signinRedirectCallback'
  | 'getUser'
  | 'signoutRedirect'
  | 'removeUser'
>;

type UserManagerFactory = (settings: UserManagerSettings) => UserManagerLike;

function requireBrowserStorage(): Storage {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    throw new Error('AUTH_CONFIGURATION_UNAVAILABLE');
  }
  return window.sessionStorage;
}

function sessionFromUser(user: Pick<User, 'access_token' | 'expired' | 'profile'>): AuthSessionSnapshot {
  const userId = typeof user.profile.sub === 'string' ? user.profile.sub.trim() : '';
  if (!userId || user.expired || !user.access_token.trim()) {
    throw new Error('AUTH_PROVIDER_ERROR');
  }
  const displayName = [user.profile.name, user.profile.email]
    .find((value) => typeof value === 'string' && value.trim())
    ?.trim();
  return {
    status: 'authenticated',
    userId,
    ...(displayName ? { displayName } : {}),
  };
}

function isUsableUser(user: User | null): user is User {
  return Boolean(user && !user.expired && typeof user.access_token === 'string');
}

export function createOidcUserManagerSettings(
  config: StandaloneOidcRuntimeConfig,
): UserManagerSettings {
  const storage = requireBrowserStorage();
  const stateStore = new WebStorageStateStore({ store: storage });
  return {
    authority: config.issuer,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    post_logout_redirect_uri: config.postLogoutRedirectUri,
    response_type: 'code',
    scope: config.scope,
    stateStore,
    userStore: new WebStorageStateStore({ store: storage }),
    automaticSilentRenew: false,
    monitorSession: false,
  };
}

function defaultManagerFactory(settings: UserManagerSettings): UserManager {
  return new UserManager(settings);
}

export function createStandaloneOidcAuthBridge(
  config: StandaloneOidcRuntimeConfig,
  managerFactory: UserManagerFactory = defaultManagerFactory,
): StandaloneAuthBridge {
  let manager: UserManagerLike | undefined;
  const getManager = (): UserManagerLike => {
    manager ??= managerFactory(createOidcUserManagerSettings(config));
    return manager;
  };

  return {
    async beginLogin(returnUrl: string) {
      await getManager().signinRedirect({
        state: { returnUrl: sanitizeReturnPath(returnUrl) },
      });
    },
    async completeLogin() {
      const user = await getManager().signinRedirectCallback();
      const session = sessionFromUser(user);
      const state = user.state;
      const returnUrl =
        state && typeof state === 'object' && 'returnUrl' in state
          ? sanitizeReturnPath((state as { returnUrl?: unknown }).returnUrl as string)
          : '/';
      return { session, returnUrl };
    },
    async getAccessToken() {
      const user = await getManager().getUser();
      return isUsableUser(user) ? user.access_token.trim() : null;
    },
    async getSession() {
      const user = await getManager().getUser();
      return isUsableUser(user) ? sessionFromUser(user) : { status: 'anonymous' };
    },
    async signOut() {
      try {
        await getManager().signoutRedirect({
          post_logout_redirect_uri: config.postLogoutRedirectUri,
        });
      } finally {
        await getManager().removeUser();
      }
    },
  };
}

async function fetchRuntimeConfig(): Promise<StandaloneOidcRuntimeConfig> {
  const response = await axios.get<Partial<StandaloneOidcRuntimeConfig>>(
    '/api/runtime-config/oidc',
    { headers: { accept: 'application/json', 'cache-control': 'no-cache' } },
  );
  const config = response.data;
  const required = [
    'provider',
    'clientId',
    'issuer',
    'redirectUri',
    'postLogoutRedirectUri',
    'scope',
  ] as const;
  if (required.some((key) => typeof config[key] !== 'string' || !config[key]?.trim())) {
    throw new Error('AUTH_CONFIGURATION_UNAVAILABLE');
  }
  return config as StandaloneOidcRuntimeConfig;
}

export function createLazyStandaloneOidcAuthBridge(): StandaloneAuthBridge {
  let bridgePromise: Promise<StandaloneAuthBridge> | undefined;
  const getBridge = () => {
    bridgePromise ??= fetchRuntimeConfig().then((config) =>
      createStandaloneOidcAuthBridge(config),
    );
    return bridgePromise;
  };
  return {
    beginLogin: (returnUrl) => getBridge().then((bridge) => bridge.beginLogin!(returnUrl)),
    completeLogin: () => getBridge().then((bridge) => bridge.completeLogin!()),
    getAccessToken: () => getBridge().then((bridge) => bridge.getAccessToken()),
    getSession: () => getBridge().then((bridge) => bridge.getSession!()),
    signOut: () => getBridge().then((bridge) => bridge.signOut!()),
  };
}
