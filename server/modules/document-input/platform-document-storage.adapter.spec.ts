import { FileService } from '@lark-apaas/fullstack-nestjs-core';

import { PlatformDocumentStorageAdapter } from './platform-document-storage.adapter';

describe('PlatformDocumentStorageAdapter', () => {
  it('uses the platform default bucket and uploads Buffer content', async () => {
    const bucket = {
      upload: jest.fn().mockResolvedValue({}),
      download: jest.fn(),
      remove: jest.fn(),
    };
    const fileService = {
      getDefaultBucket: jest.fn().mockResolvedValue('default-bucket'),
      from: jest.fn().mockReturnValue(bucket),
    } as unknown as FileService;
    const adapter = new PlatformDocumentStorageAdapter(fileService);
    const buffer = Buffer.from('synthetic document');

    await expect(adapter.getDefaultBucketId()).resolves.toBe('default-bucket');
    await adapter.upload({
      bucketId: 'default-bucket',
      filePath: 'academic-writing/users/a/path.txt',
      fileName: 'path.txt',
      buffer,
      mimeType: 'text/plain',
    });

    expect(fileService.getDefaultBucket).toHaveBeenCalledTimes(1);
    expect(fileService.from).toHaveBeenCalledWith('default-bucket');
    expect(bucket.upload).toHaveBeenCalledWith(buffer, {
      filePath: 'academic-writing/users/a/path.txt',
      fileName: 'path.txt',
      contentType: 'text/plain',
      upsert: false,
    });
  });

  it('downloads Blob bytes and returns null when metadata is absent', async () => {
    const bucket = {
      getFileMetadata: jest.fn().mockResolvedValue({ size: 18 }),
      download: jest.fn().mockResolvedValue({ content: new Blob([Buffer.from('synthetic document')]) }),
      remove: jest.fn().mockResolvedValue([]),
    };
    const fileService = {
      from: jest.fn().mockReturnValue(bucket),
    } as unknown as FileService;
    const adapter = new PlatformDocumentStorageAdapter(fileService);

    await expect(adapter.download({ bucketId: 'default-bucket', filePath: 'document.txt' }))
      .resolves.toEqual(Buffer.from('synthetic document'));
    bucket.getFileMetadata.mockResolvedValueOnce(null);
    await expect(adapter.download({ bucketId: 'default-bucket', filePath: 'missing.txt' })).resolves.toBeNull();
  });

  it('removes a persisted object through the same bucket scope', async () => {
    const bucket = {
      remove: jest.fn().mockResolvedValue([]),
    };
    const fileService = { from: jest.fn().mockReturnValue(bucket) } as unknown as FileService;
    const adapter = new PlatformDocumentStorageAdapter(fileService);

    await adapter.remove({ bucketId: 'default-bucket', filePath: 'document.txt' });

    expect(bucket.remove).toHaveBeenCalledWith(['document.txt']);
  });
});
