import { ZoteroCredentialIntrospectionClient } from './zotero-credential-introspection.client';

describe('ZoteroCredentialIntrospectionClient', () => {
  it('uses /keys/current and redacts the auth header from upstream failures', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = jest.fn(async (input: string | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({
        userID: 42,
        access: { user: { library: true, files: true, notes: false, write: false }, groups: {} },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const client = new ZoteroCredentialIntrospectionClient({ baseUrl: 'https://api.zotero.org', fetchImpl });

    await expect(client.introspect('secret-api-key')).resolves.toMatchObject({
      userId: '42', hasLibraryRead: true, hasFilesRead: true,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.zotero.org/keys/current');
    expect(calls[0].init?.headers).toEqual({ 'Zotero-API-Key': 'secret-api-key', 'Zotero-API-Version': '3' });
    expect(calls[0].url).not.toContain('secret-api-key');
  });

  it('rejects a key without both personal library and file read access', async () => {
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({
      userID: 42,
      access: { user: { library: true, files: false }, groups: {} },
    }), { status: 200 }));
    const client = new ZoteroCredentialIntrospectionClient({ baseUrl: 'https://api.zotero.org', fetchImpl });

    await expect(client.introspect('secret-api-key')).resolves.toMatchObject({
      userId: '42', hasLibraryRead: true, hasFilesRead: false,
    });
  });
});
