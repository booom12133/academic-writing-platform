import { randomUUID } from 'node:crypto';
import { createLocalDevelopmentDatabase, type LocalDevelopmentDatabase } from '../../database/local-development.database';
import { KnowledgeError } from './knowledge.errors';
import { KnowledgeRepository } from './knowledge.repository';
import type { KnowledgeChunk, MetadataAssertionInput } from './knowledge.types';

describe('KnowledgeRepository', () => {
  let local: LocalDevelopmentDatabase;
  let repository: KnowledgeRepository;

  beforeEach(async () => {
    local = await createLocalDevelopmentDatabase();
    repository = new KnowledgeRepository(local.db);
  });

  afterEach(async () => {
    await local.close();
  });

  function assertion(localKey: string, field: MetadataAssertionInput['field'], value: string): MetadataAssertionInput {
    return {
      localKey,
      field,
      value,
      providerKind: 'test-provider',
      provider: 'test',
      externalRecordId: `${localKey}-record`,
      verificationStatus: 'observed',
    };
  }

  it('creates a metadata-only source, preserves field evidence, and hydrates links', async () => {
    const source = await repository.createSourceRecord({
      userId: 'user-1',
      kind: 'scholarly-work',
      metadataAssertions: [assertion('title-a', 'title', 'A title')],
      canonicalMetadata: {
        title: { value: 'A title', assertionKeys: ['title-a'], resolutionStatus: 'resolved' },
      },
      externalProvenance: [{
        connectorKind: 'library',
        provider: 'test',
        externalRecordId: 'record-1',
        verificationStatus: 'observed',
      }],
    });

    expect(source.id).toBeTruthy();
    expect(source.canonicalMetadata.title?.assertionIds).toHaveLength(1);
    expect(source.externalProvenance).toEqual([expect.objectContaining({ externalRecordId: 'record-1' })]);
    expect(await repository.getSourceRecord('user-1', source.id)).toEqual(source);
  });

  it('allows two documents for one source and a document without a source', async () => {
    const source = await repository.createSourceRecord({ userId: 'user-1', kind: 'user-declared' });
    const first = await repository.createDocument({
      userId: 'user-1', sourceRecordId: source.id, originKind: 'external-attachment',
      displayName: 'one', sourceType: 'txt',
    });
    const second = await repository.createDocument({
      userId: 'user-1', sourceRecordId: source.id, originKind: 'external-attachment',
      displayName: 'two', sourceType: 'txt',
    });
    const standalone = await repository.createDocument({
      userId: 'user-1', originKind: 'user-upload', displayName: 'standalone', sourceType: 'txt',
    });

    expect(first.sourceRecordId).toBe(source.id);
    expect(second.sourceRecordId).toBe(source.id);
    expect(standalone.sourceRecordId).toBeUndefined();
  });

  it('rejects duplicate external identity and cross-user source relationships', async () => {
    const source = await repository.createSourceRecord({ userId: 'user-1', kind: 'scholarly-work' });
    await repository.createExternalLinks({
      userId: 'user-1', sourceRecordId: source.id,
      links: [{ connectorKind: 'open', provider: 'test', externalRecordId: 'same', verificationStatus: 'observed' }],
    });
    await expect(repository.createExternalLinks({
      userId: 'user-1', sourceRecordId: source.id,
      links: [{ connectorKind: 'open', provider: 'test', externalRecordId: 'same', verificationStatus: 'observed' }],
    })).rejects.toMatchObject({ code: 'KNOWLEDGE_METADATA_CONFLICT' });
    await expect(repository.createDocument({
      userId: 'user-2', sourceRecordId: source.id, originKind: 'user-upload',
      displayName: 'wrong owner', sourceType: 'txt',
    })).rejects.toMatchObject({ code: 'KNOWLEDGE_NOT_FOUND' });
  });

  it('retains conflicting same-field assertions and validates canonical support', async () => {
    const source = await repository.createSourceRecord({
      userId: 'user-1', kind: 'scholarly-work',
      metadataAssertions: [assertion('a', 'title', 'A'), assertion('b', 'title', 'B')],
      canonicalMetadata: {
        title: { value: 'A', assertionKeys: ['a', 'b'], resolutionStatus: 'conflicting' },
      },
    });
    expect(source.canonicalMetadata.title?.resolutionStatus).toBe('conflicting');
    expect(source.canonicalMetadata.title?.assertionIds).toHaveLength(2);

    await expect(repository.createSourceRecord({
      userId: 'user-1', kind: 'scholarly-work',
      metadataAssertions: [assertion('title', 'title', 'A'), assertion('doi', 'doi', '10/test')],
      canonicalMetadata: { title: { value: 'A', assertionKeys: ['doi'], resolutionStatus: 'resolved' } },
    })).rejects.toMatchObject({ code: 'INVALID_KNOWLEDGE_INPUT' });
    await expect(repository.createSourceRecord({
      userId: 'user-1', kind: 'scholarly-work',
      metadataAssertions: [assertion('a', 'title', 'A'), assertion('b', 'title', 'B')],
      canonicalMetadata: { title: { value: 'A', assertionKeys: ['a', 'b'], resolutionStatus: 'resolved' } },
    })).rejects.toMatchObject({ code: 'INVALID_KNOWLEDGE_INPUT' });
    await expect(repository.createSourceRecord({
      userId: 'user-1', kind: 'scholarly-work',
      metadataAssertions: [assertion('a', 'title', 'A'), assertion('b', 'title', 'B')],
      canonicalMetadata: { title: { value: 'C', assertionKeys: ['a', 'b'], resolutionStatus: 'conflicting' } },
    })).rejects.toMatchObject({ code: 'INVALID_KNOWLEDGE_INPUT' });
    await expect(repository.createSourceRecord({
      userId: 'user-1', kind: 'scholarly-work',
      metadataAssertions: [assertion('title', 'title', 'A')],
      canonicalMetadata: { title: { value: 'B', assertionKeys: ['title'], resolutionStatus: 'resolved' } },
    })).rejects.toMatchObject({ code: 'INVALID_KNOWLEDGE_INPUT' });
  });

  it('enforces per-user import idempotency and persists ordered immutable chunks', async () => {
    const document = await repository.createDocument({ userId: 'user-1', originKind: 'user-upload', displayName: 'doc', sourceType: 'txt' });
    const version = await repository.createVersion({
      userId: 'user-1', documentId: document.id, versionNumber: 1, originalContentHash: 'a'.repeat(64),
      parserProfile: { name: 'c1-document-parser-v1', version: '1' },
      chunkingProfile: { name: 'test', version: '1', parameters: { maxSize: 10 } },
      lifecycleStatus: 'active', readinessStatus: 'content-ready-for-indexing', indexInputFingerprint: 'b'.repeat(64),
    });
    const chunks: KnowledgeChunk[] = [0, 1].map((ordinal) => ({
      id: randomUUID(), userId: 'user-1', documentVersionId: version.id, ordinal,
      text: `chunk-${ordinal}`, textHash: 'c'.repeat(64),
      provenance: { documentId: document.id, documentVersionId: version.id, sourceBlockId: `b${ordinal}`, sourceBlockIndex: ordinal, section: 'content', headingPath: [], sourceUnitId: `u${ordinal}`, sourceChunkOrdinal: 0, itemOrdinal: ordinal },
      citationLocator: { documentVersionId: version.id, chunkId: 'pending', section: 'content', sourceBlockId: `b${ordinal}`, sourceBlockIndex: ordinal },
    }));
    await expect(repository.createChunks(chunks)).resolves.toHaveLength(2);

    const importId = await repository.createImportMarker({ userId: 'user-1', idempotencyKey: 'key', requestFingerprint: 'd'.repeat(64) });
    await expect(repository.createImportMarker({ userId: 'user-1', idempotencyKey: 'key', requestFingerprint: 'd'.repeat(64) })).resolves.toBe(importId);
    await expect(repository.createImportMarker({ userId: 'user-1', idempotencyKey: 'key', requestFingerprint: 'e'.repeat(64) })).rejects.toMatchObject({ code: 'KNOWLEDGE_IDEMPOTENCY_CONFLICT' });
    await expect(repository.findImport('user-2', 'key')).resolves.toBeNull();
  });

  it('keeps active-version ownership scoped and hides tombstoned documents', async () => {
    const first = await repository.createDocument({ userId: 'user-1', originKind: 'user-upload', displayName: 'first', sourceType: 'txt' });
    const second = await repository.createDocument({ userId: 'user-1', originKind: 'user-upload', displayName: 'second', sourceType: 'txt' });
    const version = await repository.createVersion({
      userId: 'user-1', documentId: first.id, versionNumber: 1, originalContentHash: 'f'.repeat(64),
      parserProfile: { name: 'c1-document-parser-v1', version: '1' }, chunkingProfile: { name: 'test', version: '1', parameters: { maxSize: 10 } },
      lifecycleStatus: 'active', readinessStatus: 'content-ready-for-indexing', indexInputFingerprint: 'g'.repeat(64),
    });
    await expect(repository.activateVersion('user-1', second.id, version.id)).rejects.toMatchObject({ code: 'KNOWLEDGE_NOT_FOUND' });
    await repository.tombstoneDocument('user-1', first.id);
    await expect(repository.getDocument?.('user-1', first.id)).resolves.toBeNull();
    await expect(repository.createVersion({
      userId: 'user-1', documentId: first.id, versionNumber: 2, originalContentHash: 'h'.repeat(64),
      parserProfile: { name: 'c1-document-parser-v1', version: '1' }, chunkingProfile: { name: 'test', version: '1', parameters: { maxSize: 10 } },
      lifecycleStatus: 'active', readinessStatus: 'content-ready-for-indexing', indexInputFingerprint: 'i'.repeat(64),
    })).rejects.toMatchObject({ code: 'KNOWLEDGE_NOT_FOUND' });
  });

});
