import type { DocumentStoragePort } from './document-input.storage';
import {
  SELF_HOSTED_FILESYSTEM_BUCKET_ID,
  SelfHostedFilesystemObjectStorageAdapter,
} from '../storage/filesystem-object-storage.adapter';

export { SELF_HOSTED_FILESYSTEM_BUCKET_ID };

/** Compatibility facade for the existing DocumentInput contract. */
export class SelfHostedFilesystemDocumentStorageAdapter
  extends SelfHostedFilesystemObjectStorageAdapter
  implements DocumentStoragePort {
  async upload(input: Parameters<DocumentStoragePort['upload']>[0]): Promise<void> {
    if (input.fileName !== input.filePath.split('/').at(-1)) throw new Error('The filesystem storage filename does not match its key.');
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
