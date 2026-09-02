import { resolveDocumentStorageConfig } from './document-storage.config';
import { SelfHostedFilesystemDocumentStorageAdapter } from './filesystem-document-storage.adapter';
import { createDocumentStorageProvider } from './document-input.storage-provider';

describe('DocumentInputModule storage provider', () => {
  it('wires filesystem mode without a platform FileService provider', () => {
    const provider = createDocumentStorageProvider(resolveDocumentStorageConfig({
      DOCUMENT_STORAGE_DRIVER: 'filesystem',
      DOCUMENT_STORAGE_ROOT: '/var/lib/academic-writing-platform/documents',
    })) as { inject?: unknown[]; useFactory: (...args: unknown[]) => unknown };

    expect(provider.inject).toEqual([]);
    expect(provider.useFactory).toEqual(expect.any(Function));
    expect((provider.useFactory as () => unknown)()).toBeInstanceOf(SelfHostedFilesystemDocumentStorageAdapter);
  });

  it('keeps platform mode wired through the platform FileService token', () => {
    const provider = createDocumentStorageProvider({ driver: 'platform' }) as {
      inject?: unknown[];
      useFactory: (...args: unknown[]) => unknown;
    };

    expect(provider.inject).toHaveLength(1);
    expect(provider.useFactory).toEqual(expect.any(Function));
  });
});
