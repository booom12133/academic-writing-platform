export type HealthStatus =
  | { status: 'ok' }
  | { status: 'not_ready'; reasonCode: string };

export interface ProviderHealthView {
  configured: boolean;
  provider: string;
  reachable: boolean;
  model?: string;
  defaultModel?: string;
  dimensions?: number;
  error?: 'provider_unreachable';
}
