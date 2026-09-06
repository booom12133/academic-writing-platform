import { ZoteroSourceService } from './zotero-source.service';

const item = (version: number) => ({
  key: 'ITEM1', version, itemType: 'journalArticle', data: { title: `Title ${version}`, publicationTitle: 'Journal' },
});

describe('ZoteroSourceService', () => {
  it('creates one source and refreshes it only when the parent version changes', async () => {
    const client = { getItem: jest.fn().mockResolvedValueOnce(item(1)).mockResolvedValueOnce(item(1)).mockResolvedValueOnce(item(2)) };
    const repository = {
      findSourceRecordByExternalIdentity: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'source-1', userId: 'platform-user', externalProvenance: [{ externalRecordId: 'user:42:item:ITEM1', externalVersion: '1' }] }).mockResolvedValueOnce({ id: 'source-1', userId: 'platform-user', externalProvenance: [{ externalRecordId: 'user:42:item:ITEM1', externalVersion: '1' }] }),
      createSourceRecord: jest.fn().mockResolvedValue({ id: 'source-1' }),
      refreshSourceRecord: jest.fn().mockResolvedValue({ id: 'source-1' }),
    };
    const service = new ZoteroSourceService(client as never, repository as never);

    await service.syncItem('platform-user', '42', 'key', 'ITEM1');
    await service.syncItem('platform-user', '42', 'key', 'ITEM1');
    await service.syncItem('platform-user', '42', 'key', 'ITEM1');

    expect(client.getItem).toHaveBeenNthCalledWith(1, '42', 'key', 'ITEM1', { includeTrashed: true });
    expect(repository.createSourceRecord).toHaveBeenCalledTimes(1);
    expect(repository.refreshSourceRecord).toHaveBeenCalledTimes(1);
  });

  it('does not treat an ordinary item 404 as a tombstone operation', async () => {
    const client = { getItem: jest.fn().mockRejectedValue({ code: 'ZOTERO_ITEM_NOT_FOUND' }) };
    const repository = { findSourceRecordByExternalIdentity: jest.fn(), createSourceRecord: jest.fn(), refreshSourceRecord: jest.fn(), tombstoneDocument: jest.fn() };
    const service = new ZoteroSourceService(client as never, repository as never);

    await expect(service.syncItem('platform-user', '42', 'key', 'ITEM1')).rejects.toMatchObject({ code: 'ZOTERO_ITEM_NOT_FOUND' });
    expect(repository.tombstoneDocument).not.toHaveBeenCalled();
  });

  it('retains an existing SourceRecord when upstream explicitly marks the parent as trashed', async () => {
    const existing = { id: 'source-1', userId: 'platform-user', externalProvenance: [{ externalRecordId: 'user:42:item:ITEM1', externalVersion: '1' }] };
    const client = { getItem: jest.fn().mockResolvedValue(item(2)) };
    client.getItem.mockResolvedValue({ ...item(2), data: { ...item(2).data, deleted: true } });
    const repository = { findSourceRecordByExternalIdentity: jest.fn().mockResolvedValue(existing), createSourceRecord: jest.fn(), refreshSourceRecord: jest.fn() };
    const service = new ZoteroSourceService(client as never, repository as never);

    await expect(service.syncItem('platform-user', '42', 'key', 'ITEM1')).resolves.toBe(existing);
    expect(repository.refreshSourceRecord).not.toHaveBeenCalled();
  });
});
