import { createHash } from 'node:crypto';
import { ZoteroAttachmentService } from './zotero-attachment.service';

const bytes = Buffer.from('%PDF-1.4 paper');
const md5 = createHash('md5').update(bytes).digest('hex');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const ref = { version: 1 as const, provider: 'platform-file' as const, bucketId: 'bucket', filePath: 'academic-writing/users/user/550e8400-e29b-41d4-a716-446655440000/paper.pdf', fileName: 'paper.pdf', sourceType: 'pdf' as const, mimeType: 'application/pdf', sizeBytes: bytes.length, sha256 };
const attachment = (version: number, checksum = md5, data: Record<string, unknown> = {}) => ({
  key: 'ATT1', version, itemType: 'attachment', data: { linkMode: 'imported_file', contentType: 'application/pdf', filename: 'paper.pdf', md5: checksum, ...data },
});

describe('ZoteroAttachmentService', () => {
  function build(existing: unknown = null, fileBytes = bytes) {
    const client = {
      getItem: jest.fn().mockResolvedValue(attachment(2)),
      getFile: jest.fn().mockResolvedValue({ buffer: fileBytes, contentType: 'application/pdf', etag: md5 }),
    };
    const documentInput = { upload: jest.fn().mockResolvedValue({ document: ref }), removeOwned: jest.fn().mockResolvedValue(undefined) };
    const knowledge = { importDocument: jest.fn().mockResolvedValue({ document: { id: 'doc-1' }, version: { id: 'v1' } }), createNextVersion: jest.fn().mockResolvedValue({ document: { id: 'doc-1' }, version: { id: 'v2' } }) };
    const repository = { findDocumentByExternalIdentity: jest.fn().mockResolvedValue(existing), getLatestVersion: jest.fn().mockResolvedValue({ sourceArtifactRef: { sha256 } }), updateExternalSyncState: jest.fn().mockResolvedValue(undefined), tombstoneDocument: jest.fn().mockResolvedValue(undefined), restoreDocument: jest.fn().mockResolvedValue(undefined) };
    return { service: new ZoteroAttachmentService(client as never, documentInput as never, knowledge as never, repository as never), client, documentInput, knowledge, repository };
  }

  it('skips download when attachment external state is unchanged', async () => {
    const existing = { id: 'doc-1', userId: 'user-1', lifecycleStatus: 'active', externalIdentity: 'zotero:user:42:attachment:ATT1', externalVersion: '2', externalChecksum: md5 };
    const { service, client } = build(existing);

    await expect(service.syncAttachment({ userId: 'user-1', libraryId: '42', apiKey: 'key', attachmentKey: 'ATT1', sourceRecordId: 'source-1' })).resolves.toMatchObject({ skipped: true });
    expect(client.getFile).not.toHaveBeenCalled();
  });

  it('updates state without creating a version when upstream changes but bytes are identical', async () => {
    const existing = { id: 'doc-1', userId: 'user-1', lifecycleStatus: 'active', externalIdentity: 'zotero:user:42:attachment:ATT1', externalVersion: '1', externalChecksum: 'c'.repeat(32) };
    const { service, knowledge, repository } = build(existing);

    await expect(service.syncAttachment({ userId: 'user-1', libraryId: '42', apiKey: 'key', attachmentKey: 'ATT1', sourceRecordId: 'source-1' })).resolves.toMatchObject({ stateOnly: true });
    expect(repository.updateExternalSyncState).toHaveBeenCalledWith('user-1', 'doc-1', { externalVersion: '2', externalChecksumAlgorithm: 'md5', externalChecksum: md5 });
    expect(knowledge.createNextVersion).not.toHaveBeenCalled();
  });

  it('creates a new immutable version on the same document when bytes change', async () => {
    const changedBytes = Buffer.from('%PDF-1.4 changed paper');
    const changedMd5 = createHash('md5').update(changedBytes).digest('hex');
    const existing = { id: 'doc-1', userId: 'user-1', lifecycleStatus: 'active', externalIdentity: 'zotero:user:42:attachment:ATT1', externalVersion: '1', externalChecksum: md5 };
    const built = build(existing, changedBytes);
    built.client.getItem.mockResolvedValue(attachment(2, changedMd5));
    built.client.getFile.mockResolvedValue({ buffer: changedBytes, contentType: 'application/pdf', etag: changedMd5 });
    built.repository.getLatestVersion.mockResolvedValue({ sourceArtifactRef: { sha256: 'old'.repeat(16) } });

    await built.service.syncAttachment({ userId: 'user-1', libraryId: '42', apiKey: 'key', attachmentKey: 'ATT1', sourceRecordId: 'source-1' });
    expect(built.knowledge.createNextVersion).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'doc-1', externalSyncState: expect.objectContaining({ externalVersion: '2', externalChecksum: changedMd5 }) }));
    expect(built.documentInput.removeOwned).not.toHaveBeenCalled();
  });

  it('accepts an ETag equal to the attachment MD5, including the quoted representation', async () => {
    const built = build(null);
    built.client.getFile.mockResolvedValue({ buffer: bytes, contentType: 'application/pdf', etag: `"${md5}"` });

    await expect(built.service.syncAttachment({ userId: 'user-1', libraryId: '42', apiKey: 'key', attachmentKey: 'ATT1' })).resolves.toMatchObject({ document: { id: 'doc-1' } });
  });

  it('re-fetches the item once when the item MD5 is stale and accepts the refreshed state', async () => {
    const built = build(null);
    built.client.getItem
      .mockResolvedValueOnce(attachment(1, '0'.repeat(32)))
      .mockResolvedValueOnce(attachment(2, md5));

    await built.service.syncAttachment({ userId: 'user-1', libraryId: '42', apiKey: 'key', attachmentKey: 'ATT1' });
    expect(built.client.getItem).toHaveBeenCalledTimes(2);
    expect(built.knowledge.importDocument).toHaveBeenCalledWith(expect.objectContaining({ externalSyncState: expect.objectContaining({ externalVersion: '2', externalChecksum: md5 }) }));
  });

  it('rejects a persistent ETag mismatch without advancing accepted state', async () => {
    const existing = { id: 'doc-1', userId: 'user-1', lifecycleStatus: 'active', externalIdentity: 'zotero:user:42:attachment:ATT1', externalVersion: '1', externalChecksum: '0'.repeat(32) };
    const built = build(existing);
    built.client.getFile.mockResolvedValue({ buffer: bytes, contentType: 'application/pdf', etag: 'f'.repeat(32) });
    built.client.getItem.mockResolvedValueOnce(attachment(2, '0'.repeat(32))).mockResolvedValueOnce(attachment(3, '0'.repeat(32)));

    await expect(built.service.syncAttachment({ userId: 'user-1', libraryId: '42', apiKey: 'key', attachmentKey: 'ATT1' })).rejects.toMatchObject({ code: 'ZOTERO_ATTACHMENT_INTEGRITY_FAILED' });
    expect(built.repository.updateExternalSyncState).not.toHaveBeenCalled();
    expect(built.knowledge.createNextVersion).not.toHaveBeenCalled();
    expect(built.documentInput.upload).not.toHaveBeenCalled();
  });

  it('compensates a durable C4 upload when E1 downstream persistence fails without masking the original error', async () => {
    const { service, documentInput, knowledge } = build(null);
    knowledge.importDocument.mockRejectedValueOnce(new Error('E1 transaction failed'));

    await expect(service.syncAttachment({ userId: 'user-1', libraryId: '42', apiKey: 'key', attachmentKey: 'ATT1', sourceRecordId: 'source-1' })).rejects.toThrow('E1 transaction failed');
    expect(documentInput.removeOwned).toHaveBeenCalledWith('user-1', ref);
  });

  it('keeps the original import error when compensation itself fails', async () => {
    const { service, documentInput, knowledge } = build(null);
    knowledge.importDocument.mockRejectedValueOnce(new Error('original import error'));
    documentInput.removeOwned.mockRejectedValueOnce(new Error('cleanup failed'));

    await expect(service.syncAttachment({ userId: 'user-1', libraryId: '42', apiKey: 'key', attachmentKey: 'ATT1', sourceRecordId: 'source-1' })).rejects.toThrow('original import error');
  });

  it('removes a duplicate uploaded artifact when downstream version arbitration returns idempotent', async () => {
    const existing = { id: 'doc-1', userId: 'user-1', lifecycleStatus: 'active', externalIdentity: 'zotero:user:42:attachment:ATT1', externalVersion: '1', externalChecksum: '0'.repeat(32) };
    const built = build(existing);
    built.repository.getLatestVersion.mockResolvedValueOnce({ sourceArtifactRef: { sha256: 'old'.repeat(16) } });
    built.knowledge.createNextVersion.mockResolvedValueOnce({ document: { id: 'doc-1' }, version: { id: 'v2' }, idempotent: true });

    await built.service.syncAttachment({ userId: 'user-1', libraryId: '42', apiKey: 'key', attachmentKey: 'ATT1' });

    expect(built.documentInput.removeOwned).toHaveBeenCalledWith('user-1', ref);
  });

  it('tombstones only an explicitly trashed attachment and restores the same document when active again', async () => {
    const existing = { id: 'doc-1', userId: 'user-1', lifecycleStatus: 'active', externalIdentity: 'zotero:user:42:attachment:ATT1', externalVersion: '2', externalChecksum: md5 };
    const { service, client, repository } = build(existing);
    client.getItem.mockResolvedValueOnce(attachment(3, md5, { deleted: true })).mockResolvedValueOnce(attachment(4));

    await service.syncAttachment({ userId: 'user-1', libraryId: '42', apiKey: 'key', attachmentKey: 'ATT1', sourceRecordId: 'source-1' });
    expect(repository.tombstoneDocument).toHaveBeenCalledWith('user-1', 'doc-1');
    existing.lifecycleStatus = 'tombstoned';
    await service.syncAttachment({ userId: 'user-1', libraryId: '42', apiKey: 'key', attachmentKey: 'ATT1', sourceRecordId: 'source-1' });
    expect(repository.restoreDocument).toHaveBeenCalledWith('user-1', 'doc-1');
  });
});
