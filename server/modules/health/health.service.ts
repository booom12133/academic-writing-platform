import type { RuntimeConfig } from '../../config/production-config';
import type { DatabaseReadinessResult } from '../../database/database-readiness';
import type { StorageReadinessResult } from '../document-input/storage-readiness';
import type { EmbeddingHealth } from '../knowledge/indexing/embedding.types';
import type { LlmHealthResult } from '../ai-tools/llm/llm.types';
import type { HealthStatus, ProviderHealthView } from './health.types';

export interface HealthDependencies {
  database?: () => Promise<DatabaseReadinessResult>;
  storage?: () => Promise<StorageReadinessResult>;
  llm?: { checkHealth(): Promise<LlmHealthResult> };
  embedding?: { checkHealth(): Promise<EmbeddingHealth> };
}

export class HealthService {
  constructor(
    private readonly config: RuntimeConfig,
    private readonly dependencies: HealthDependencies = {},
  ) {}

  async live(): Promise<HealthStatus> {
    return { status: 'ok' };
  }

  async ready(): Promise<HealthStatus> {
    if (this.config.database.mode === 'postgres') {
      if (!this.dependencies.database)
        return { status: 'not_ready', reasonCode: 'database_unreachable' };
      const database = await this.dependencies.database();
      if (!database.ready)
        return {
          status: 'not_ready',
          reasonCode: database.reasonCode || 'database_unreachable',
        };
    }
    if (this.config.storage.mode === 'persistent-filesystem') {
      if (!this.dependencies.storage)
        return { status: 'not_ready', reasonCode: 'storage_root_missing' };
      const storage = await this.dependencies.storage();
      if (!storage.ready)
        return {
          status: 'not_ready',
          reasonCode: storage.reasonCode || 'storage_root_missing',
        };
    }
    return { status: 'ok' };
  }

  async providers(): Promise<Record<string, ProviderHealthView>> {
    const result: Record<string, ProviderHealthView> = {};
    if (this.dependencies.llm) {
      result.llm = await this.safeProviderHealth(
        () => this.dependencies.llm!.checkHealth(),
        'llm',
      );
    }
    if (this.dependencies.embedding) {
      result.embedding = await this.safeProviderHealth(
        () => this.dependencies.embedding!.checkHealth(),
        'embedding',
      );
    }
    return result;
  }

  private async safeProviderHealth(
    check: () => Promise<LlmHealthResult | EmbeddingHealth>,
    fallbackProvider: string,
  ): Promise<ProviderHealthView> {
    try {
      const health = await check();
      return {
        configured: health.configured,
        provider: health.provider || fallbackProvider,
        reachable: health.reachable,
        ...('model' in health && health.model ? { model: health.model } : {}),
        ...('defaultModel' in health && health.defaultModel
          ? { defaultModel: health.defaultModel }
          : {}),
        ...('dimensions' in health && typeof health.dimensions === 'number'
          ? { dimensions: health.dimensions }
          : {}),
        ...(health.reachable ? {} : { error: 'provider_unreachable' }),
      };
    } catch {
      return {
        configured: true,
        provider: fallbackProvider,
        reachable: false,
        error: 'provider_unreachable',
      };
    }
  }
}
