import { link, mkdir, open, readFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import type { DocumentInputProvider } from '@shared/document-input.interface';
import type { ObjectStoragePort } from './object-storage.port';
import { assertCanonicalObjectKey } from './object-storage-key';

export const SELF_HOSTED_FILESYSTEM_BUCKET_ID = 'self-hosted-filesystem';

export class SelfHostedFilesystemObjectStorageAdapter implements ObjectStoragePort {
  private readonly root: string;

  constructor(storageRoot: string) {
    if (!storageRoot || !isAbsolute(storageRoot)) throw new Error('Self-hosted document storage root must be an absolute path.');
    this.root = resolve(storageRoot);
  }

  getProvider(): DocumentInputProvider { return 'self-hosted-filesystem'; }
  async getDefaultBucketId(): Promise<string> { return SELF_HOSTED_FILESYSTEM_BUCKET_ID; }

  async putImmutable(input: Parameters<ObjectStoragePort['putImmutable']>[0]): Promise<void> {
    const target = this.resolveStoragePath(input.bucketId, input.objectKey);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    const temporaryTarget = `${target}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temporaryTarget, 'wx', 0o600);
      try { await handle.writeFile(input.buffer); await handle.sync(); } finally { await handle.close(); }
      await link(temporaryTarget, target);
    } finally {
      await unlink(temporaryTarget).catch(() => undefined);
    }
  }

  async get(input: Parameters<ObjectStoragePort['get']>[0]): Promise<Buffer | null> {
    const target = this.resolveStoragePath(input.bucketId, input.objectKey);
    try { return await readFile(target); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async remove(input: Parameters<ObjectStoragePort['remove']>[0]): Promise<void> {
    const target = this.resolveStoragePath(input.bucketId, input.objectKey);
    try { await unlink(target); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  private resolveStoragePath(bucketId: string, objectKey: string): string {
    if (bucketId !== SELF_HOSTED_FILESYSTEM_BUCKET_ID) throw new Error('The filesystem storage bucket is invalid.');
    assertCanonicalObjectKey(objectKey);
    const target = resolve(this.root, ...objectKey.split('/'));
    const containment = relative(this.root, target);
    if (!containment || containment.startsWith('..') || isAbsolute(containment)) throw new Error('The object storage key escapes the configured root.');
    return target;
  }
}
