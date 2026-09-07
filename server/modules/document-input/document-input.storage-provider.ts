import type { Provider } from '@nestjs/common';
import { createRequire } from 'node:module';

import { loadRuntimeConfig } from '../../config/production-config';
import {
  resolveRuntimeDocumentStorageConfig,
  type DocumentStorageConfig,
} from './document-storage.config';
import { SelfHostedFilesystemDocumentStorageAdapter } from './filesystem-document-storage.adapter';
import { PlatformDocumentStorageAdapter } from './platform-document-storage.adapter';
import { DOCUMENT_STORAGE } from './document-input.storage';

const loadPlatformModule = createRequire(__filename);

export function createDocumentStorageProvider(
  config: DocumentStorageConfig = resolveRuntimeDocumentStorageConfig(loadRuntimeConfig()),
): Provider {
  if (config.driver === 'filesystem') {
    return {
      provide: DOCUMENT_STORAGE,
      inject: [],
      useFactory: () => new SelfHostedFilesystemDocumentStorageAdapter(config.root as string),
    };
  }

  const { FileService } = loadPlatformModule('@lark-apaas/fullstack-nestjs-core') as {
    FileService: new (...args: never[]) => unknown;
  };
  return {
    provide: DOCUMENT_STORAGE,
    inject: [FileService],
    useFactory: (fileService: unknown) => new PlatformDocumentStorageAdapter(
      fileService as ConstructorParameters<typeof PlatformDocumentStorageAdapter>[0],
    ),
  };
}
