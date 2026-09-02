import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import { SelfHostedFilesystemDocumentStorageAdapter } from './filesystem-document-storage.adapter';

const userScope = createHash('sha256').update('user-1').digest('hex');
const filePath = `academic-writing/users/${userScope}/550e8400-e29b-41d4-a716-446655440000/paper.txt`;
const fileName = 'paper.txt';
const bucketId = 'self-hosted-filesystem';

describe('SelfHostedFilesystemDocumentStorageAdapter', () => {
  let root: string;
  let adapter: SelfHostedFilesystemDocumentStorageAdapter;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'academic-writing-c4-'));
    adapter = new SelfHostedFilesystemDocumentStorageAdapter(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('writes and reads exact Buffer bytes under the configured root', async () => {
    const bytes = Buffer.from([0, 1, 2, 255, 10]);

    await adapter.upload({ bucketId, filePath, fileName, buffer: bytes, mimeType: 'text/plain' });

    await expect(readFile(join(root, ...filePath.split('/')))).resolves.toEqual(bytes);
    await expect(adapter.download({ bucketId, filePath })).resolves.toEqual(bytes);
  });

  it('removes only the exact compensated object', async () => {
    const siblingPath = filePath.replace('paper.txt', 'sibling.txt');
    const bytes = Buffer.from('synthetic');

    await adapter.upload({ bucketId, filePath, fileName, buffer: bytes });
    await adapter.upload({ bucketId, filePath: siblingPath, fileName: 'sibling.txt', buffer: bytes });
    await adapter.remove({ bucketId, filePath });

    await expect(stat(join(root, ...filePath.split('/')))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(join(root, ...siblingPath.split('/')))).resolves.toEqual(bytes);
  });

  it.each([
    ['traversal', '../../outside.txt'],
    ['forged absolute key', '/tmp/outside.txt'],
    ['raw backslash', `academic-writing\\users\\${userScope}\\id\\paper.txt`],
    ['encoded slash', `academic-writing/users/${userScope}/550e8400-e29b-41d4-a716-446655440000/paper%2Fother.txt`],
  ])('rejects a storage key that escapes the generated-key/root boundary: %s', async (_name, forgedPath) => {
    await expect(adapter.upload({
      bucketId,
      filePath: forgedPath,
      fileName: 'paper.txt',
      buffer: Buffer.from('must not persist'),
    })).rejects.toThrow();
    await expect(adapter.download({ bucketId, filePath: forgedPath })).rejects.toThrow();
  });

  it('identifies the actual self-hosted provider and exposes no public URL operation', async () => {
    expect(adapter.getProvider()).toBe('self-hosted-filesystem');
    await expect(adapter.getDefaultBucketId()).resolves.toBe(bucketId);
    expect('createSignedUrl' in adapter).toBe(false);
  });
});
