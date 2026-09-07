export interface ProxyTrustApplication {
  set(setting: 'trust proxy', value: number): unknown;
}

export function applyProxyTrust(
  app: ProxyTrustApplication,
  trustedProxyHops: number,
): void {
  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 0 || trustedProxyHops > 10) {
    throw new Error('Trusted proxy hop count must be an integer between 0 and 10.');
  }
  app.set('trust proxy', trustedProxyHops);
}
