import { ZoteroCredentialResolver } from './zotero-credential-resolver';

describe('ZoteroCredentialResolver', () => {
  it('derives the persisted personal library from /keys/current authority', async () => {
    const introspection = { introspect: jest.fn().mockResolvedValue({
      userId: '42', hasLibraryRead: true, hasFilesRead: true,
      hasNotesRead: false, hasWriteAccess: false, groupAccess: {},
    }) };
    const crypto = { encrypt: jest.fn().mockReturnValue({
      ciphertext: 'cipher', nonce: 'nonce', authTag: 'tag', algorithm: 'aes-256-gcm',
      encryptionKeyVersion: 'v1', keyFingerprint: 'f'.repeat(64),
    }) };
    const repository = { upsert: jest.fn().mockResolvedValue({
      id: 'connection-1', userId: 'platform-user', libraryType: 'user', libraryId: '42',
      keyFingerprint: 'f'.repeat(64), encryptionKeyVersion: 'v1', status: 'active',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }) };
    const resolver = new ZoteroCredentialResolver(introspection, { ...crypto, decrypt: jest.fn() }, repository as never);

    await expect(resolver.connect('platform-user', 'secret-api-key')).resolves.toMatchObject({ libraryId: '42' });
    expect(repository.upsert).toHaveBeenCalledWith(expect.objectContaining({ userId: 'platform-user', libraryId: '42' }));
    expect(repository.upsert.mock.calls[0][0]).not.toHaveProperty('libraryId', 'client-supplied-id');
  });

  it('rejects a key without personal library and file read privileges', async () => {
    const introspection = { introspect: jest.fn().mockResolvedValue({
      userId: '42', hasLibraryRead: true, hasFilesRead: false,
      hasNotesRead: false, hasWriteAccess: false, groupAccess: {},
    }) };
    const resolver = new ZoteroCredentialResolver(introspection, { encrypt: jest.fn(), decrypt: jest.fn() }, { upsert: jest.fn() } as never);

    await expect(resolver.connect('platform-user', 'secret-api-key')).rejects.toMatchObject({ code: 'ZOTERO_INSUFFICIENT_PRIVILEGES' });
  });

  it('resolves an active credential only for the stored authoritative connection', async () => {
    const repository = {
      findActiveCredential: jest.fn().mockResolvedValue({
        connection: { id: 'connection-1', userId: 'platform-user', libraryType: 'user', libraryId: '42', status: 'active' },
        encrypted: { ciphertext: 'cipher', nonce: 'nonce', authTag: 'tag', algorithm: 'aes-256-gcm', encryptionKeyVersion: 'v1', keyFingerprint: 'f'.repeat(64) },
      }),
    };
    const crypto = { encrypt: jest.fn(), decrypt: jest.fn().mockReturnValue('secret-api-key') };
    const resolver = new ZoteroCredentialResolver({ introspect: jest.fn() }, crypto, repository as never);

    await expect(resolver.resolve('platform-user')).resolves.toMatchObject({ connection: { libraryId: '42' }, apiKey: 'secret-api-key' });
  });
});
