import type { DocumentInputProvider } from '@shared/document-input.interface';

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface ObjectStoragePort {
  getProvider(): DocumentInputProvider;
  getDefaultBucketId(): Promise<string>;
  putImmutable(input: {
    bucketId: string;
    objectKey: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<void>;
  get(input: { bucketId: string; objectKey: string }): Promise<Buffer | null>;
  remove(input: { bucketId: string; objectKey: string }): Promise<void>;
}
