import { ZoteroImportService } from './zotero-import.service';

const connection = { libraryId: '42' };
const source = { id: 'source-1', userId: 'user-1' };
const activeParent = { key: 'ITEM1', version: 2, itemType: 'journalArticle', data: { itemType: 'journalArticle', title: 'Study' } };
const child = { key: 'ATT1', version: 3, itemType: 'attachment', data: { itemType: 'attachment', parentItem: 'ITEM1', linkMode: 'imported_file', contentType: 'application/pdf', filename: 'paper.pdf', md5: 'a'.repeat(32) } };

describe('ZoteroImportService', () => {
  function build(parent = activeParent, children = [child]) {
    const credentials = { resolve: jest.fn().mockResolvedValue({ connection, apiKey: 'secret' }) };
    const client = { getItem: jest.fn().mockResolvedValue(parent), getChildren: jest.fn().mockResolvedValue(children), mapWithConcurrency: jest.fn(async (values: unknown[], worker: (value: unknown) => Promise<unknown>) => Promise.all(values.map(worker))) };
    const sources = { syncItem: jest.fn().mockResolvedValue({ sourceRecord: source, upstreamStatus: 'active' }) };
    const attachments = { syncAttachment: jest.fn().mockResolvedValue({ document: { id: 'doc-1' } }) };
    const connections = { findByUser: jest.fn().mockResolvedValue([]), disable: jest.fn() };
    return { service: new ZoteroImportService(credentials as never, client as never, sources as never, attachments as never, connections as never), credentials, client, sources, attachments };
  }

  it('resolves a direct child attachment parent and preserves SourceRecord provenance', async () => {
    const built = build(child as never, []);

    await built.service.importAttachment('user-1', 'ATT1');

    expect(built.sources.syncItem).toHaveBeenCalledWith('user-1', '42', 'secret', 'ITEM1');
    expect(built.attachments.syncAttachment).toHaveBeenCalledWith(expect.objectContaining({ attachmentKey: 'ATT1', sourceRecordId: 'source-1' }));
  });

  it('reuses the same parent resolution on repeated direct attachment imports', async () => {
    const built = build(child as never, []);
    await built.service.importAttachment('user-1', 'ATT1');
    await built.service.importAttachment('user-1', 'ATT1');

    expect(built.sources.syncItem).toHaveBeenCalledTimes(2);
    expect(built.attachments.syncAttachment).toHaveBeenCalledTimes(2);
    expect(built.attachments.syncAttachment).toHaveBeenNthCalledWith(2, expect.objectContaining({ sourceRecordId: 'source-1' }));
  });

  it('rejects a top-level attachment rather than creating an unprovenanced document', async () => {
    const topLevel = { ...child, data: { ...child.data, parentItem: undefined } };
    const built = build(topLevel as never, []);

    await expect(built.service.importAttachment('user-1', 'ATT1')).rejects.toMatchObject({ code: 'ZOTERO_ATTACHMENT_UNSUPPORTED' });
    expect(built.sources.syncItem).not.toHaveBeenCalled();
    expect(built.attachments.syncAttachment).not.toHaveBeenCalled();
  });

  it('propagates explicit parent trash to each child attachment while retaining the source', async () => {
    const trashedParent = { ...activeParent, data: { ...activeParent.data, deleted: true } };
    const built = build(trashedParent, [child, { ...child, key: 'ATT2' }]);
    built.sources.syncItem.mockResolvedValue({ sourceRecord: source, upstreamStatus: 'trashed' });

    const result = await built.service.syncItem('user-1', 'ITEM1');

    expect(result.source).toBe(source);
    expect(built.attachments.syncAttachment).toHaveBeenNthCalledWith(1, expect.objectContaining({ attachmentKey: 'ATT1', sourceRecordId: 'source-1', parentTrashed: true }));
    expect(built.attachments.syncAttachment).toHaveBeenNthCalledWith(2, expect.objectContaining({ attachmentKey: 'ATT2', parentTrashed: true }));
  });
});
