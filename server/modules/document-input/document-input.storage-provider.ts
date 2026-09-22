import type { Provider } from '@nestjs/common';
import { createRequire } from 'node:module';

import {
  type DocumentStorageConfig,
} from './document-storage.config';
import { SelfHostedFilesystemDocumentStorageAdapter } from './filesystem-document-storage.adapter';
import { PlatformDocumentStorageAdapter } from './platform-document-storage.adapter';
import { DOCUMENT_STORAGE } from './document-input.storage';
import type { DocumentStoragePort } from './document-input.storage';
import { OBJECT_STORAGE, type ObjectStoragePort } from '../storage/object-storage.port';

const loadPlatformModule = createRequire(__filename);

export function createDocumentStorageProvider(
  config?: DocumentStorageConfig,
): Provider {
  if (!config) {
    return {
      provide: DOCUMENT_STORAGE,
      inject: [OBJECT_STORAGE],
      useFactory: (storage: ObjectStoragePort): DocumentStoragePort => ({
        getProvider: () => storage.getProvider(),
        getDefaultBucketId: () => storage.getDefaultBucketId(),
        upload: async (input) => {
          if (input.fileName !== input.filePath.split('/').at(-1)) throw new Error('The document storage filename does not match its key.');
          await storage.putImmutable({ bucketId: input.bucketId, objectKey: input.filePath, buffer: input.buffer, contentType: input.mimeType ?? 'application/octet-stream' });
        },
        download: (input) => storage.get({ bucketId: input.bucketId, objectKey: input.filePath }),
        remove: (input) => storage.remove({ bucketId: input.bucketId, objectKey: input.filePath }),
      }),
    };
  }
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
