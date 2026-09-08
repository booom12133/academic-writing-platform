jest.mock('../../client/src/api/http', () => ({
  productHttpClient: {
    delete: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import { productHttpClient } from '../../client/src/api/http';
import {
  connect,
  disconnect,
  getConnectionHealth,
  importAttachment,
  importItem,
  listItems,
  syncItem,
} from '../../client/src/api/zotero';

describe('zotero client', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends the API key only in connect request body and strips it from the returned DTO', async () => {
    (productHttpClient.post as jest.Mock).mockResolvedValueOnce({ data: {
      id: 'connection-1',
      userId: 'user-1',
      libraryType: 'user',
      libraryId: '42',
      keyFingerprint: 'fp',
      status: 'active',
      apiKey: 'must-not-reach-ui',
    } });

    const result = await connect('secret-api-key');

    expect(productHttpClient.post).toHaveBeenCalledWith('/api/zotero/connection', {
      apiKey: 'secret-api-key',
    });
    expect(result).toEqual({
      id: 'connection-1',
      libraryType: 'user',
      libraryId: '42',
      keyFingerprint: 'fp',
      status: 'active',
    });
    expect(result).not.toHaveProperty('apiKey');
    expect(result).not.toHaveProperty('userId');
  });

  it('covers accepted health, item, import, sync, attachment and disconnect routes', async () => {
    const connection = { id: 'connection-1', libraryType: 'user' as const, libraryId: '42', keyFingerprint: 'fp', status: 'active' as const };
    const items = { items: [{ key: 'ITEM1', version: 1, itemType: 'journalArticle', data: { title: 'A paper' } }], libraryVersion: '9' };
    const imported = { upstreamStatus: 'active' as const, source: { id: 'source-1' }, attachments: [] };
    (productHttpClient.get as jest.Mock)
      .mockResolvedValueOnce({ data: [connection] })
      .mockResolvedValueOnce({ data: items });
    (productHttpClient.post as jest.Mock)
      .mockResolvedValueOnce({ data: imported })
      .mockResolvedValueOnce({ data: imported })
      .mockResolvedValueOnce({ data: { document: { id: 'doc-1' } } });
    (productHttpClient.delete as jest.Mock).mockResolvedValueOnce({ data: { status: 'revoked' } });

    await expect(getConnectionHealth()).resolves.toEqual([connection]);
    await expect(listItems()).resolves.toEqual(items);
    await expect(importItem('ITEM1')).resolves.toEqual(imported);
    await expect(syncItem('ITEM1')).resolves.toEqual(imported);
    await expect(importAttachment('ATT1')).resolves.toEqual({ document: { id: 'doc-1' } });
    await expect(disconnect()).resolves.toEqual({ status: 'revoked' });

    expect(productHttpClient.get).toHaveBeenNthCalledWith(1, '/api/zotero/connection/health');
    expect(productHttpClient.get).toHaveBeenNthCalledWith(2, '/api/zotero/items');
    expect(productHttpClient.post).toHaveBeenNthCalledWith(1, '/api/zotero/items/ITEM1/import');
    expect(productHttpClient.post).toHaveBeenNthCalledWith(2, '/api/zotero/items/ITEM1/sync');
    expect(productHttpClient.post).toHaveBeenNthCalledWith(3, '/api/zotero/attachments/ATT1/import');
    expect(productHttpClient.delete).toHaveBeenCalledWith('/api/zotero/connection');
  });

  it('maps a revoked connection to a safe retryable classification', async () => {
    (productHttpClient.get as jest.Mock).mockRejectedValueOnce({
      response: {
        status: 409,
        data: { error: { code: 'ZOTERO_CONNECTION_DISABLED', message: 'secret upstream detail' } },
      },
    });

    const request = getConnectionHealth();
    await expect(request).rejects.toMatchObject({
      name: 'ProductIntegrationError',
      code: 'ZOTERO_CONNECTION_DISABLED',
      retryable: false,
    });
    await expect(request).rejects.not.toThrow('secret upstream detail');
  });
});
