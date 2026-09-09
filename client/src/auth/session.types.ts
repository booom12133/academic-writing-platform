export type AuthSessionStatus =
  | 'loading'
  | 'authenticated'
  | 'anonymous'
  | 'error';

export interface AuthSessionSnapshot {
  status: AuthSessionStatus;
  userId?: string;
  displayName?: string;
  loginUrl?: string;
  errorCode?: string;
}

export interface AuthAdapter {
  getSession(): Promise<AuthSessionSnapshot>;
  getAccessToken(): Promise<string | null>;
  completeLogin?: () => Promise<{ session: AuthSessionSnapshot; returnUrl: string }>;
  beginLogin?: (returnUrl: string) => void | Promise<void>;
  signOut?: () => Promise<void>;
}

export interface LocalAuthProfile {
  userId: string;
  username?: string;
}

export interface PlatformUserInfo {
  user_id?: number | string;
  name?: readonly { text?: string }[];
}

export interface PlatformSessionResponse {
  data: { user_info?: PlatformUserInfo } | null;
  error: { code?: number | string; message?: string } | null;
  status: number;
  statusText?: string;
}

export interface PlatformAuthOperationResponse {
  data: unknown;
  error: { code?: number | string; message?: string } | null;
  status: number;
  statusText?: string;
}

export interface PlatformAuthClient {
  getUserInfo: () => Promise<PlatformSessionResponse>;
  redirectToLogin?: (
    options: { returnUrl: string },
  ) => PlatformAuthOperationResponse;
  signOut?: () => Promise<PlatformAuthOperationResponse>;
}

export interface StandaloneAuthBridge {
  getAccessToken: () => Promise<string | null>;
  getSession?: () => Promise<AuthSessionSnapshot>;
  completeLogin?: () => Promise<{ session: AuthSessionSnapshot; returnUrl: string }>;
  beginLogin?: (returnUrl: string) => void | Promise<void>;
  signOut?: () => Promise<void>;
}

export function isRealAccessToken(value: unknown): value is string {
  const token = typeof value === 'string' ? value.trim() : '';
  return (
    token.length > 0 &&
    !/^(mock|fake|test)(?:[_-]|$)/i.test(token)
  );
}
