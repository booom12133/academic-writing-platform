import { createHash } from 'node:crypto';
import { ZoteroAttachmentService } from '../../server/modules/zotero/zotero-attachment.service';

describe('E4 fake Zotero-to-E1 pipeline', () => {
  it('retains the C4 artifact after E1 commit and does not invoke E2', async () => {
    const bytes = Buffer.from('%PDF-1.4 accepted');
    const checksum = createHash('md5').update(bytes).digest('hex');
    const indexing = { index: jest.fn() };
    const client = {
      getItem: jest.fn().mockResolvedValue({ key: 'ATT1', version: 1, itemType: 'attachment', data: { linkMode: 'imported_file', contentType: 'application/pdf', filename: 'paper.pdf', md5: checksum } }),
      getFile: jest.fn().mockResolvedValue({ buffer: bytes, contentType: 'application/pdf', etag: checksum }),
    };
    const documentRef = { version: 1 as const, provider: 'platform-file' as const, bucketId: 'bucket', filePath: 'academic-writing/users/scope/id/paper.pdf', fileName: 'paper.pdf', sourceType: 'pdf' as const, mimeType: 'application/pdf', sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    const documentInput = { upload: jest.fn().mockResolvedValue({ document: documentRef }), removeOwned: jest.fn() };
    const knowledge = { importDocument: jest.fn().mockResolvedValue({ document: { id: 'doc-1' }, version: { id: 'version-1' } }), createNextVersion: jest.fn() };
    const repository = { findDocumentByExternalIdentity: jest.fn().mockResolvedValue(null), getLatestVersion: jest.fn(), updateExternalSyncState: jest.fn(), tombstoneDocument: jest.fn(), restoreDocument: jest.fn() };
    const service = new ZoteroAttachmentService(client as never, documentInput as never, knowledge as never, repository as never);

    await expect(service.syncAttachment({ userId: 'user-1', libraryId: '42', apiKey: 'synthetic', attachmentKey: 'ATT1', sourceRecordId: 'source-1' })).resolves.toMatchObject({ document: { id: 'doc-1' } });
    expect(documentInput.removeOwned).not.toHaveBeenCalled();
    expect(indexing.index).not.toHaveBeenCalled();
  });
});
