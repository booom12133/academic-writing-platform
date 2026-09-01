import { Injectable } from '@nestjs/common';

import { DocumentInputError } from './document-input.errors';
import type { DocumentStoragePort } from './document-input.storage';

@Injectable()
export class UnavailableDocumentStorageAdapter implements DocumentStoragePort {
  async getDefaultBucketId(): Promise<string> {
    throw this.error();
  }

  async upload(): Promise<void> {
    throw this.error();
  }

  async download(): Promise<Buffer | null> {
    throw this.error();
  }

  async remove(): Promise<void> {
    throw this.error();
  }

  private error(): DocumentInputError {
    return new DocumentInputError(
      'DOCUMENT_STORAGE_FAILED',
      'The platform document storage is unavailable in this runtime.',
    );
  }
}
