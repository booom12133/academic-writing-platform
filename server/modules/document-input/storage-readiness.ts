import {
  access as fsAccess,
  constants as fsConstants,
  readdir as fsReaddir,
  stat as fsStat,
  statfs as fsStatfs,
  unlink as fsUnlink,
} from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';

export type StorageReadinessReasonCode =
  | 'storage_root_invalid'
  | 'storage_root_missing'
  | 'storage_root_unreadable'
  | 'storage_permissions_open'
  | 'storage_capacity_low'
  | 'storage_capacity_unavailable';

export interface StorageReadinessResult {
  ready: boolean;
  reasonCode?: StorageReadinessReasonCode;
}

interface StorageStat {
  mode?: number;
}

interface StorageStatFs {
  bavail: number | bigint;
  bsize: number | bigint;
}

interface StorageReadinessFs {
  stat: (path: string) => Promise<StorageStat>;
  access: (path: string, mode: number) => Promise<void>;
  statfs: (path: string) => Promise<StorageStatFs>;
}

export interface StorageReadinessOptions extends Partial<StorageReadinessFs> {
  minimumFreeBytes?: number;
}

const DEFAULT_MINIMUM_FREE_BYTES = 100 * 1024 * 1024;

export async function checkFilesystemStorageReadiness(
  root: string,
  options: StorageReadinessOptions = {},
): Promise<StorageReadinessResult> {
  if (!root || !isAbsolute(root)) return { ready: false, reasonCode: 'storage_root_invalid' };

  const stat = options.stat ?? ((path: string) => fsStat(path));
  const access = options.access ?? ((path: string, mode: number) => fsAccess(path, mode));
  const statfs = options.statfs ?? ((path: string) => fsStatfs(path));
  let rootStat: StorageStat;
  try {
    rootStat = await stat(root);
  } catch (_error) {
    return { ready: false, reasonCode: 'storage_root_missing' };
  }

  try {
    await access(root, fsConstants.R_OK | fsConstants.W_OK);
  } catch (_error) {
    return { ready: false, reasonCode: 'storage_root_unreadable' };
  }
  if (typeof rootStat.mode === 'number' && (rootStat.mode & 0o002) !== 0) {
    return { ready: false, reasonCode: 'storage_permissions_open' };
  }

  let filesystem: StorageStatFs;
  try {
    filesystem = await statfs(root);
  } catch (_error) {
    return { ready: false, reasonCode: 'storage_capacity_unavailable' };
  }
  const freeBytes = Number(filesystem.bavail) * Number(filesystem.bsize);
  if (!Number.isFinite(freeBytes) || freeBytes < (options.minimumFreeBytes ?? DEFAULT_MINIMUM_FREE_BYTES)) {
    return { ready: false, reasonCode: 'storage_capacity_low' };
  }
  return { ready: true };
}

export interface StorageCleanupEntry {
  name: string;
  isDirectory(): boolean;
  mtimeMs?: number;
}

export interface StorageCleanupOptions {
  readdir?: (path: string, options: { withFileTypes: true }) => Promise<readonly StorageCleanupEntry[]>;
  stat?: (path: string) => Promise<{ mtimeMs: number }>;
  unlink?: (path: string) => Promise<void>;
  now?: () => number;
  staleAfterMs?: number;
  maxFiles?: number;
}

export interface StorageCleanupResult {
  removed: number;
  scanned: number;
}

const TEMPORARY_FILE_PATTERN = /\.(?:tmp|partial)$/iu;

export async function cleanupTemporaryStorageFiles(
  root: string,
  options: StorageCleanupOptions = {},
): Promise<StorageCleanupResult> {
  const readdir = options.readdir ?? ((path: string, readOptions: { withFileTypes: true }) => fsReaddir(path, readOptions) as unknown as Promise<StorageCleanupEntry[]>);
  const stat = options.stat ?? ((path: string) => fsStat(path));
  const unlink = options.unlink ?? ((path: string) => fsUnlink(path));
  const now = options.now ?? (() => Date.now());
  const staleAfterMs = options.staleAfterMs ?? 24 * 60 * 60 * 1000;
  const maxFiles = options.maxFiles ?? 1_000;
  const result = { removed: 0, scanned: 0 };

  async function visit(directory: string): Promise<void> {
    if (result.scanned >= maxFiles) return;
    let entries: readonly StorageCleanupEntry[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (_error) {
      return;
    }
    for (const entry of entries) {
      if (result.scanned >= maxFiles) return;
      result.scanned += 1;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
        continue;
      }
      if (!TEMPORARY_FILE_PATTERN.test(entry.name)) continue;
      let modifiedAt = entry.mtimeMs;
      if (modifiedAt === undefined) {
        try {
          modifiedAt = (await stat(path)).mtimeMs;
        } catch (_error) {
          continue;
        }
      }
      if (now() - modifiedAt < staleAfterMs) continue;
      try {
        await unlink(path);
        result.removed += 1;
      } catch (_error) {
        // Cleanup is best effort and must not affect request handling.
      }
    }
  }

  await visit(root);
  return result;
}
