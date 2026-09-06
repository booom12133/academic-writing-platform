import { createLocalDevelopmentDatabase, type LocalDevelopmentDatabase } from '../../database/local-development.database';
import { KnowledgeError } from './knowledge.errors';
import { KnowledgeRepository } from './knowledge.repository';
import type { MetadataAssertionInput } from './knowledge.types';

describe('E4 additive canonical citation metadata', () => {
  let local: LocalDevelopmentDatabase;
  let repository: KnowledgeRepository;

  beforeEach(async () => {
    local = await createLocalDevelopmentDatabase();
    repository = new KnowledgeRepository(local.db);
  });

  afterEach(async () => {
    await local.close();
  });

  it('persists a typed publisher field through the existing assertion contract', async () => {
    const assertion: MetadataAssertionInput = {
      localKey: 'publisher', field: 'publisher', value: 'Academic Press',
      providerKind: 'zotero', provider: 'zotero', externalRecordId: 'item-1',
      verificationStatus: 'observed',
    };

    const source = await repository.createSourceRecord({
      userId: 'user-1', kind: 'scholarly-work',
      metadataAssertions: [assertion],
      canonicalMetadata: {
        publisher: { value: 'Academic Press', assertionKeys: ['publisher'], resolutionStatus: 'resolved' },
      },
    });

    expect(source.canonicalMetadata.publisher).toMatchObject({ value: 'Academic Press', resolutionStatus: 'resolved' });
  });

  it('rejects provider-specific metadata that is outside the canonical field allowlist', async () => {
    const assertion = {
      localKey: 'tags', field: 'tags', value: ['future-tag'],
      providerKind: 'zotero', provider: 'zotero', externalRecordId: 'item-1',
      verificationStatus: 'observed',
    } as unknown as MetadataAssertionInput;

    await expect(repository.createSourceRecord({
      userId: 'user-1', kind: 'scholarly-work',
      metadataAssertions: [assertion],
      canonicalMetadata: {
        tags: { value: ['future-tag'], assertionKeys: ['tags'], resolutionStatus: 'resolved' },
      } as never,
    })).rejects.toMatchObject<Partial<KnowledgeError>>({ code: 'INVALID_KNOWLEDGE_INPUT' });
  });
});
