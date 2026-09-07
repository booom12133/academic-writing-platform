import type {
  AuthAdapter,
  AuthSessionSnapshot,
  LocalAuthProfile,
  PlatformAuthClient,
  PlatformAuthOperationResponse,
  PlatformSessionResponse,
  StandaloneAuthBridge,
} from './session.types';
import { isRealAccessToken } from './session.types';

const AUTH_PROVIDER_ERROR = 'AUTH_PROVIDER_ERROR';
const AUTH_CONFIGURATION_UNAVAILABLE = 'AUTH_CONFIGURATION_UNAVAILABLE';

function errorSnapshot(errorCode: string): AuthSessionSnapshot {
  return { status: 'error', errorCode };
}

export async function logoutWithAdapter(
  adapter: Pick<AuthAdapter, 'signOut'>,
  refreshSession: () => Promise<AuthSessionSnapshot>,
): Promise<AuthSessionSnapshot> {
  if (!adapter.signOut) {
    return refreshSession();
  }

  try {
    await adapter.signOut();
    return { status: 'anonymous' };
  } catch (_error) {
    return errorSnapshot(AUTH_PROVIDER_ERROR);
  }
}

function platformDisplayName(
  name: readonly { text?: string }[] | undefined,
): string | undefined {
  if (!Array.isArray(name)) return undefined;
  const text = name.find((item) => typeof item?.text === 'string')?.text?.trim();
  return text || undefined;
}

function isAnonymousPlatformResponse(response: PlatformSessionResponse): boolean {
  return response.status === 401 || response.error?.code === 401 || response.error?.code === '401';
}

function platformSnapshot(response: PlatformSessionResponse): AuthSessionSnapshot {
  if (response.error) {
    return isAnonymousPlatformResponse(response)
      ? { status: 'anonymous' }
      : errorSnapshot(AUTH_PROVIDER_ERROR);
  }

  const user = response.data?.user_info;
  const userId = user?.user_id === undefined ? undefined : String(user.user_id).trim();
  if (!userId) return { status: 'anonymous' };

  return {
    status: 'authenticated',
    userId,
    displayName: platformDisplayName(user?.name),
  };
}

function assertSuccessfulPlatformOperation(
  response: PlatformAuthOperationResponse,
): void {
  if (response.error || response.status < 200 || response.status >= 300) {
    throw new Error(AUTH_PROVIDER_ERROR);
  }
}

export function createLocalAuthAdapter(
  loadProfile: () => Promise<LocalAuthProfile>,
): AuthAdapter {
  return {
    async getSession() {
      try {
        const profile = await loadProfile();
        const userId = profile.userId.trim();
        return userId
          ? {
              status: 'authenticated',
              userId,
              ...(profile.username?.trim()
                ? { displayName: profile.username.trim() }
                : {}),
            }
          : { status: 'error', errorCode: AUTH_PROVIDER_ERROR };
      } catch (_error) {
        return errorSnapshot(AUTH_PROVIDER_ERROR);
      }
    },
    async getAccessToken() {
      return null;
    },
  };
}

export function createPlatformAuthAdapter(
  sessionClient: PlatformAuthClient,
): AuthAdapter {
  return {
    async getSession() {
      try {
        return platformSnapshot(await sessionClient.getUserInfo());
      } catch (_error) {
        return errorSnapshot(AUTH_PROVIDER_ERROR);
      }
    },
    async getAccessToken() {
      return null;
    },
    async beginLogin(returnUrl: string) {
      if (!sessionClient.redirectToLogin) {
        throw new Error(AUTH_CONFIGURATION_UNAVAILABLE);
      }
      assertSuccessfulPlatformOperation(
        sessionClient.redirectToLogin({ returnUrl }),
      );
    },
    ...(sessionClient.signOut
      ? {
          async signOut() {
            assertSuccessfulPlatformOperation(await sessionClient.signOut!());
          },
        }
      : {}),
  };
}

export function createStandaloneAuthAdapter(
  bridge?: StandaloneAuthBridge,
): AuthAdapter {
  return {
    async getSession() {
      if (!bridge) return errorSnapshot(AUTH_CONFIGURATION_UNAVAILABLE);
      try {
        if (bridge.getSession) {
          return bridge.getSession();
        }
        const token = await bridge.getAccessToken();
        return isRealAccessToken(token)
          ? { status: 'authenticated' }
          : errorSnapshot(AUTH_CONFIGURATION_UNAVAILABLE);
      } catch (_error) {
        return errorSnapshot(AUTH_PROVIDER_ERROR);
      }
    },
    async getAccessToken() {
      if (!bridge) return null;
      try {
        const token = await bridge.getAccessToken();
        return isRealAccessToken(token) ? token.trim() : null;
      } catch (_error) {
        return null;
      }
    },
    ...(bridge?.beginLogin ? { beginLogin: bridge.beginLogin } : {}),
    ...(bridge?.signOut ? { signOut: bridge.signOut } : {}),
  };
}

function runtimeProfile(): 'local' | 'platform' | 'standalone' | undefined {
  const profile = process.env.RUNTIME_PROFILE;
  return profile === 'local' || profile === 'platform' || profile === 'standalone'
    ? profile
    : undefined;
}

function standaloneBridgeFromHost(): StandaloneAuthBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { __academicWritingAuthBridge?: StandaloneAuthBridge })
    .__academicWritingAuthBridge;
}

export interface RuntimeAuthAdapterDependencies {
  loadLocalProfile: () => Promise<LocalAuthProfile>;
  platformClient?: PlatformAuthClient;
  standaloneBridge?: StandaloneAuthBridge;
}

function unavailableAuthAdapter(): AuthAdapter {
  return {
    async getSession() {
      return errorSnapshot(AUTH_CONFIGURATION_UNAVAILABLE);
    },
    async getAccessToken() {
      return null;
    },
  };
}

export function createRuntimeAuthAdapter(
  dependencies: RuntimeAuthAdapterDependencies,
): AuthAdapter {
  const profile = runtimeProfile();
  if (profile === 'platform' || (!profile && typeof window !== 'undefined' && window.appId)) {
    return dependencies.platformClient
      ? createPlatformAuthAdapter(dependencies.platformClient)
      : unavailableAuthAdapter();
  }
  if (
    profile === 'standalone' ||
    (!profile && process.env.NODE_ENV === 'production')
  ) {
    return createStandaloneAuthAdapter(
      dependencies.standaloneBridge ?? standaloneBridgeFromHost(),
    );
  }
  return createLocalAuthAdapter(dependencies.loadLocalProfile);
}
