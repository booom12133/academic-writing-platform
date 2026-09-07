import {
  checkFilesystemStorageReadiness,
  cleanupTemporaryStorageFiles,
} from './storage-readiness';
import { join } from 'node:path';

describe('filesystem storage readiness', () => {
  it('accepts an accessible root with sufficient capacity', async () => {
    await expect(checkFilesystemStorageReadiness('/var/lib/documents', {
      stat: jest.fn().mockResolvedValue({ mode: 0o700 }),
      access: jest.fn().mockResolvedValue(undefined),
      statfs: jest.fn().mockResolvedValue({ bavail: 100, bsize: 1024 * 1024 }),
    })).resolves.toEqual({ ready: true });
  });

  it.each([
    ['storage_root_unreadable', { access: jest.fn().mockRejectedValue(new Error('secret')) }],
    ['storage_root_missing', { stat: jest.fn().mockRejectedValue(new Error('secret')) }],
  ])('returns a stable reason for %s', async (reasonCode, overrides) => {
    const injected = overrides as {
      stat?: jest.Mock;
      access?: jest.Mock;
    };
    await expect(checkFilesystemStorageReadiness('/var/lib/documents', {
      stat: injected.stat ?? jest.fn().mockResolvedValue({ mode: 0o700 }),
      access: injected.access ?? jest.fn().mockResolvedValue(undefined),
      statfs: jest.fn().mockResolvedValue({ bavail: 100, bsize: 1024 * 1024 }),
    })).resolves.toEqual({ ready: false, reasonCode });
  });

  it('does not report a writable root as ready when free capacity is below the bound', async () => {
    await expect(checkFilesystemStorageReadiness('/var/lib/documents', {
      stat: jest.fn().mockResolvedValue({ mode: 0o700 }),
      access: jest.fn().mockResolvedValue(undefined),
      statfs: jest.fn().mockResolvedValue({ bavail: 1, bsize: 1024 }),
      minimumFreeBytes: 4096,
    })).resolves.toEqual({ ready: false, reasonCode: 'storage_capacity_low' });
  });

  it.each([0o720, 0o704, 0o670])('rejects group/world-accessible roots: %o', async (mode) => {
    await expect(checkFilesystemStorageReadiness('/var/lib/documents', {
      stat: jest.fn().mockResolvedValue({ mode }),
      access: jest.fn().mockResolvedValue(undefined),
      statfs: jest.fn().mockResolvedValue({ bavail: 100, bsize: 1024 * 1024 }),
    })).resolves.toEqual({ ready: false, reasonCode: 'storage_permissions_open' });
  });
});

describe('temporary storage cleanup', () => {
  it('deletes only stale temporary files and stops at the configured bound', async () => {
    const removeFile = jest.fn().mockResolvedValue(undefined);
    const list = jest.fn().mockResolvedValue([
      { name: 'one.tmp', isDirectory: () => false, mtimeMs: 0 },
      { name: 'fresh.tmp', isDirectory: () => false, mtimeMs: Date.now() },
      { name: 'not-temporary.txt', isDirectory: () => false, mtimeMs: 0 },
    ]);

    await expect(cleanupTemporaryStorageFiles('/var/lib/documents', {
      readdir: list,
      unlink: removeFile,
      now: () => 10_000,
      staleAfterMs: 5_000,
      maxFiles: 1,
    })).resolves.toEqual({ removed: 1, scanned: 1 });
    expect(removeFile).toHaveBeenCalledWith(join('/var/lib/documents', 'one.tmp'));
  });
});
