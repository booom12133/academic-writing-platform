import type { FileService } from '@lark-apaas/fullstack-nestjs-core';

import type { DocumentInputProvider } from '@shared/document-input.interface';
import type { DocumentStoragePort } from './document-input.storage';

export class PlatformDocumentStorageAdapter implements DocumentStoragePort {
  constructor(private readonly fileService: FileService) {}

  getProvider(): DocumentInputProvider {
    return 'platform-file';
  }

  getDefaultBucketId(): Promise<string> {
    return this.fileService.getDefaultBucket();
  }

  async upload(input: Parameters<DocumentStoragePort['upload']>[0]): Promise<void> {
    await this.fileService.from(input.bucketId).upload(input.buffer, {
      filePath: input.filePath,
      fileName: input.fileName,
      contentType: input.mimeType,
      upsert: false,
    });
  }

  async download(input: Parameters<DocumentStoragePort['download']>[0]): Promise<Buffer | null> {
    const scoped = this.fileService.from(input.bucketId);
    const metadata = await scoped.getFileMetadata(input.filePath);
    if (!metadata) return null;

    const result = await scoped.download(input.filePath);
    return Buffer.from(await result.content.arrayBuffer());
  }

  async remove(input: Parameters<DocumentStoragePort['remove']>[0]): Promise<void> {
    await this.fileService.from(input.bucketId).remove([input.filePath]);
  }
}
