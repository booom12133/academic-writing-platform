import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SelfHostedFilesystemObjectStorageAdapter } from './filesystem-object-storage.adapter';

const bucketId = 'self-hosted-filesystem';
const userScope = 'a'.repeat(64);
const projectId = '550e8400-e29b-41d4-a716-446655440000';
const exportId = '550e8400-e29b-41d4-a716-446655440001';
const objectKey = `academic-writing/users/${userScope}/exports/${projectId}/${exportId}/paper.docx`;

describe('SelfHostedFilesystemObjectStorageAdapter', () => {
  let root: string;
  let adapter: SelfHostedFilesystemObjectStorageAdapter;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'p5-object-storage-'));
    adapter = new SelfHostedFilesystemObjectStorageAdapter(root);
  });

  afterEach(async () => rm(root, { recursive: true, force: true }));

  it('writes export bytes once and reads the exact object', async () => {
    const buffer = Buffer.from('immutable export');
    await adapter.putImmutable({ bucketId, objectKey, buffer, contentType: 'application/octet-stream' });
    await expect(adapter.get({ bucketId, objectKey })).resolves.toEqual(buffer);
    await expect(readFile(join(root, ...objectKey.split('/')))).resolves.toEqual(buffer);
    await expect(adapter.putImmutable({ bucketId, objectKey, buffer, contentType: 'application/octet-stream' })).rejects.toThrow();
  });

  it.each([
    '../../escape.docx',
    `/absolute/${exportId}.docx`,
    `academic-writing\\users\\${userScope}\\exports\\${projectId}\\${exportId}\\paper.docx`,
    `academic-writing/users/${userScope}/exports/${projectId}/${exportId}/paper%2Fescape.docx`,
    `academic-writing/users/${userScope}/exports/${projectId}/not-a-uuid/paper.docx`,
  ])('rejects non-canonical object key %s', async (forgedKey) => {
    await expect(adapter.putImmutable({ bucketId, objectKey: forgedKey, buffer: Buffer.from('x'), contentType: 'application/octet-stream' })).rejects.toThrow();
    await expect(adapter.get({ bucketId, objectKey: forgedKey })).rejects.toThrow();
  });
});
