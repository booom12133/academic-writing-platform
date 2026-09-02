import type { DocumentInputProvider } from '@shared/document-input.interface';

export const DOCUMENT_STORAGE = Symbol('DOCUMENT_STORAGE');

export interface UploadedDocument {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
}

export interface DocumentStoragePort {
  getProvider(): DocumentInputProvider;
  getDefaultBucketId(): Promise<string>;
  upload(input: {
    bucketId: string;
    filePath: string;
    fileName: string;
    buffer: Buffer;
    mimeType?: string;
  }): Promise<void>;
  download(input: { bucketId: string; filePath: string }): Promise<Buffer | null>;
  remove(input: { bucketId: string; filePath: string }): Promise<void>;
}
