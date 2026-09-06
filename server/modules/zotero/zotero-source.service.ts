import { Inject, Injectable } from '@nestjs/common';
import { KnowledgeError } from '../knowledge/knowledge.errors';
import { KnowledgeRepository } from '../knowledge/knowledge.repository';
import { normalizeZoteroMetadata } from './zotero.metadata';
import { ZoteroClient } from './zotero.client';
import { deriveParentIdentity } from './zotero.identity';
import { ZoteroError } from './zotero.errors';
import type { SourceRecord } from '../knowledge/knowledge.types';

@Injectable()
export class ZoteroSourceService {
  constructor(
    @Inject(ZoteroClient)
    private readonly client: Pick<ZoteroClient, 'getItem'>,
    @Inject(KnowledgeRepository)
    private readonly repository: Pick<KnowledgeRepository, 'findSourceRecordByExternalIdentity' | 'createSourceRecord' | 'refreshSourceRecord'>,
  ) {}

  async syncItem(platformUserId: string, libraryId: string, apiKey: string, itemKey: string): Promise<SourceRecord> {
    if (!this.repository.findSourceRecordByExternalIdentity || !this.repository.refreshSourceRecord) {
      throw new KnowledgeError('KNOWLEDGE_NOT_FOUND', 'Zotero source resolution is unavailable.');
    }
    const item = await this.client.getItem(libraryId, apiKey, itemKey, { includeTrashed: true });
    const identity = deriveParentIdentity(libraryId, item.key);
    const existing = await this.repository.findSourceRecordByExternalIdentity({
      userId: platformUserId, connectorKind: 'reference-manager', provider: 'zotero', externalRecordId: identity,
    });
    if (item.data.deleted === true || item.data.trashed === true) {
      if (existing) return existing;
      throw new ZoteroError('ZOTERO_ITEM_NOT_FOUND', 'The Zotero item was not found.');
    }
    const normalized = normalizeZoteroMetadata(item, libraryId);
    if (!existing) {
      try {
        return await this.repository.createSourceRecord({ userId: platformUserId, kind: 'scholarly-work', ...normalized });
      } catch (error) {
        if (!(error instanceof KnowledgeError) || error.code !== 'KNOWLEDGE_METADATA_CONFLICT') throw error;
        const winner = await this.repository.findSourceRecordByExternalIdentity({
          userId: platformUserId, connectorKind: 'reference-manager', provider: 'zotero', externalRecordId: identity,
        });
        if (!winner) throw error;
        return winner;
      }
    }
    const previousVersion = existing.externalProvenance.find((link) => link.externalRecordId === identity)?.externalVersion;
    if (previousVersion === String(item.version)) return existing;
    return this.repository.refreshSourceRecord({
      userId: platformUserId, sourceRecordId: existing.id, ...normalized,
    });
  }
}
