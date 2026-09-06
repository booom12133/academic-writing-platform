import { createLocalDevelopmentDatabase, type LocalDevelopmentDatabase } from '../../database/local-development.database';
import { KnowledgeRepository } from './knowledge.repository';

describe('KnowledgeDocument external artifact state', () => {
  let local: LocalDevelopmentDatabase;
  let repository: KnowledgeRepository;

  beforeEach(async () => {
    local = await createLocalDevelopmentDatabase();
    repository = new KnowledgeRepository(local.db);
  });

  afterEach(async () => {
    await local.close();
  });

  it('resolves, updates, tombstones, and restores one owner-scoped external document', async () => {
    const document = await repository.createDocument({
      userId: 'user-1', originKind: 'external-attachment', displayName: 'paper.pdf', sourceType: 'pdf',
      externalIdentity: 'zotero:user:42:attachment:PDF1', externalVersion: '3',
      externalChecksumAlgorithm: 'md5', externalChecksum: 'a'.repeat(32),
    } as never);

    await expect(repository.findDocumentByExternalIdentity('user-1', 'zotero:user:42:attachment:PDF1')).resolves.toMatchObject({ id: document.id, externalVersion: '3' });
    await repository.updateExternalSyncState('user-1', document.id, { externalVersion: '4', externalChecksumAlgorithm: 'md5', externalChecksum: 'b'.repeat(32) });
    await expect(repository.findDocumentByExternalIdentity('user-1', 'zotero:user:42:attachment:PDF1')).resolves.toMatchObject({ externalVersion: '4', externalChecksum: 'b'.repeat(32) });

    await repository.tombstoneDocument('user-1', document.id);
    await expect(repository.getDocument('user-1', document.id)).resolves.toBeNull();
    await expect(repository.findDocumentByExternalIdentity('user-1', 'zotero:user:42:attachment:PDF1')).resolves.toMatchObject({ lifecycleStatus: 'tombstoned' });
    await repository.restoreDocument('user-1', document.id);
    await expect(repository.getDocument('user-1', document.id)).resolves.toMatchObject({ id: document.id, lifecycleStatus: 'active' });
  });

  it('does not resolve another user through an external identity', async () => {
    await repository.createDocument({
      userId: 'user-1', originKind: 'external-attachment', displayName: 'paper.pdf', sourceType: 'pdf',
      externalIdentity: 'zotero:user:42:attachment:PDF1', externalVersion: '1',
      externalChecksumAlgorithm: 'md5', externalChecksum: 'a'.repeat(32),
    } as never);

    await expect(repository.findDocumentByExternalIdentity('user-2', 'zotero:user:42:attachment:PDF1')).resolves.toBeNull();
  });
});
