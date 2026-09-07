import { createRequire } from 'node:module';
import { isAbsolute, normalize, resolve } from 'node:path';
import type { DynamicModule } from '@nestjs/common';

import type { RuntimeConfig } from '../../config/production-config';

const loadPlatformModule = createRequire(__filename);

export type DocumentStorageDriver = 'filesystem' | 'platform';

export interface DocumentStorageConfig {
  driver: DocumentStorageDriver;
  root?: string;
}

export class DocumentStorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentStorageConfigurationError';
  }
}

export function resolveDocumentStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): DocumentStorageConfig {
  const rawDriver = env.DOCUMENT_STORAGE_DRIVER?.trim().toLowerCase() || 'platform';
  if (rawDriver !== 'filesystem' && rawDriver !== 'platform') {
    throw new DocumentStorageConfigurationError(
      `Unsupported DOCUMENT_STORAGE_DRIVER: ${rawDriver}`,
    );
  }
  if (rawDriver === 'platform') return { driver: 'platform' };

  const rawRoot = env.DOCUMENT_STORAGE_ROOT?.trim();
  if (!rawRoot || !isAbsolute(rawRoot)) {
    throw new DocumentStorageConfigurationError(
      'DOCUMENT_STORAGE_ROOT must be an absolute path when DOCUMENT_STORAGE_DRIVER=filesystem.',
    );
  }

  const root = resolve(rawRoot);
  const pathParts = normalize(root).replaceAll('\\', '/').split('/').filter(Boolean);
  const wwwRootIndex = pathParts.findIndex((part) => part.toLowerCase() === 'wwwroot');
  if (wwwRootIndex >= 0 && pathParts.slice(wwwRootIndex + 1).some((part) => part.toLowerCase() === 'public')) {
    throw new DocumentStorageConfigurationError(
      'DOCUMENT_STORAGE_ROOT must be outside the public web root.',
    );
  }

  return { driver: 'filesystem', root };
}

export function resolveRuntimeDocumentStorageConfig(
  runtimeConfig: RuntimeConfig,
): DocumentStorageConfig {
  if (runtimeConfig.storage.mode === 'platform') return { driver: 'platform' };

  const root = runtimeConfig.storage.root;
  if (!root || !isAbsolute(root)) {
    throw new DocumentStorageConfigurationError(
      'Runtime filesystem storage requires an absolute DOCUMENT_STORAGE_ROOT.',
    );
  }

  const normalizedRoot = resolve(root);
  const pathParts = normalize(normalizedRoot)
    .replaceAll('\\', '/')
    .split('/')
    .filter(Boolean);
  const wwwRootIndex = pathParts.findIndex((part) => part.toLowerCase() === 'wwwroot');
  if (
    wwwRootIndex >= 0 &&
    pathParts.slice(wwwRootIndex + 1).some((part) => part.toLowerCase() === 'public')
  ) {
    throw new DocumentStorageConfigurationError(
      'DOCUMENT_STORAGE_ROOT must be outside the public web root.',
    );
  }

  return { driver: 'filesystem', root: normalizedRoot };
}

export function isFilesystemStorage(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveDocumentStorageConfig(env).driver === 'filesystem';
}

export function shouldLoadPlatformModule(config: DocumentStorageConfig): boolean {
  return config.driver === 'platform';
}

export function createPlatformModuleImports(config: DocumentStorageConfig): DynamicModule[] {
  if (!shouldLoadPlatformModule(config)) return [];
  const { PlatformModule } = loadPlatformModule('@lark-apaas/fullstack-nestjs-core') as {
    PlatformModule: { forRoot: () => DynamicModule };
  };
  return [PlatformModule.forRoot()];
}

export function createPlatformRuntimeModuleImports(): DynamicModule[] {
  const { PlatformModule } = loadPlatformModule('@lark-apaas/fullstack-nestjs-core') as {
    PlatformModule: { forRoot: () => DynamicModule };
  };
  return [PlatformModule.forRoot()];
}
