import { Global, Module, type Provider } from '@nestjs/common';
import { createRequire } from 'node:module';

import { loadRuntimeConfig } from '../../config/production-config';
import { resolveRuntimeDocumentStorageConfig } from '../document-input/document-storage.config';
import { SelfHostedFilesystemObjectStorageAdapter } from './filesystem-object-storage.adapter';
import { OBJECT_STORAGE } from './object-storage.port';
import { PlatformObjectStorageAdapter } from './platform-object-storage.adapter';

const loadPlatformModule = createRequire(__filename);

export function createObjectStorageProvider(): Provider {
  const config = resolveRuntimeDocumentStorageConfig(loadRuntimeConfig());
  if (config.driver === 'filesystem') {
    return { provide: OBJECT_STORAGE, inject: [], useFactory: () => new SelfHostedFilesystemObjectStorageAdapter(config.root as string) };
  }
  const { FileService } = loadPlatformModule('@lark-apaas/fullstack-nestjs-core') as { FileService: new (...args: never[]) => unknown };
  return { provide: OBJECT_STORAGE, inject: [FileService], useFactory: (fileService: unknown) => new PlatformObjectStorageAdapter(fileService as ConstructorParameters<typeof PlatformObjectStorageAdapter>[0]) };
}

@Global()
@Module({ providers: [createObjectStorageProvider()], exports: [OBJECT_STORAGE] })
export class StorageModule {}
