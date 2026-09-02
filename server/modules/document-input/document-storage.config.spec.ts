import { resolve } from 'node:path';

import {
  createPlatformModuleImports,
  isFilesystemStorage,
  resolveDocumentStorageConfig,
  shouldLoadPlatformModule,
} from './document-storage.config';

describe('resolveDocumentStorageConfig', () => {
  it('accepts filesystem mode with an absolute root and does not require platform credentials', () => {
    expect(resolveDocumentStorageConfig({
      DOCUMENT_STORAGE_DRIVER: 'filesystem',
      DOCUMENT_STORAGE_ROOT: '/var/lib/academic-writing-platform/documents',
    })).toEqual({
      driver: 'filesystem',
      root: resolve('/var/lib/academic-writing-platform/documents'),
    });
  });

  it.each([
    ['missing root', { DOCUMENT_STORAGE_DRIVER: 'filesystem' }],
    ['relative root', { DOCUMENT_STORAGE_DRIVER: 'filesystem', DOCUMENT_STORAGE_ROOT: './documents' }],
    ['public web root', { DOCUMENT_STORAGE_DRIVER: 'filesystem', DOCUMENT_STORAGE_ROOT: '/www/wwwroot/app/public/documents' }],
    ['unknown driver', { DOCUMENT_STORAGE_DRIVER: 's3', DOCUMENT_STORAGE_ROOT: '/var/lib/documents' }],
  ])('rejects invalid filesystem configuration: %s', (_name, env) => {
    expect(() => resolveDocumentStorageConfig(env)).toThrow();
  });

  it('keeps platform mode available without a filesystem root', () => {
    expect(resolveDocumentStorageConfig({ DOCUMENT_STORAGE_DRIVER: 'platform' })).toEqual({
      driver: 'platform',
    });
  });

  it('selects filesystem wiring without requiring a platform domain', () => {
    expect(isFilesystemStorage({
      DOCUMENT_STORAGE_DRIVER: 'filesystem',
      DOCUMENT_STORAGE_ROOT: '/var/lib/academic-writing-platform/documents',
      NODE_ENV: 'production',
    })).toBe(true);
    expect(shouldLoadPlatformModule({
      driver: 'filesystem',
      root: '/var/lib/academic-writing-platform/documents',
    })).toBe(false);
    expect(createPlatformModuleImports({
      driver: 'filesystem',
      root: '/var/lib/academic-writing-platform/documents',
    })).toEqual([]);
  });
});
