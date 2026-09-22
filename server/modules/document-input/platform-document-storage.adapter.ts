import type { FileService } from '@lark-apaas/fullstack-nestjs-core';
import type { DocumentStoragePort } from './document-input.storage';
import { PlatformObjectStorageAdapter } from '../storage/platform-object-storage.adapter';

/** Compatibility facade for the existing DocumentInput contract. */
export class PlatformDocumentStorageAdapter extends PlatformObjectStorageAdapter implements DocumentStoragePort {
  constructor(fileService: FileService) { super(fileService); }
  async upload(input: Parameters<DocumentStoragePort['upload']>[0]): Promise<void> {
    if (input.fileName !== input.filePath.split('/').at(-1)) throw new Error('The platform storage filename does not match its key.');
    await this.putImmutable({ bucketId: input.bucketId, objectKey: input.filePath, buffer: input.buffer, contentType: input.mimeType ?? 'application/octet-stream' });
  }
  download(input: Parameters<DocumentStoragePort['download']>[0]): Promise<Buffer | null> {
    return this.get({ bucketId: input.bucketId, objectKey: input.filePath });
  }
  remove(input: { bucketId: string; filePath?: string; objectKey?: string }): Promise<void> {
    const objectKey = input.filePath ?? input.objectKey;
    if (!objectKey) throw new Error('A storage key is required.');
    return super.remove({ bucketId: input.bucketId, objectKey });
  }
}
