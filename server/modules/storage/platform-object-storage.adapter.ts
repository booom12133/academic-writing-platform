import type { FileService } from '@lark-apaas/fullstack-nestjs-core';
import type { DocumentInputProvider } from '@shared/document-input.interface';
import type { ObjectStoragePort } from './object-storage.port';
import { assertCanonicalObjectKey } from './object-storage-key';

export class PlatformObjectStorageAdapter implements ObjectStoragePort {
  constructor(private readonly fileService: FileService) {}
  getProvider(): DocumentInputProvider { return 'platform-file'; }
  getDefaultBucketId(): Promise<string> { return this.fileService.getDefaultBucket(); }
  async putImmutable(input: Parameters<ObjectStoragePort['putImmutable']>[0]): Promise<void> {
    assertCanonicalObjectKey(input.objectKey);
    const fileName = input.objectKey.split('/').at(-1)!;
    await this.fileService.from(input.bucketId).upload(input.buffer, { filePath: input.objectKey, fileName, contentType: input.contentType, upsert: false });
  }
  async get(input: Parameters<ObjectStoragePort['get']>[0]): Promise<Buffer | null> {
    assertCanonicalObjectKey(input.objectKey);
    const scoped = this.fileService.from(input.bucketId);
    if (!await scoped.getFileMetadata(input.objectKey)) return null;
    const result = await scoped.download(input.objectKey);
    return Buffer.from(await result.content.arrayBuffer());
  }
  async remove(input: Parameters<ObjectStoragePort['remove']>[0]): Promise<void> {
    assertCanonicalObjectKey(input.objectKey);
    await this.fileService.from(input.bucketId).remove([input.objectKey]);
  }
}
