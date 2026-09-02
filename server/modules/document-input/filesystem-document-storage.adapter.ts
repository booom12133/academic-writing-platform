import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import type { DocumentInputProvider } from '@shared/document-input.interface';
import type { DocumentStoragePort } from './document-input.storage';

export const SELF_HOSTED_FILESYSTEM_BUCKET_ID = 'self-hosted-filesystem';

const GENERATED_PATH_PATTERN = /^academic-writing\/users\/[a-f0-9]{64}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/([^/\\\u0000-\u001f\u007f]+)$/;
const ENCODED_PATH_SEPARATOR_PATTERN = /%(?:2f|5c)/iu;

export class SelfHostedFilesystemDocumentStorageAdapter implements DocumentStoragePort {
  private readonly root: string;

  constructor(storageRoot: string) {
    if (!storageRoot || !isAbsolute(storageRoot)) {
      throw new Error('Self-hosted document storage root must be an absolute path.');
    }
    this.root = resolve(storageRoot);
  }

  getProvider(): DocumentInputProvider {
    return 'self-hosted-filesystem';
  }

  async getDefaultBucketId(): Promise<string> {
    return SELF_HOSTED_FILESYSTEM_BUCKET_ID;
  }

  async upload(input: Parameters<DocumentStoragePort['upload']>[0]): Promise<void> {
    const target = this.resolveStoragePath(input.bucketId, input.filePath, input.fileName);
    await mkdir(dirname(target), { recursive: true });

    const handle = await open(target, 'wx');
    try {
      await handle.writeFile(input.buffer);
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  async download(input: Parameters<DocumentStoragePort['download']>[0]): Promise<Buffer | null> {
    const target = this.resolveStoragePath(input.bucketId, input.filePath);
    try {
      return await readFile(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async remove(input: Parameters<DocumentStoragePort['remove']>[0]): Promise<void> {
    const target = this.resolveStoragePath(input.bucketId, input.filePath);
    try {
      await unlink(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  private resolveStoragePath(bucketId: string, filePath: string, fileName?: string): string {
    if (bucketId !== SELF_HOSTED_FILESYSTEM_BUCKET_ID) {
      throw new Error('The filesystem storage bucket is invalid.');
    }
    if (typeof filePath !== 'string' || ENCODED_PATH_SEPARATOR_PATTERN.test(filePath)) {
      throw new Error('The filesystem storage key is invalid.');
    }

    const match = filePath.match(GENERATED_PATH_PATTERN);
    if (!match || filePath.includes('..') || filePath !== filePath.replaceAll('\\', '/')) {
      throw new Error('The filesystem storage key is not a canonical generated path.');
    }
    if (fileName !== undefined && fileName !== match[1]) {
      throw new Error('The filesystem storage filename does not match its key.');
    }

    const target = resolve(this.root, ...filePath.split('/'));
    const containment = relative(this.root, target);
    if (!containment || containment.startsWith('..') || isAbsolute(containment)) {
      throw new Error('The filesystem storage key escapes the configured root.');
    }
    return target;
  }
}
