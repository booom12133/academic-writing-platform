import { createLocalDevelopmentDatabase, type LocalDevelopmentDatabase } from '../../database/local-development.database';
import { ZoteroConnectionRepository } from './zotero-connection.repository';

describe('ZoteroConnectionRepository', () => {
  let local: LocalDevelopmentDatabase;
  let repository: ZoteroConnectionRepository;

  beforeEach(async () => {
    local = await createLocalDevelopmentDatabase();
    repository = new ZoteroConnectionRepository(local.db);
  });

  afterEach(async () => {
    await local.close();
  });

  it('persists one encrypted personal connection per user and authoritative library', async () => {
    const encrypted = {
      ciphertext: 'cipher', nonce: 'nonce', authTag: 'tag', algorithm: 'aes-256-gcm' as const,
      encryptionKeyVersion: 'v1', keyFingerprint: 'f'.repeat(64),
    };
    const saved = await repository.upsert({
      userId: 'platform-user', libraryId: '42', libraryType: 'user', status: 'active',
      encrypted, lastCheckedAt: new Date(), lastSeenLibraryVersion: '9',
    });

    expect(saved).toMatchObject({ userId: 'platform-user', libraryId: '42', status: 'active' });
    await expect(repository.findByUser('platform-user')).resolves.toHaveLength(1);
    await expect(repository.upsert({
      userId: 'platform-user', libraryId: '42', libraryType: 'user', status: 'active',
      encrypted: { ...encrypted, ciphertext: 'cipher-2' }, lastCheckedAt: new Date(), lastSeenLibraryVersion: '10',
    })).resolves.toMatchObject({ libraryId: '42', lastSeenLibraryVersion: '10' });
    await expect(repository.findByUser('platform-user')).resolves.toHaveLength(1);
  });

  it('keeps encrypted credential material out of the public connection record', async () => {
    const saved = await repository.upsert({
      userId: 'platform-user', libraryId: '42', libraryType: 'user', status: 'active',
      encrypted: {
        ciphertext: 'cipher', nonce: 'nonce', authTag: 'tag', algorithm: 'aes-256-gcm',
        encryptionKeyVersion: 'v1', keyFingerprint: 'f'.repeat(64),
      },
    });

    expect(saved).not.toHaveProperty('encrypted');
    expect(saved).not.toHaveProperty('ciphertext');
  });
});
