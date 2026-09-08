import axios, { type AxiosInstance } from 'axios';

import { isRealAccessToken } from '../auth/session.types';

export interface ProductRequestConfig {
  headers?: Record<string, unknown>;
  withCredentials?: boolean;
  _auth401Handled?: boolean;
}

export interface HttpAuthConfiguration {
  getAccessToken?: () => Promise<string | null>;
  onUnauthorized?: () => void;
}

let httpAuthConfiguration: HttpAuthConfiguration = {};

export function attachBearerToken<T extends ProductRequestConfig>(
  config: T,
  token: string | null,
): T {
  const next = {
    ...config,
    withCredentials: config.withCredentials ?? true,
  } as T;
  if (!isRealAccessToken(token)) return next;

  next.headers = {
    ...(config.headers ?? {}),
    Authorization: `Bearer ${token.trim()}`,
  };
  return next;
}

export function shouldNotifyUnauthorized(
  config: ProductRequestConfig,
): boolean {
  if (config._auth401Handled) return false;
  config._auth401Handled = true;
  return true;
}

export function configureHttpAuth(
  configuration: HttpAuthConfiguration,
): void {
  httpAuthConfiguration = configuration;
}

const configuredClients = new WeakSet<AxiosInstance>();

function installAuthInterceptors(client: AxiosInstance): void {
  if (configuredClients.has(client)) return;
  configuredClients.add(client);
  client.defaults.withCredentials = true;
  client.interceptors.request.use(async (config) => {
    let token: string | null = null;
    if (httpAuthConfiguration.getAccessToken) {
      try {
        token = await httpAuthConfiguration.getAccessToken();
      } catch (_error) {
        token = null;
      }
    }
    return attachBearerToken(config, token);
  });
  client.interceptors.response.use(
    (response) => response,
    (error: { response?: { status?: number }; config?: ProductRequestConfig }) => {
      if (
        error.response?.status === 401 &&
        error.config &&
        shouldNotifyUnauthorized(error.config)
      ) {
        httpAuthConfiguration.onUnauthorized?.();
      }
      return Promise.reject(error);
    },
  );
}

export let productHttpClient = axios.create();
installAuthInterceptors(productHttpClient);

export function configureBackendHttpClient(client: AxiosInstance): void {
  productHttpClient = client;
  installAuthInterceptors(productHttpClient);
}
