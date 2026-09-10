import { RuntimeProfileConfigurationError } from './runtime-profile';

export const STANDALONE_OIDC_SCOPE = 'openid profile email';
export const STANDALONE_OIDC_PROVIDER = 'Auth0';
export const STANDALONE_OIDC_REDIRECT_URI =
  'https://write.yingrenji.cn/auth/callback';
export const STANDALONE_OIDC_POST_LOGOUT_REDIRECT_URI =
  'https://write.yingrenji.cn/login';

export interface StandaloneOidcClientConfig {
  provider: typeof STANDALONE_OIDC_PROVIDER;
  clientId: string;
  issuer: string;
  redirectUri: typeof STANDALONE_OIDC_REDIRECT_URI;
  postLogoutRedirectUri: typeof STANDALONE_OIDC_POST_LOGOUT_REDIRECT_URI;
  scope: typeof STANDALONE_OIDC_SCOPE;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new RuntimeProfileConfigurationError(
      `${name} is required for the standalone browser OIDC runtime.`,
    );
  }
  return value;
}

function requireHttpsUrl(value: string, name: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') throw new Error('HTTPS required');
    return url.toString();
  } catch (_error) {
    throw new RuntimeProfileConfigurationError(
      `${name} must be a valid HTTPS URL.`,
    );
  }
}

function requireExact(value: string, expected: string, name: string): string {
  if (value !== expected) {
    throw new RuntimeProfileConfigurationError(
      `${name} must equal the frozen production value.`,
    );
  }
  return value;
}

export function loadStandaloneOidcClientConfig(
  env: NodeJS.ProcessEnv = process.env,
): StandaloneOidcClientConfig {
  const provider = required(env, 'OIDC_PROVIDER');
  if (provider !== STANDALONE_OIDC_PROVIDER) {
    throw new RuntimeProfileConfigurationError(
      `OIDC_PROVIDER must be ${STANDALONE_OIDC_PROVIDER}.`,
    );
  }

  const issuer = requireHttpsUrl(required(env, 'OIDC_ISSUER_URL'), 'OIDC_ISSUER_URL');
  const redirectUri = requireExact(
    requireHttpsUrl(required(env, 'OIDC_REDIRECT_URI'), 'OIDC_REDIRECT_URI'),
    STANDALONE_OIDC_REDIRECT_URI,
    'OIDC_REDIRECT_URI',
  );
  const postLogoutRedirectUri = requireExact(
    requireHttpsUrl(
      required(env, 'OIDC_POST_LOGOUT_REDIRECT_URI'),
      'OIDC_POST_LOGOUT_REDIRECT_URI',
    ),
    STANDALONE_OIDC_POST_LOGOUT_REDIRECT_URI,
    'OIDC_POST_LOGOUT_REDIRECT_URI',
  );

  return {
    provider: STANDALONE_OIDC_PROVIDER,
    clientId: required(env, 'OIDC_CLIENT_ID'),
    issuer,
    redirectUri: redirectUri as typeof STANDALONE_OIDC_REDIRECT_URI,
    postLogoutRedirectUri:
      postLogoutRedirectUri as typeof STANDALONE_OIDC_POST_LOGOUT_REDIRECT_URI,
    scope: STANDALONE_OIDC_SCOPE,
  };
}
