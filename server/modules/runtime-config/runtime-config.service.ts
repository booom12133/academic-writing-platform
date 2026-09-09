import {
  loadStandaloneOidcClientConfig,
  type StandaloneOidcClientConfig,
} from '../../config/standalone-oidc-client';

export class RuntimeConfigService {
  constructor(private readonly environment: NodeJS.ProcessEnv = process.env) {}

  getOidcConfig(): StandaloneOidcClientConfig {
    return loadStandaloneOidcClientConfig(this.environment);
  }
}
